"""
Portfolio router - NEW per AGENTS.md 10.10
GET /portfolio/executed-hedges - Get all executed hedges for portfolio display
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, date
from app.database import get_db
from app.dependencies import get_current_user
from app.models.database import User, ExecutedHedge, Commodity
from app.models.schemas import PortfolioResponse, ExecutedHedgeDetail, CommodityBreakdown, PortfolioSummary

router = APIRouter()


@router.get("/executed-hedges", response_model=PortfolioResponse)
async def get_executed_hedges(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all executed hedges for this customer with summary and breakdown
    
    Per AGENTS.md 10.10:
    - Returns summary statistics (total positions, quantity, value)
    - Returns list of executed hedges with status (active/expired)
    - Returns breakdown by commodity
    
    Used by Portfolio page to display executed trades
    """
    customer_id = current_user.customer_id
    
    try:
        # Get all executed hedges for this customer
        result = await db.execute(
            select(ExecutedHedge)
            .where(ExecutedHedge.customer_id == customer_id)
            .order_by(ExecutedHedge.execution_date.desc())
        )
        hedges = result.scalars().all()
        
        if not hedges:
            # Return empty portfolio
            return PortfolioResponse(
                summary=PortfolioSummary(
                    total_positions=0,
                    total_quantity=0.0,
                    total_value=0.0
                ),
                hedges=[],
                breakdown={
                    "sugar": CommodityBreakdown(total_quantity=0.0, total_value=0.0, contracts=0),
                    "flour": CommodityBreakdown(total_quantity=0.0, total_value=0.0, contracts=0)
                }
            )
        
        # Get commodity names mapping
        result = await db.execute(select(Commodity))
        commodities = {str(c.id): c.name for c in result.scalars().all()}
        
        # Calculate summary
        total_positions = len(hedges)
        total_quantity = sum(float(h.quantity) for h in hedges)
        total_value = sum(float(h.quantity * h.execution_price) for h in hedges)
        
        # Build hedge details list
        hedges_data = []
        now = datetime.now()
        
        for h in hedges:
            # Get commodity name
            commodity_name = commodities.get(str(h.commodity_id), 'unknown')
            
            # Determine status (active if contract_month is in the future)
            contract_date = datetime.combine(h.contract_month, datetime.min.time())
            status = 'active' if contract_date > now else 'expired'
            
            hedges_data.append(ExecutedHedgeDetail(
                id=str(h.id),
                commodity=commodity_name,  # type: ignore
                contract_month=h.contract_month,
                quantity=float(h.quantity),
                execution_price=float(h.execution_price),
                execution_date=h.execution_date,
                value=float(h.quantity * h.execution_price),
                status=status  # type: ignore
            ))
        
        # Calculate breakdown by commodity
        sugar_hedges = [h for h in hedges if commodities.get(str(h.commodity_id)) == 'sugar']
        flour_hedges = [h for h in hedges if commodities.get(str(h.commodity_id)) == 'flour']
        
        sugar_breakdown = CommodityBreakdown(
            total_quantity=sum(float(h.quantity) for h in sugar_hedges),
            total_value=sum(float(h.quantity * h.execution_price) for h in sugar_hedges),
            contracts=len(sugar_hedges)
        )
        
        flour_breakdown = CommodityBreakdown(
            total_quantity=sum(float(h.quantity) for h in flour_hedges),
            total_value=sum(float(h.quantity * h.execution_price) for h in flour_hedges),
            contracts=len(flour_hedges)
        )
        
        return PortfolioResponse(
            summary=PortfolioSummary(
                total_positions=total_positions,
                total_quantity=total_quantity,
                total_value=total_value
            ),
            hedges=hedges_data,
            breakdown={
                "sugar": sugar_breakdown,
                "flour": flour_breakdown
            }
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving portfolio: {str(e)}"
        )
