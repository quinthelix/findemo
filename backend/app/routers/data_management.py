"""
Data Management Router
POST /data/reset - Reset all transactional data for current customer
POST /data/seed - Re-seed demo data (demo customer only)
GET /data/status - Get data statistics for current customer
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from datetime import date
from app.database import get_db
from app.dependencies import get_current_user
from app.models.database import (
    User, Customer, Purchase, InventorySnapshot, ExposureBucket,
    HedgeSession, ExecutedHedge, Commodity
)
from app.services.exposure_service import rebuild_exposure_buckets

router = APIRouter()


@router.post("/reset")
async def reset_customer_data(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Reset all transactional data for current customer
    Keeps users and commodities (reference data)
    Clears: purchases, inventory, exposure buckets, hedge sessions, executed hedges
    """
    customer_id = current_user.customer_id
    
    # Delete all transactional data for this customer
    deleted_counts = {}
    
    # Delete executed hedges
    result = await db.execute(
        delete(ExecutedHedge).where(ExecutedHedge.customer_id == customer_id)
    )
    deleted_counts["executed_hedges"] = result.rowcount
    
    # Delete hedge sessions (cascade will delete items)
    result = await db.execute(
        delete(HedgeSession).where(HedgeSession.customer_id == customer_id)
    )
    deleted_counts["hedge_sessions"] = result.rowcount
    
    # Delete exposure buckets
    result = await db.execute(
        delete(ExposureBucket).where(ExposureBucket.customer_id == customer_id)
    )
    deleted_counts["exposure_buckets"] = result.rowcount
    
    # Delete inventory snapshots
    result = await db.execute(
        delete(InventorySnapshot).where(InventorySnapshot.customer_id == customer_id)
    )
    deleted_counts["inventory_snapshots"] = result.rowcount
    
    # Delete purchases
    result = await db.execute(
        delete(Purchase).where(Purchase.customer_id == customer_id)
    )
    deleted_counts["purchases"] = result.rowcount
    
    await db.commit()
    
    return {
        "message": f"All data reset for customer",
        "deleted": deleted_counts
    }


@router.post("/seed")
async def seed_demo_data(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Re-seed demo data for demo customer only
    Use after /data/reset to restore sample data
    """
    customer_id = current_user.customer_id
    
    # Check if this is demo customer
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id)
    )
    customer = result.scalar_one_or_none()
    
    if not customer or not customer.is_demo:
        raise HTTPException(
            status_code=403,
            detail="Seeding is only allowed for demo customer"
        )
    
    # Get commodity IDs
    result = await db.execute(select(Commodity))
    commodities = {c.name: c.id for c in result.scalars().all()}
    
    sugar_id = commodities.get('sugar')
    flour_id = commodities.get('flour')
    
    if not sugar_id or not flour_id:
        raise HTTPException(status_code=500, detail="Commodities not found")
    
    # Insert purchases
    purchases_data = [
        # Sugar purchases
        (sugar_id, '2025-07-15', '2025-08-01', '2025-10-31', 50000, 'kg', 0.45),
        (sugar_id, '2025-08-20', '2025-09-01', '2025-11-30', 60000, 'kg', 0.48),
        (sugar_id, '2025-09-10', '2025-10-01', '2025-12-31', 55000, 'kg', 0.46),
        (sugar_id, '2025-10-05', '2025-11-01', '2026-01-31', 70000, 'kg', 0.50),
        (sugar_id, '2025-11-12', '2025-12-01', '2026-02-28', 65000, 'kg', 0.49),
        (sugar_id, '2025-12-01', '2026-01-01', '2026-03-31', 75000, 'kg', 0.51),
        (sugar_id, '2026-01-10', '2026-02-01', '2026-04-30', 80000, 'kg', 0.52),
        # Flour purchases
        (flour_id, '2025-07-20', '2025-08-01', '2025-10-31', 40000, 'kg', 0.35),
        (flour_id, '2025-08-25', '2025-09-01', '2025-11-30', 45000, 'kg', 0.37),
        (flour_id, '2025-09-15', '2025-10-01', '2025-12-31', 42000, 'kg', 0.36),
        (flour_id, '2025-10-10', '2025-11-01', '2026-01-31', 50000, 'kg', 0.38),
        (flour_id, '2025-11-18', '2025-12-01', '2026-02-28', 48000, 'kg', 0.37),
        (flour_id, '2025-12-05', '2026-01-01', '2026-03-31', 55000, 'kg', 0.39),
        (flour_id, '2026-01-15', '2026-02-01', '2026-04-30', 60000, 'kg', 0.40),
    ]
    
    for commodity_id, pdate, dstart, dend, qty, unit, price in purchases_data:
        purchase = Purchase(
            customer_id=customer_id,
            commodity_id=commodity_id,
            purchase_date=date.fromisoformat(pdate),
            delivery_start_date=date.fromisoformat(dstart),
            delivery_end_date=date.fromisoformat(dend),
            quantity=qty,
            unit=unit,
            purchase_price=price
        )
        db.add(purchase)
    
    # Insert inventory snapshots
    inventory_data = [
        (sugar_id, '2026-01-20', 15000),
        (flour_id, '2026-01-20', 12000),
    ]
    
    for commodity_id, inv_date, qty in inventory_data:
        snapshot = InventorySnapshot(
            customer_id=customer_id,
            commodity_id=commodity_id,
            date=date.fromisoformat(inv_date),
            quantity=qty
        )
        db.add(snapshot)
    
    await db.commit()
    
    # Rebuild exposure buckets
    buckets_created = await rebuild_exposure_buckets(db)
    
    return {
        "message": "Demo data seeded successfully",
        "purchases_created": len(purchases_data),
        "inventory_snapshots_created": len(inventory_data),
        "exposure_buckets_created": buckets_created
    }


@router.get("/status")
async def get_data_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get data upload status for current customer
    Used by Data Upload screen to show upload state
    Returns: purchases, inventory, and market_data status with timestamps
    """
    from app.models.database import MarketPrice
    
    customer_id = current_user.customer_id
    
    # Check purchases
    result = await db.execute(
        select(Purchase)
        .where(Purchase.customer_id == customer_id)
        .order_by(Purchase.created_at.desc())
        .limit(1)
    )
    last_purchase = result.scalar_one_or_none()
    
    purchases_uploaded = last_purchase is not None
    purchases_timestamp = last_purchase.created_at.isoformat() if last_purchase else None
    
    # Check inventory
    result = await db.execute(
        select(InventorySnapshot)
        .where(InventorySnapshot.customer_id == customer_id)
        .order_by(InventorySnapshot.created_at.desc())
        .limit(1)
    )
    last_inventory = result.scalar_one_or_none()
    
    inventory_uploaded = last_inventory is not None
    inventory_timestamp = last_inventory.created_at.isoformat() if last_inventory else None
    
    # Check market data (global, not customer-specific)
    result = await db.execute(
        select(MarketPrice)
        .order_by(MarketPrice.created_at.desc())
        .limit(1)
    )
    last_market_price = result.scalar_one_or_none()
    
    market_data_available = last_market_price is not None
    market_data_timestamp = last_market_price.created_at.isoformat() if last_market_price else None
    
    return {
        "purchases": {
            "uploaded": purchases_uploaded,
            "last_uploaded_at": purchases_timestamp
        },
        "inventory": {
            "uploaded": inventory_uploaded,
            "last_uploaded_at": inventory_timestamp
        },
        "market_data": {
            "available": market_data_available,
            "last_refreshed_at": market_data_timestamp,
            "source": "Yahoo Finance / Stooq"
        }
    }
