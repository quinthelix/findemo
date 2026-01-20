"""
Market data router
POST /market-data/refresh - Refresh market data
GET /market-data/futures - Get available futures contracts
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.dependencies import get_current_user
from app.models.database import User
from app.models.schemas import MarketDataRefreshResponse, FuturesContract
from app.services.market_data_service import refresh_market_data, get_available_futures
from typing import List

router = APIRouter()


@router.post("/refresh", response_model=MarketDataRefreshResponse)
async def refresh_market_data_endpoint(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Refresh market data from Yahoo Finance / Stooq
    Fetches historical prices and forward curves
    """
    try:
        stats = await refresh_market_data(db)
        
        return MarketDataRefreshResponse(
            message="Market data refreshed successfully",
            commodities_updated=stats["commodities_updated"],
            prices_added=stats["historical_prices_added"],
            futures_contracts_updated=stats["futures_contracts_updated"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error refreshing market data: {str(e)}")


@router.get("/futures", response_model=List[FuturesContract])
async def get_futures_contracts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all available futures contracts
    """
    try:
        futures = await get_available_futures(db)
        return futures
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching futures contracts: {str(e)}")
