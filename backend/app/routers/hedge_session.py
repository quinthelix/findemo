"""
Hedge session router - Shopping cart for hedge decisions
POST /hedge-session/create - Create new session
GET /hedge-session/current - Get current active session
POST /hedge-session/add - Add item to session
POST /hedge-session/update - Update item quantity
DELETE /hedge-session/remove - Remove item from session
POST /hedge-session/execute - Execute hedge (commit)
"""
from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from uuid import UUID
from app.database import get_db
from app.dependencies import get_current_user
from app.models.database import (
    User, HedgeSession, HedgeSessionItem, Commodity, MarketPrice, ExecutedHedge
)
from app.models.schemas import (
    HedgeSession as HedgeSessionSchema,
    HedgeSessionWithItems,
    HedgeSessionItem as HedgeSessionItemSchema,
    HedgeSessionItemCreate,
    HedgeSessionItemUpdate,
    ExecuteHedgeResponse,
    CommodityVaR
)
from app.services.var_engine import VaREngine
from datetime import date

router = APIRouter()


@router.post("/create", response_model=HedgeSessionSchema)
async def create_hedge_session(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create new active hedge session
    Only one active session allowed per user
    """
    # Check if user already has an active session
    result = await db.execute(
        select(HedgeSession).where(
            HedgeSession.user_id == current_user.id,
            HedgeSession.status == 'active'
        )
    )
    existing_session = result.scalar_one_or_none()
    
    if existing_session:
        return existing_session
    
    # Create new session
    session = HedgeSession(
        customer_id=current_user.customer_id,
        user_id=current_user.id,
        status='active'
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    
    return session


@router.get("/current", response_model=HedgeSessionWithItems)
async def get_current_session(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get current active hedge session with items
    """
    result = await db.execute(
        select(HedgeSession).where(
            HedgeSession.user_id == current_user.id,
            HedgeSession.status == 'active'
        )
    )
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="No active hedge session found")
    
    # Get items
    result = await db.execute(
        select(HedgeSessionItem, Commodity)
        .join(Commodity)
        .where(HedgeSessionItem.hedge_session_id == session.id)
    )
    
    items = []
    for item, commodity in result:
        items.append(HedgeSessionItemSchema(
            commodity=commodity.name,
            contract_month=item.contract_month,
            future_type=item.future_type,
            quantity=float(item.quantity),
            price_snapshot=float(item.price_snapshot)
        ))
    
    return HedgeSessionWithItems(
        id=session.id,
        status=session.status,
        created_at=session.created_at,
        items=items
    )


@router.post("/add", response_model=HedgeSessionItemSchema)
async def add_hedge_item(
    item_data: HedgeSessionItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Add item to active hedge session
    """
    # Get or create active session
    result = await db.execute(
        select(HedgeSession).where(
            HedgeSession.user_id == current_user.id,
            HedgeSession.status == 'active'
        )
    )
    session = result.scalar_one_or_none()
    
    if not session:
        # Create new session
        session = HedgeSession(
            customer_id=current_user.customer_id,
            user_id=current_user.id,
            status='active'
        )
        db.add(session)
        await db.flush()
    
    # Get commodity
    result = await db.execute(
        select(Commodity).where(Commodity.name == item_data.commodity)
    )
    commodity = result.scalar_one_or_none()
    
    if not commodity:
        raise HTTPException(status_code=404, detail=f"Commodity {item_data.commodity} not found")
    
    # Get current price for snapshot
    result = await db.execute(
        select(MarketPrice).where(
            MarketPrice.commodity_id == commodity.id,
            MarketPrice.contract_month == item_data.contract_month
        ).order_by(MarketPrice.price_date.desc()).limit(1)
    )
    market_price = result.scalar_one_or_none()
    
    if not market_price:
        raise HTTPException(
            status_code=404,
            detail=f"No price found for {item_data.commodity} contract {item_data.contract_month}"
        )
    
    # Check if item already exists (commodity + contract_month + future_type = unique)
    result = await db.execute(
        select(HedgeSessionItem).where(
            HedgeSessionItem.hedge_session_id == session.id,
            HedgeSessionItem.commodity_id == commodity.id,
            HedgeSessionItem.contract_month == item_data.contract_month,
            HedgeSessionItem.future_type == item_data.future_type
        )
    )
    existing_item = result.scalar_one_or_none()
    
    if existing_item:
        # Update quantity and price
        existing_item.quantity = item_data.quantity
        existing_item.price_snapshot = float(market_price.price)
        await db.commit()
        await db.refresh(existing_item)
        item = existing_item
    else:
        # Create new item
        item = HedgeSessionItem(
            hedge_session_id=session.id,
            commodity_id=commodity.id,
            contract_month=item_data.contract_month,
            future_type=item_data.future_type,
            quantity=item_data.quantity,
            price_snapshot=float(market_price.price)
        )
        db.add(item)
        await db.commit()
        await db.refresh(item)
    
    return HedgeSessionItemSchema(
        commodity=commodity.name,
        contract_month=item.contract_month,
        future_type=item.future_type,
        quantity=float(item.quantity),
        price_snapshot=float(item.price_snapshot)
    )


@router.post("/update/{commodity}/{contract_month}/{future_type}", response_model=HedgeSessionItemSchema)
async def update_hedge_item(
    commodity: str,
    contract_month: date,
    future_type: str,
    update_data: HedgeSessionItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update hedge item quantity
    """
    # Get active session
    result = await db.execute(
        select(HedgeSession).where(
            HedgeSession.user_id == current_user.id,
            HedgeSession.status == 'active'
        )
    )
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="No active hedge session found")
    
    # Get commodity
    result = await db.execute(
        select(Commodity).where(Commodity.name == commodity)
    )
    commodity_obj = result.scalar_one_or_none()
    
    if not commodity_obj:
        raise HTTPException(status_code=404, detail=f"Commodity {commodity} not found")
    
    # Get item
    result = await db.execute(
        select(HedgeSessionItem).where(
            HedgeSessionItem.hedge_session_id == session.id,
            HedgeSessionItem.commodity_id == commodity_obj.id,
            HedgeSessionItem.contract_month == contract_month,
            HedgeSessionItem.future_type == future_type
        )
    )
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(status_code=404, detail="Hedge item not found")
    
    # Update quantity
    item.quantity = update_data.quantity
    await db.commit()
    await db.refresh(item)
    
    return HedgeSessionItemSchema(
        commodity=commodity,
        contract_month=item.contract_month,
        future_type=item.future_type,
        quantity=float(item.quantity),
        price_snapshot=float(item.price_snapshot)
    )


