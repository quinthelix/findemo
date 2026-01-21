"""
Authentication router - POST /login
"""
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.database import User, Customer
from app.models.schemas import LoginRequest, LoginResponse
from app.services.auth_service import verify_password, create_access_token
from app.services.futures_mock_service import generate_mock_futures
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.options("/login")
async def login_options():
    """Handle CORS preflight for login endpoint"""
    return Response(status_code=200)


@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Authenticate user and return JWT token
    
    Demo credentials:
    - username: demo
    - password: demo123
    """
    # Find user by username
    result = await db.execute(select(User).where(User.username == request.username))
    user = result.scalar_one_or_none()
    
    # Verify user exists and password is correct
    if user is None or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get customer name
    customer_result = await db.execute(select(Customer).where(Customer.id == user.customer_id))
    customer = customer_result.scalar_one_or_none()
    
    # Create access token with customer_id
    access_token = create_access_token(data={
        "sub": str(user.id),
        "customer_id": str(user.customer_id)
    })
    
    # Generate mock futures on login (with customer_id for realistic pricing)
    try:
        await generate_mock_futures(db, customer_id=str(user.customer_id))
        logger.info(f"Generated mock futures for user {user.username}")
    except Exception as e:
        logger.error(f"Failed to generate futures on login: {e}")
        # Don't fail login if futures generation fails
    
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        username=user.username,
        customer_name=customer.name if customer else "Unknown"
    )
