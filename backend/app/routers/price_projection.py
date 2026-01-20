"""
Price Projection API
New simplified API for price visualization with futures
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
from typing import List, Dict
from pydantic import BaseModel

from app.database import get_db
from app.dependencies import get_current_user
from app.models.database import User, Commodity, Purchase, MarketPrice
from app.services.futures_mock_service import generate_mock_futures, get_futures_for_commodity
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


# Response schemas
class PricePoint(BaseModel):
    date: str
    price: float
    high_future: float
    low_future: float
    is_past: bool


class CommodityProjection(BaseModel):
    commodity: str
    timeline: List[PricePoint]


class PriceProjectionResponse(BaseModel):
    currency: str
    projections: List[CommodityProjection]


class FuturesGenerationResponse(BaseModel):
    status: str
    futures_created: int
    message: str


@router.post("/generate-futures", response_model=FuturesGenerationResponse)
async def generate_futures(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate mock futures for all commodities
    Called automatically on login
    
    Creates 1M, 3M, 6M, 9M, 12M futures with:
    - Low-price futures: decreasing price over time
    - High-price futures: increasing price over time
    """
    try:
        result = await generate_mock_futures(db)
        return FuturesGenerationResponse(
            status="success",
            futures_created=result["futures_created"],
            message=f"Generated {result['futures_created']} mock futures"
        )
    except Exception as e:
        logger.error(f"Error generating futures: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate futures: {str(e)}")


@router.get("/timeline", response_model=PriceProjectionResponse)
async def get_price_projection_timeline(
    start_date: date = Query(None),
    end_date: date = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get price projection timeline with futures
    
    For PAST dates:
    - price = historic purchase price
    - high_future = price (same as historic)
    - low_future = price (same as historic)
    
    For FUTURE dates:
    - price = current commodity price (baseline)
    - high_future = price from high-price futures
    - low_future = price from low-price futures
    """
    # Default date range: 1 year history + 1 year future
    today = date.today()
    if not start_date:
        start_date = today - relativedelta(years=1)
    if not end_date:
        end_date = today + relativedelta(years=1)
    
    try:
        # Get all commodities
        commodities_result = await db.execute(select(Commodity))
        commodities = commodities_result.scalars().all()
        
        projections = []
        
        for commodity in commodities:
            commodity_name = commodity.name.lower()
            
            # Get customer's purchases for this commodity
            purchases_result = await db.execute(
                select(Purchase)
                .where(
                    Purchase.customer_id == current_user.customer_id,
                    Purchase.commodity_id == commodity.id
                )
                .order_by(Purchase.purchase_date)
            )
            purchases = purchases_result.scalars().all()
            
            # Get futures for this commodity
            futures = await get_futures_for_commodity(
                db, str(commodity.id), today
            )
            
            # Build futures lookup by month
            low_futures_map = {
                f["contract_month"]: f["price"]
                for f in futures["low_futures"]
            }
            high_futures_map = {
                f["contract_month"]: f["price"]
                for f in futures["high_futures"]
            }
            
            # Calculate baseline current price (average of recent purchases or default)
            if purchases:
                baseline_price = float(sum(p.purchase_price for p in purchases[-3:]) / min(3, len(purchases)))
            else:
                # Default prices
                baseline_price = 20.0 if commodity_name == "sugar" else 15.0
            
            # Build timeline
            timeline = []
            current_date = start_date
            
            while current_date <= end_date:
                is_past = current_date < today
                
                if is_past:
                    # PAST: Use actual purchase price or baseline
                    # Find purchase on or before this date
                    relevant_purchases = [
                        p for p in purchases
                        if p.purchase_date <= current_date
                    ]
                    
                    if relevant_purchases:
                        price = float(relevant_purchases[-1].purchase_price)
                    else:
                        price = baseline_price
                    
                    # Past has no uncertainty
                    timeline.append(PricePoint(
                        date=current_date.isoformat(),
                        price=price,
                        high_future=price,
                        low_future=price,
                        is_past=True
                    ))
                else:
                    # FUTURE: Return null for price, only show high/low futures
                    # Calculate time distance from today (in years)
                    days_ahead = (current_date - today).days
                    years_ahead = days_ahead / 365.0
                    
                    # Growing uncertainty: bands expand with sqrt(time)
                    # This represents increasing price uncertainty over time
                    base_uncertainty = 0.05  # 5% base uncertainty
                    time_factor = (1.0 + years_ahead ** 0.5)  # Square root of time
                    uncertainty = base_uncertainty * time_factor
                    
                    high_future_price = baseline_price * (1.0 + uncertainty)
                    low_future_price = baseline_price * (1.0 - uncertainty)
                    
                    timeline.append(PricePoint(
                        date=current_date.isoformat(),
                        price=0.0,  # Null/zero for future - don't show baseline
                        high_future=high_future_price,
                        low_future=low_future_price,
                        is_past=False
                    ))
                
                # Move to next month
                current_date = current_date + relativedelta(months=1)
            
            projections.append(CommodityProjection(
                commodity=commodity_name,
                timeline=timeline
            ))
        
        return PriceProjectionResponse(
            currency="USD",
            projections=projections
        )
        
    except Exception as e:
        logger.error(f"Error calculating price projection: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
