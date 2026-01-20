"""
Pydantic schemas - API contracts per AGENTS.md section 10
These are the authoritative typed contracts between frontend and backend
"""
from pydantic import BaseModel, Field
from typing import Literal, List
from datetime import datetime, date
from uuid import UUID


# Shared Primitive Types
Commodity = Literal["sugar", "flour"]
Scenario = Literal["with_hedge", "without_hedge"]
HedgeSessionStatus = Literal["active", "executed", "cancelled"]


# Authentication Schemas

class LoginRequest(BaseModel):
    """POST /login request"""
    username: str
    password: str


class LoginResponse(BaseModel):
    """POST /login response"""
    access_token: str
    token_type: str = "bearer"
    username: str
    customer_name: str


# Hedge Session Schemas

class HedgeSession(BaseModel):
    """Hedge session (shopping cart)"""
    id: UUID
    status: HedgeSessionStatus
    created_at: datetime
    
    class Config:
        from_attributes = True


class HedgeSessionItem(BaseModel):
    """Item in hedge session"""
    commodity: Commodity
    contract_month: date = Field(description="YYYY-MM-01 format")
    quantity: float = Field(gt=0)
    price_snapshot: float = Field(gt=0)
    
    class Config:
        from_attributes = True


class HedgeSessionItemCreate(BaseModel):
    """Create hedge session item"""
    commodity: Commodity
    contract_month: date
    quantity: float = Field(gt=0)


class HedgeSessionItemUpdate(BaseModel):
    """Update hedge session item"""
    quantity: float = Field(gt=0)


class HedgeSessionWithItems(HedgeSession):
    """Hedge session with its items"""
    items: List[HedgeSessionItem] = []


# VaR Schemas

class CommodityVaR(BaseModel):
    """VaR values for each commodity and portfolio"""
    sugar: float
    flour: float
    portfolio: float


class VaRTimelinePoint(BaseModel):
    """Single point in VaR timeline"""
    date: date
    scenario: Scenario
    var: CommodityVaR


class VaRTimelineResponse(BaseModel):
    """GET /var/timeline response"""
    confidence_level: float
    currency: str = "USD"
    timeline: List[VaRTimelinePoint]


# Execute Hedge Schemas

class ExecuteHedgeResponse(BaseModel):
    """POST /hedge-session/execute response"""
    status: Literal["executed"]
    executed_at: datetime
    final_var: CommodityVaR


# Upload Schemas

class UploadResponse(BaseModel):
    """Response for file uploads"""
    message: str
    rows_processed: int
    exposure_buckets_created: int = 0


# VaR Preview Schemas (NEW per AGENTS.md 10.9)

class VarPreviewRequest(BaseModel):
    """POST /var/preview request"""
    commodity: Commodity
    contract_month: date
    quantity: float = Field(gt=0)


class VarPreviewResponse(BaseModel):
    """POST /var/preview response"""
    delta_var: CommodityVaR
    preview_var: CommodityVaR


# Portfolio Schemas (NEW per AGENTS.md 10.10)

class ExecutedHedgeDetail(BaseModel):
    """Single executed hedge for portfolio display"""
    id: str
    commodity: Commodity
    contract_month: date
    quantity: float
    execution_price: float
    execution_date: datetime
    value: float
    status: Literal["active", "expired"]


class CommodityBreakdown(BaseModel):
    """Breakdown by commodity"""
    total_quantity: float
    total_value: float
    contracts: int


class PortfolioSummary(BaseModel):
    """Portfolio summary statistics"""
    total_positions: int
    total_quantity: float
    total_value: float


class PortfolioResponse(BaseModel):
    """GET /portfolio/executed-hedges response"""
    summary: PortfolioSummary
    hedges: List[ExecutedHedgeDetail]
    breakdown: dict[str, CommodityBreakdown]


# Market Data Schemas

class FuturesContract(BaseModel):
    """Futures contract with pricing (UPDATED per AGENTS.md 10.8)"""
    commodity: Commodity
    contract_month: date
    price: float
    contract_unit: int = Field(gt=0, description="Numeric contract size (e.g., 50000)")
    contract_unit_label: str = Field(description="Display string (e.g., '50k lbs')")
    notional: float = Field(gt=0, description="price * contract_unit")
    source: str = "market_data"


class MarketDataRefreshResponse(BaseModel):
    """POST /market-data/refresh response"""
    message: str
    commodities_updated: List[str]
    prices_added: int
    futures_contracts_updated: int


# Purchase Schema (for Excel upload)

class PurchaseData(BaseModel):
    """Purchase data from Excel"""
    commodity: str
    purchase_date: date
    delivery_start_date: date
    delivery_end_date: date
    quantity: float = Field(gt=0)
    unit: str
    purchase_price: float = Field(gt=0)


# Inventory Schema (for Excel upload)

class InventoryData(BaseModel):
    """Inventory snapshot data from Excel"""
    date: date
    commodity: str
    quantity: float = Field(ge=0)


# Error Response

class ErrorResponse(BaseModel):
    """Standard error response"""
    detail: str
