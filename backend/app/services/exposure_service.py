"""
Exposure bucketing service
Expands purchases into monthly exposure buckets
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.models.database import Purchase, ExposureBucket, Commodity
from app.utils.date_utils import get_months_between, get_month_start
from typing import List
import logging

logger = logging.getLogger(__name__)


async def create_exposure_buckets_for_purchase(
    db: AsyncSession,
    purchase: Purchase
) -> int:
    """
    Create monthly exposure buckets for a single purchase
    Returns number of buckets created
    """
    # Get all months in the delivery period
    months = get_months_between(
        purchase.delivery_start_date,
        purchase.delivery_end_date
    )
    
    if not months:
        logger.warning(f"No months found for purchase {purchase.id}")
        return 0
    
    # Distribute quantity evenly across months
    quantity_per_month = float(purchase.quantity) / len(months)
    
    buckets_created = 0
    for month in months:
        bucket = ExposureBucket(
            customer_id=purchase.customer_id,
            commodity_id=purchase.commodity_id,
            bucket_month=month,
            quantity=quantity_per_month,
            source_purchase_id=purchase.id
        )
        db.add(bucket)
        buckets_created += 1
    
    return buckets_created


async def rebuild_exposure_buckets(db: AsyncSession, customer_id: str = None) -> int:
    """
    Rebuild all exposure buckets from scratch
    Deletes existing buckets and recreates from purchases
    If customer_id provided, only rebuild for that customer
    Returns total number of buckets created
    """
    # Delete existing exposure buckets
    if customer_id:
        await db.execute(delete(ExposureBucket).where(ExposureBucket.customer_id == customer_id))
    else:
        await db.execute(delete(ExposureBucket))
    
    # Get purchases to rebuild
    if customer_id:
        result = await db.execute(select(Purchase).where(Purchase.customer_id == customer_id))
    else:
        result = await db.execute(select(Purchase))
    
    purchases = result.scalars().all()
    
    total_buckets = 0
    for purchase in purchases:
        buckets_created = await create_exposure_buckets_for_purchase(db, purchase)
        total_buckets += buckets_created
    
    await db.commit()
    
    logger.info(f"Rebuilt {total_buckets} exposure buckets from {len(purchases)} purchases")
    return total_buckets


async def get_exposure_summary(db: AsyncSession) -> dict:
    """
    Get summary of exposure by commodity and month
    """
    result = await db.execute(
        select(ExposureBucket, Commodity)
        .join(Commodity)
        .order_by(Commodity.name, ExposureBucket.bucket_month)
    )
    
    summary = {}
    for bucket, commodity in result:
        commodity_name = commodity.name
        if commodity_name not in summary:
            summary[commodity_name] = {}
        
        month_str = bucket.bucket_month.strftime("%Y-%m")
        if month_str not in summary[commodity_name]:
            summary[commodity_name][month_str] = 0
        
        summary[commodity_name][month_str] += float(bucket.quantity)
    
    return summary
