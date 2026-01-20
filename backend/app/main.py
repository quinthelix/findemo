"""
FastAPI main application entry point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="Demo web application for commodity hedging and risk (VaR) tools",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware - Allow both Docker (3000) and local npm (5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Docker frontend
        "http://localhost:5173",  # Local npm dev server
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Commodity Hedging & VaR Demo API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


# Import and include routers
from app.routers import auth, upload, market_data, var, hedge_session, data_management, portfolio

app.include_router(auth.router, tags=["Authentication"])
app.include_router(upload.router, prefix="/upload", tags=["Upload"])
app.include_router(market_data.router, prefix="/market-data", tags=["Market Data"])
app.include_router(var.router, prefix="/var", tags=["VaR"])
app.include_router(hedge_session.router, prefix="/hedge-session", tags=["Hedge Session"])
app.include_router(data_management.router, prefix="/data", tags=["Data Management"])
app.include_router(portfolio.router, prefix="/portfolio", tags=["Portfolio"])
