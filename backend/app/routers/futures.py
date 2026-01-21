"""
Futures API
Get mock futures for display
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date
from typing import List
from pydantic import BaseModel

from app.database import get_db
from app.dependencies import get_current_user
from app.models.database import User, Commodity, MarketPrice, Purchase
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


# Response schemas
class FutureContract(BaseModel):
    commodity: str
    contract_month: str  # YYYY-MM-DD
    price: float  # Commodity price per unit the future locks in
    cost: float  # Total contract cost in cents (1-3 cents fixed per contract)
    future_type: str  # 'high' or 'low'
    suggested_quantity: float  # Average purchase volume for this commodity


class FuturesListResponse(BaseModel):
    futures: List[FutureContract]


@router.get("/list", response_model=FuturesListResponse)
async def get_futures_list(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all mock futures contracts for display in tiles
    
    Returns both high and low futures for each commodity and duration
    ONLY if customer has purchase data
    """
    try:
        # Check if customer has ANY purchases
        purchase_check = await db.execute(
            select(Purchase)
            .where(Purchase.customer_id == current_user.customer_id)
            .limit(1)
        )
        has_purchases = purchase_check.scalar_one_or_none() is not None
        
        # If no purchases, return empty futures list
        if not has_purchases:
            logger.info(f"No purchases found for customer {current_user.customer_id}, returning empty futures")
            return FuturesListResponse(futures=[])
        
        # Get all commodities
        commodities_result = await db.execute(select(Commodity))
        commodities_list = commodities_result.scalars().all()
        commodities = {str(c.id): c.name for c in commodities_list}
        
        # Calculate average purchase volumes per commodity
        commodity_volumes = {}
        for commodity in commodities_list:
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
            
            if purchases:
                # Calculate monthly volumes
                purchase_volumes = {}
                for purchase in purchases:
                    # Distribute purchase quantity across delivery months
                    delivery_start = purchase.delivery_start_date
                    delivery_end = purchase.delivery_end_date
                    
                    months_diff = (delivery_end.year - delivery_start.year) * 12 + (delivery_end.month - delivery_start.month) + 1
                    quantity_per_month = float(purchase.quantity) / months_diff
                    
                    current_month = date(delivery_start.year, delivery_start.month, 1)
                    end_month = date(delivery_end.year, delivery_end.month, 1)
                    
                    while current_month <= end_month:
                        if current_month not in purchase_volumes:
                            purchase_volumes[current_month] = 0.0
                        purchase_volumes[current_month] += quantity_per_month
                        
                        if current_month.month == 12:
                            current_month = date(current_month.year + 1, 1, 1)
                        else:
                            current_month = date(current_month.year, current_month.month + 1, 1)
                
                # Use average of last 3 months
                recent_volumes = list(purchase_volumes.values())[-3:] if purchase_volumes else []
                avg_volume = sum(recent_volumes) / len(recent_volumes) if recent_volumes else 1000.0
                commodity_volumes[commodity.id] = avg_volume
            else:
                commodity_volumes[commodity.id] = 1000.0  # Default
        
        # Get all mock futures (high and low)
        futures_result = await db.execute(
            select(MarketPrice)
            .where(
                MarketPrice.source.in_(['mock_futures_high', 'mock_futures_low'])
            )
            .order_by(MarketPrice.commodity_id, MarketPrice.contract_month)
        )
        futures = futures_result.scalars().all()
        
        # Build response
        futures_list = []
        for future in futures:
            commodity_name = commodities.get(str(future.commodity_id), 'unknown')
            future_type = 'high' if 'high' in future.source else 'low'
            suggested_qty = commodity_volumes.get(future.commodity_id, 1000.0)
            
            futures_list.append(FutureContract(
                commodity=commodity_name,
                contract_month=future.contract_month.isoformat(),
                price=float(future.price),
                cost=float(future.cost) if future.cost else 0.0,
                future_type=future_type,
                suggested_quantity=suggested_qty
            ))
        
        return FuturesListResponse(futures=futures_list)
        
    except Exception as e:
        logger.error(f"Error fetching futures: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch futures: {str(e)}")
