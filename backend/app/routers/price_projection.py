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
    var: float  # Value at Risk (downside risk from baseline)
    is_milestone: bool  # True for 1M, 3M, 6M, 9M, 12M dates


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
            
            # Calculate baseline current price (average of recent purchases or default)
            if purchases:
                baseline_price = float(sum(p.purchase_price for p in purchases[-3:]) / min(3, len(purchases)))
            else:
                # Default prices
                baseline_price = 20.0 if commodity_name == "sugar" else 15.0
            
            # Build monthly purchase volume map
            # Aggregate quantity for each delivery month
            purchase_volumes = {}
            for purchase in purchases:
                # Distribute purchase quantity across delivery months
                delivery_start = purchase.delivery_start_date
                delivery_end = purchase.delivery_end_date
                
                # Calculate number of months in delivery period
                months_diff = (delivery_end.year - delivery_start.year) * 12 + (delivery_end.month - delivery_start.month) + 1
                quantity_per_month = float(purchase.quantity) / months_diff
                
                # Add to each month in the delivery period
                current_month = date(delivery_start.year, delivery_start.month, 1)
                end_month = date(delivery_end.year, delivery_end.month, 1)
                
                while current_month <= end_month:
                    if current_month not in purchase_volumes:
                        purchase_volumes[current_month] = 0.0
                    purchase_volumes[current_month] += quantity_per_month
                    
                    # Move to next month
                    if current_month.month == 12:
                        current_month = date(current_month.year + 1, 1, 1)
                    else:
                        current_month = date(current_month.year, current_month.month + 1, 1)
            
            # For future months, estimate volume based on recent average
            recent_volumes = list(purchase_volumes.values())[-3:] if purchase_volumes else []
            avg_future_volume = sum(recent_volumes) / len(recent_volumes) if recent_volumes else 1000.0
            
            # Build timeline
            timeline = []
            current_date = start_date
            
            # Calculate milestone dates (1M, 3M, 6M, 9M, 12M from today)
            milestone_dates = set()
            for months in [1, 3, 6, 9, 12]:
                milestone = today + relativedelta(months=months)
                milestone_key = date(milestone.year, milestone.month, 1)
                milestone_dates.add(milestone_key)
            
            while current_date <= end_date:
                is_past = current_date < today
                month_key = date(current_date.year, current_date.month, 1)
                
                # Check if this is a milestone date
                is_milestone = month_key in milestone_dates
                
                # Get volume for this month
                if is_past:
                    volume = purchase_volumes.get(month_key, 0.0)
                else:
                    volume = avg_future_volume  # Use average for future
                
                if is_past:
                    # PAST: Use actual purchase price * volume
                    # Find purchase on or before this date
                    relevant_purchases = [
                        p for p in purchases
                        if p.purchase_date <= current_date
                    ]
                    
                    if relevant_purchases:
                        price = float(relevant_purchases[-1].purchase_price)
                    else:
                        price = baseline_price
                    
                    # Past has no uncertainty - multiply by volume
                    total_value = price * volume
                    
                    timeline.append(PricePoint(
                        date=current_date.isoformat(),
                        price=total_value,
                        high_future=total_value,
                        low_future=total_value,
                        is_past=True,
                        var=0.0,  # No risk in past
                        is_milestone=False  # Don't show milestones in past
                    ))
                else:
                    # FUTURE: Return null for price, only show high/low futures * volume
                    # Calculate time distance from today (in years)
                    days_ahead = (current_date - today).days
                    years_ahead = days_ahead / 365.0
                    
                    # Growing uncertainty: bands expand with sqrt(time)
                    # Increased to match realistic commodity price volatility
                    base_uncertainty = 0.20  # 20% base uncertainty (realistic for commodities)
                    time_factor = (1.0 + 1.5 * (years_ahead ** 0.5))  # Accelerated growth
                    uncertainty = base_uncertainty * time_factor
                    
                    high_future_price = baseline_price * (1.0 + uncertainty)
                    low_future_price = baseline_price * (1.0 - uncertainty)
                    
                    # Calculate total values
                    high_total = high_future_price * volume
                    low_total = low_future_price * volume
                    baseline_total = baseline_price * volume
                    
                    # VaR = downside risk from baseline
                    var_value = baseline_total - low_total
                    
                    # Multiply by volume
                    timeline.append(PricePoint(
                        date=current_date.isoformat(),
                        price=0.0,  # Null/zero for future - don't show baseline
                        high_future=high_total,
                        low_future=low_total,
                        is_past=False,
                        var=var_value,
                        is_milestone=is_milestone
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
