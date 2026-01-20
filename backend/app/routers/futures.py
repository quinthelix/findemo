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
from app.models.database import User, Commodity, MarketPrice
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


# Response schemas
class FutureContract(BaseModel):
    commodity: str
    contract_month: str  # YYYY-MM-DD
    price: float
    future_type: str  # 'high' or 'low'


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
    """
    try:
        # Get all commodities
        commodities_result = await db.execute(select(Commodity))
        commodities = {str(c.id): c.name for c in commodities_result.scalars().all()}
        
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
            
            futures_list.append(FutureContract(
                commodity=commodity_name,
                contract_month=future.contract_month.isoformat(),
                price=float(future.price),
                future_type=future_type
            ))
        
        return FuturesListResponse(futures=futures_list)
        
    except Exception as e:
        logger.error(f"Error fetching futures: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch futures: {str(e)}")