@router.delete("/remove/{commodity}/{contract_month}/{future_type}")
async def remove_hedge_item(
    commodity: str,
    contract_month: date,
    future_type: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Remove item from hedge session
    """
    # Get active session
    result = await db.execute(
        select(HedgeSession).where(
            HedgeSession.user_id == current_user.id,
            HedgeSession.status == 'active'
        )
    )
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="No active hedge session found")
    
    # Get commodity
    result = await db.execute(
        select(Commodity).where(Commodity.name == commodity)
    )
    commodity_obj = result.scalar_one_or_none()
    
    if not commodity_obj:
        raise HTTPException(status_code=404, detail=f"Commodity {commodity} not found")
    
    # Get and delete item
    result = await db.execute(
        select(HedgeSessionItem).where(
            HedgeSessionItem.hedge_session_id == session.id,
            HedgeSessionItem.commodity_id == commodity_obj.id,
            HedgeSessionItem.contract_month == contract_month,
            HedgeSessionItem.future_type == future_type
        )
    )
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(status_code=404, detail="Hedge item not found")
    
    await db.delete(item)
    await db.commit()
    
    return {"message": "Hedge item removed successfully"}


@router.post("/execute", response_model=ExecuteHedgeResponse)
async def execute_hedge(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Execute hedge session - commit all items to executed_hedges
    This is final and immutable
    """
    # Get active session
    result = await db.execute(
        select(HedgeSession).where(
            HedgeSession.user_id == current_user.id,
            HedgeSession.status == 'active'
        )
    )
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="No active hedge session found")
    
    # Get items
    result = await db.execute(
        select(HedgeSessionItem).where(
            HedgeSessionItem.hedge_session_id == session.id
        )
    )
    items = result.scalars().all()
    
    if not items:
        raise HTTPException(status_code=400, detail="Cannot execute empty hedge session")
    
    # Create executed hedges
    execution_time = datetime.now()
    for item in items:
        executed_hedge = ExecutedHedge(
            commodity_id=item.commodity_id,
            contract_month=item.contract_month,
            quantity=item.quantity,
            execution_price=item.price_snapshot,
            execution_date=execution_time,
            hedge_session_id=session.id
        )
        db.add(executed_hedge)
    
    # Mark session as executed
    session.status = 'executed'
    await db.commit()
    
    # Calculate final VaR with executed hedges
    var_engine = VaREngine(confidence_level=0.95)
    start_date = date.today()
    end_date = date(start_date.year + 1, start_date.month, start_date.day)
    
    timeline = await var_engine.calculate_var_timeline(
        db,
        str(current_user.id),
        start_date,
        end_date,
        include_hedge=True
    )
    
    final_var = timeline[0]["var"] if timeline else {"sugar": 0, "flour": 0, "portfolio": 0}
    
    return ExecuteHedgeResponse(
        status="executed",
        executed_at=execution_time,
        final_var=CommodityVaR(
            sugar=final_var["sugar"],
            flour=final_var["flour"],
            portfolio=final_var["portfolio"]
        )
    )
