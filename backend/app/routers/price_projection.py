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
    volume: float  # Volume/quantity for this date
    eval_high: float | None = None  # Evaluated high (only if evaluated)
    eval_low: float | None = None  # Evaluated low (only if evaluated)


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
    force: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate/regenerate mock futures from today
    
    Creates 1M, 3M, 6M, 9M, 12M futures FROM TODAY with:
    - Low-price futures: decreasing price over time
    - High-price futures: increasing price over time
    
    Query params:
    - force: If true, regenerate even if futures are fresh (default: false)
    """
    try:
        result = await generate_mock_futures(
            db, 
            customer_id=str(current_user.customer_id),
            force=force
        )
        
        if result.get("skipped"):
            return FuturesGenerationResponse(
                status="skipped",
                futures_created=0,
                message="Futures are already fresh (created today)"
            )
        
        return FuturesGenerationResponse(
            status="success",
            futures_created=result["futures_created"],
            message=f"Generated {result['futures_created']} mock futures from today"
        )
    except Exception as e:
        logger.error(f"Error generating futures: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate futures: {str(e)}")


class EvaluationItem(BaseModel):
    commodity: str
    contract_month: str  # YYYY-MM-DD
    price: float
    quantity: float


class EvaluationRequest(BaseModel):
    start_date: str
    end_date: str
    evaluations: List[EvaluationItem] = []


@router.post("/timeline-with-eval", response_model=PriceProjectionResponse)
async def get_price_projection_with_evaluations(
    request: EvaluationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get price projection with multiple evaluations applied
    Supports cumulative hedging scenarios
    """
    start_date = date.fromisoformat(request.start_date)
    end_date = date.fromisoformat(request.end_date)
    
    # Build evaluation map: {(commodity, month_key): [(price, quantity), ...]}
    eval_map = {}
    for eval_item in request.evaluations:
        try:
            eval_month_date = date.fromisoformat(eval_item.contract_month)
            month_key = date(eval_month_date.year, eval_month_date.month, 1)
            key = (eval_item.commodity.lower(), month_key)
            
            if key not in eval_map:
                eval_map[key] = []
            eval_map[key].append((eval_item.price, eval_item.quantity))
            logger.info(f"Added evaluation: {key} -> price={eval_item.price}, qty={eval_item.quantity}")
        except Exception as e:
            logger.warning(f"Invalid evaluation item: {eval_item}, error: {e}")
    
    logger.info(f"Total eval_map keys: {len(eval_map)}, keys: {list(eval_map.keys())}")
    return await _calculate_price_projection(db, current_user, start_date, end_date, eval_map)


