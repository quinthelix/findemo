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
async def get_futures_contracts_endpoint(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all available futures contracts
    
    UPDATED per AGENTS.md 10.8:
    - Now includes contract_unit (numeric)
    - Now includes contract_unit_label (display string)
    - Now includes notional (price * unit)
    
    Frontend must NOT hardcode units - use these fields
    """
    try:
        # Get base futures data
        futures = await get_available_futures(db)
        
        # Contract unit mapping (could be moved to database later)
        unit_mapping = {
            'sugar': {
                'unit': 50000,
                'label': '50k lbs'
            },
            'flour': {
                'unit': 100000,
                'label': '100k lbs'
            }
        }
        
        # Enrich with unit information
        enriched_futures = []
        for future in futures:
            # Future may be dict or object, handle both
            if isinstance(future, dict):
                commodity = future['commodity']
                contract_month = future['contract_month']
                price = future['price']
                source = future.get('source', 'market_data')
            else:
                commodity = future.commodity
                contract_month = future.contract_month
                price = future.price
                source = future.source
            
            unit_info = unit_mapping.get(commodity, {'unit': 1, 'label': 'unit'})
            
            # Create enriched contract with all required fields
            enriched_future = FuturesContract(
                commodity=commodity,
                contract_month=contract_month,
                price=price,
                contract_unit=unit_info['unit'],
                contract_unit_label=unit_info['label'],
                notional=float(price * unit_info['unit']),
                source=source
            )
            enriched_futures.append(enriched_future)
        
        return enriched_futures
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching futures contracts: {str(e)}")
