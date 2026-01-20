"""
VaR router
GET /var/timeline - Get VaR timeline (with and without hedge)
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date, timedelta
from app.database import get_db
from app.dependencies import get_current_user
from app.models.database import User
from app.models.schemas import VaRTimelineResponse, VaRTimelinePoint, CommodityVaR
from app.services.var_engine import VaREngine

router = APIRouter()


@router.get("/timeline", response_model=VaRTimelineResponse)
async def get_var_timeline(
    confidence_level: float = Query(0.95, ge=0.5, le=0.99),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get VaR timeline showing both scenarios: with_hedge and without_hedge
    
    Query Parameters:
    - confidence_level: VaR confidence level (default 0.95 for 95%)
    - start_date: Start date for timeline (default: today)
    - end_date: End date for timeline (default: 12 months from start)
    """
    # Default date range
    if not start_date:
        start_date = date.today()
    if not end_date:
        end_date = start_date + timedelta(days=365)
    
    try:
        # Create VaR engine
        var_engine = VaREngine(confidence_level=confidence_level)
        
        # Calculate VaR without hedge
        timeline_without_hedge = await var_engine.calculate_var_timeline(
            db,
            str(current_user.id),
            start_date,
            end_date,
            include_hedge=False
        )
        
        # Calculate VaR with hedge
        timeline_with_hedge = await var_engine.calculate_var_timeline(
            db,
            str(current_user.id),
            start_date,
            end_date,
            include_hedge=True
        )
        
        # Combine timelines
        timeline = timeline_without_hedge + timeline_with_hedge
        
        # Convert to response schema
        timeline_points = []
        for point in timeline:
            timeline_points.append(
                VaRTimelinePoint(
                    date=point["date"],
                    scenario=point["scenario"],
                    var=CommodityVaR(
                        sugar=point["var"]["sugar"],
                        flour=point["var"]["flour"],
                        portfolio=point["var"]["portfolio"]
                    )
                )
            )
        
        return VaRTimelineResponse(
            confidence_level=confidence_level,
            currency="USD",
            timeline=timeline_points
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating VaR: {str(e)}")