@router.get("/timeline", response_model=PriceProjectionResponse)
async def get_price_projection_timeline(
    start_date: date = Query(None),
    end_date: date = Query(None),
    eval_commodity: str = Query(None, description="Commodity to evaluate (sugar/flour)"),
    eval_contract_month: str = Query(None, description="Contract month (YYYY-MM-DD)"),
    eval_price: float = Query(None, description="Future price to evaluate"),
    eval_quantity: float = Query(None, description="Quantity to purchase"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get price projection timeline with futures (legacy single-evaluation endpoint)
    """
    # Default date range: 1 year history + 1 year future
    today = date.today()
    if not start_date:
        start_date = today - relativedelta(years=1)
    if not end_date:
        end_date = today + relativedelta(years=1)
    
    # Build eval_map for single evaluation (backward compatibility)
    eval_map = {}
    if eval_commodity and eval_contract_month and eval_price is not None and eval_quantity is not None:
        try:
            eval_month_date = date.fromisoformat(eval_contract_month)
            month_key = date(eval_month_date.year, eval_month_date.month, 1)
            key = (eval_commodity.lower(), month_key)
            eval_map[key] = [(eval_price, eval_quantity)]
        except:
            pass
    
    return await _calculate_price_projection(db, current_user, start_date, end_date, eval_map)


async def _calculate_price_projection(
    db: AsyncSession,
    current_user: User,
    start_date: date,
    end_date: date,
    eval_map: dict  # {(commodity, month_key): [(price, qty), ...]}
) -> PriceProjectionResponse:
    """
    Internal function to calculate price projection with evaluations
    Returns empty data if customer has no purchases
    """
    today = date.today()
    today_month = date(today.year, today.month, 1)
    
    try:
        # Early check: does customer have ANY purchases?
        purchase_check = await db.execute(
            select(Purchase)
            .where(Purchase.customer_id == current_user.customer_id)
            .limit(1)
        )
        has_purchases = purchase_check.scalar_one_or_none() is not None
        
        if not has_purchases:
            logger.info(f"No purchases for customer {current_user.customer_id}, returning empty projection")
            return PriceProjectionResponse(
                start_date=start_date,
                end_date=end_date,
                commodities=[]
            )
        
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
            
            # Skip commodities with no purchase history
            if not purchases:
                logger.info(f"Skipping {commodity_name} - no purchase history")
                continue
            
            # Calculate baseline current price (average of recent purchases)
            baseline_price = float(sum(p.purchase_price for p in purchases[-3:]) / min(3, len(purchases)))
            
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
            # Only calculate if we have actual purchase data
            recent_volumes = list(purchase_volumes.values())[-3:] if purchase_volumes else []
            if not recent_volumes:
                logger.warning(f"No purchase volumes for {commodity_name}, skipping projection")
                continue
            avg_future_volume = sum(recent_volumes) / len(recent_volumes)
            
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
                # Normalize to first of month for consistency
                month_key = date(current_date.year, current_date.month, 1)
                # Use month_key as the date in response for consistency
                response_date = month_key
                
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
                        date=response_date.isoformat(),
                        price=total_value,
                        high_future=total_value,
                        low_future=total_value,
                        is_past=True,
                        var=0.0,  # No risk in past
                        is_milestone=False,  # Don't show milestones in past
                        volume=volume,
                        eval_high=total_value,  # Past eval lines match solid lines
                        eval_low=total_value
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
                    
                    # ALWAYS calculate normal scenario (no evaluation)
                    high_total = high_future_price * volume
                    low_total = low_future_price * volume
                    baseline_total = baseline_price * volume
                    
                    # Initialize eval values
                    # For milestone dates and today, default to matching solid lines
                    eval_key = (commodity_name, month_key)
                    eval_high_value = None
                    eval_low_value = None
                    
                    # Set eval values for: today OR milestone dates (where futures exist)
                    is_today = month_key == today_month  # Compare month_key to today_month
                    if is_today or is_milestone:
                        # Default: eval lines match solid lines (no hedge)
                        eval_high_value = high_total
                        eval_low_value = low_total
                    
                    # Override with actual evaluation if present
                    if eval_key in eval_map:
                        # EVALUATION SCENARIO with multiple futures
                        # Calculate locked-in value from all evaluated futures
                        locked_value = sum(price * qty for price, qty in eval_map[eval_key])
                        total_locked_qty = sum(qty for _, qty in eval_map[eval_key])
                        remaining_volume = max(0, volume - total_locked_qty)
                        
                        eval_high_value = locked_value + (high_future_price * remaining_volume)
                        eval_low_value = locked_value + (low_future_price * remaining_volume)
                        logger.info(f"Found evaluation for {eval_key}: eval_high={eval_high_value}, eval_low={eval_low_value}")
                    
                    # VaR = downside risk from baseline
                    var_value = baseline_total - low_total
                    
                    # Multiply by volume
                    timeline.append(PricePoint(
                        date=response_date.isoformat(),
                        price=0.0,  # Null/zero for future - don't show baseline
                        high_future=high_total,
                        low_future=low_total,
                        is_past=False,
                        var=var_value,
                        is_milestone=is_milestone,
                        volume=volume,
                        eval_high=eval_high_value,  # Set for today and milestones
                        eval_low=eval_low_value  # Set for today and milestones
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
