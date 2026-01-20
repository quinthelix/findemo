"""
Futures Mock Service
Generates mock futures contracts for demo purposes
"""
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
from typing import List, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.models.database import Commodity, MarketPrice
import logging

logger = logging.getLogger(__name__)


async def generate_mock_futures(db: AsyncSession) -> Dict[str, int]:
    """
    Generate mock futures for all commodities
    Creates 1M, 3M, 6M, 9M, 12M futures with:
    - Low-price futures: decreasing price, increasing cost
    - High-price futures: increasing price, decreasing cost
    
    Returns count of futures created
    """
    # Clear existing mock futures (both high and low)
    await db.execute(
        delete(MarketPrice).where(
            MarketPrice.source.in_(['mock_futures_high', 'mock_futures_low'])
        )
    )
    await db.commit()
    
    # Get all commodities
    result = await db.execute(select(Commodity))
    commodities = result.scalars().all()
    
    if not commodities:
        logger.warning("No commodities found in database")
        return {"futures_created": 0}
    
    # Base prices per commodity (starting point)
    base_prices = {
        "sugar": 20.0,   # $ per unit
        "flour": 15.0    # $ per unit
    }
    
    today = date.today()
    futures_created = 0
    
    for commodity in commodities:
        commodity_name = commodity.name.lower()
        base_price = base_prices.get(commodity_name, 10.0)
        
        # Future durations in months
        durations = [1, 3, 6, 9, 12]
        
        for months_ahead in durations:
            contract_date = today + relativedelta(months=months_ahead)
            
            # LOW-PRICE FUTURE
            # Price decreases over time (better commodity price)
            # But cost increases (you pay more for the contract)
            low_price = base_price * (1.0 - months_ahead * 0.02)  # -2% per month
            low_cost = base_price * 0.05 * months_ahead  # Cost increases linearly
            
            # HIGH-PRICE FUTURE
            # Price increases over time (worse commodity price)
            # But cost decreases (cheaper contract)
            high_price = base_price * (1.0 + months_ahead * 0.02)  # +2% per month
            high_cost = base_price * 0.10 / months_ahead  # Cost decreases
            
            # Store both futures
            # Low-price future (stored as negative cost to distinguish)
            low_future = MarketPrice(
                commodity_id=commodity.id,
                price_date=today,
                contract_month=contract_date,
                price=low_price,
                source='mock_futures_low'
            )
            db.add(low_future)
            futures_created += 1
            
            # High-price future
            high_future = MarketPrice(
                commodity_id=commodity.id,
                price_date=today,
                contract_month=contract_date,
                price=high_price,
                source='mock_futures_high'
            )
            db.add(high_future)
            futures_created += 1
    
    await db.commit()
    
    logger.info(f"Created {futures_created} mock futures")
    return {"futures_created": futures_created}


async def get_futures_for_commodity(
    db: AsyncSession,
    commodity_id: str,
    reference_date: date
) -> Dict[str, List[Dict]]:
    """
    Get low and high futures for a commodity
    
    Returns:
    {
        "low_futures": [{contract_month, price}, ...],
        "high_futures": [{contract_month, price}, ...]
    }
    """
    # Get low futures
    low_result = await db.execute(
        select(MarketPrice)
        .where(
            MarketPrice.commodity_id == commodity_id,
            MarketPrice.source == 'mock_futures_low',
            MarketPrice.price_date <= reference_date
        )
        .order_by(MarketPrice.contract_month)
    )
    low_futures = low_result.scalars().all()
    
    # Get high futures
    high_result = await db.execute(
        select(MarketPrice)
        .where(
            MarketPrice.commodity_id == commodity_id,
            MarketPrice.source == 'mock_futures_high',
            MarketPrice.price_date <= reference_date
        )
        .order_by(MarketPrice.contract_month)
    )
    high_futures = high_result.scalars().all()
    
    return {
        "low_futures": [
            {"contract_month": f.contract_month, "price": float(f.price)}
            for f in low_futures
        ],
        "high_futures": [
            {"contract_month": f.contract_month, "price": float(f.price)}
            for f in high_futures
        ]
    }
