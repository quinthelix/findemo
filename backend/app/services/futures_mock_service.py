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


async def check_futures_freshness(db: AsyncSession, customer_id: str = None) -> bool:
    """
    Check if existing futures are fresh (created today) AND customer has data
    Returns True if futures need regeneration or deletion
    
    Args:
        customer_id: Customer to check purchases for (if provided)
    
    Returns:
        True if futures need regeneration or deletion
    """
    from app.models.database import Purchase
    from sqlalchemy import func
    
    today = date.today()
    
    # Check if futures exist
    result = await db.execute(
        select(MarketPrice.price_date)
        .where(MarketPrice.source.in_(['mock_futures_high', 'mock_futures_low']))
        .limit(1)
    )
    price_date = result.scalar_one_or_none()
    
    if not price_date:
        # No futures exist
        return True
    
    # Check if customer has purchases (if customer_id provided)
    if customer_id:
        purchase_count_result = await db.execute(
            select(func.count(Purchase.id))
            .where(Purchase.customer_id == customer_id)
        )
        purchase_count = purchase_count_result.scalar_one()
        
        if purchase_count == 0:
            # Customer has no purchases, futures should be cleared
            return True
    
    # Check if futures were created today
    return price_date != today


async def generate_mock_futures(db: AsyncSession, customer_id: str = None, force: bool = False) -> Dict[str, int]:
    """
    Generate mock futures ONLY for commodities with purchase history
    Creates 1M, 3M, 6M, 9M, 12M futures FROM TODAY
    
    - Low-price futures: decreasing price, increasing cost
    - High-price futures: increasing price, decreasing cost
    
    Args:
        customer_id: Required to base futures on actual purchase data
        force: If False, only regenerate if futures are stale (default behavior)
    
    Returns count of futures created
    """
    from app.models.database import Purchase
    from sqlalchemy import func
    
    if not customer_id:
        logger.warning("Cannot generate futures without customer_id")
        return {"futures_created": 0}
    
    # Check if regeneration is needed (unless forced)
    if not force:
        needs_regen = await check_futures_freshness(db)
        if not needs_regen:
            logger.info("Futures are fresh, skipping regeneration")
            return {"futures_created": 0, "skipped": True}
    
    # Clear existing mock futures (both high and low)
    await db.execute(
        delete(MarketPrice).where(
            MarketPrice.source.in_(['mock_futures_high', 'mock_futures_low'])
        )
    )
    await db.commit()
    
    # Get ONLY commodities that this customer has purchased
    # Group by commodity and get average price
    purchases_result = await db.execute(
        select(
            Purchase.commodity_id,
            func.avg(Purchase.purchase_price).label('avg_price'),
            func.count(Purchase.id).label('purchase_count')
        )
        .where(Purchase.customer_id == customer_id)
        .group_by(Purchase.commodity_id)
    )
    purchase_data = purchases_result.all()
    
    if not purchase_data:
        logger.info(f"No purchases found for customer {customer_id}, futures cleared")
        return {"futures_created": 0, "cleared": True}
    
    # Get commodity details for these purchases
    commodity_ids = [p.commodity_id for p in purchase_data]
    commodities_result = await db.execute(
        select(Commodity).where(Commodity.id.in_(commodity_ids))
    )
    commodities = {c.id: c for c in commodities_result.scalars().all()}
    
    # Build base prices from actual purchase history
    base_prices = {}
    for purchase_row in purchase_data:
        commodity = commodities.get(purchase_row.commodity_id)
        if commodity:
            base_prices[purchase_row.commodity_id] = float(purchase_row.avg_price)
            logger.info(
                f"Commodity {commodity.name}: base price ${purchase_row.avg_price:.2f} "
                f"from {purchase_row.purchase_count} purchases"
            )
    
    today = date.today()
    futures_created = 0
    
    # Generate futures ONLY for commodities with purchase history
    for commodity_id, base_price in base_prices.items():
        commodity = commodities.get(commodity_id)
        if not commodity:
            continue
        
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
