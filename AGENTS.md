# AGENTS.md — Commodity Hedging & VaR Demo Application

## 1. Purpose & Scope

This project is a **demo web application** for a company selling **commodity hedging and risk (VaR) tools**.

The demo simulates:
- Multi-customer platform (currently: one demo customer "HedgyMunchy")
- Two commodities (Sugar, Flour)
- Historic purchases and inventory
- Forward price risk
- Dynamic VaR and portfolio VaR
- User-driven futures hedging decisions (transaction-based workflow)

The goal is **decision support**, not trade execution accuracy.

---

## 2. High-Level Architecture

The system is **containerized and modular**, designed to run locally using **Docker Compose**.

Each major responsibility runs in its own container.

```
┌────────────┐
│  Frontend  │  React (UI, charts, decisions)
│  :3000     │  TypeScript + Vite
└─────┬──────┘
      │ REST / JSON
      │ JWT Auth
┌─────▼──────┐
│  Backend   │  Python (FastAPI)
│  :8000     │  VaR engine, ingestion, logic
└─────┬──────┘
      │ SQL (asyncpg)
┌─────▼──────┐
│ PostgreSQL │  Central state & history
│  :5432     │  Multi-tenant schema
└────────────┘
```

---

## 3. Technology Choices

### Frontend
- **React 18 + TypeScript**
- Bundler: **Vite**
- Charting: **Recharts** (line charts, area charts)
- State management: React hooks (useState, useEffect)
- Routing: **react-router-dom v6**
- Auth: JWT stored in localStorage
- HTTP: **Axios**

### Backend
- **Python 3.11**
- **FastAPI** for APIs
- **SQLAlchemy 2.0** (async ORM)
- **asyncpg** (PostgreSQL async driver)
- **NumPy / Pandas** for risk calculations
- **yfinance** for market data (Yahoo Finance)
- **passlib + bcrypt** for password hashing
- **python-jose** for JWT

### Database
- **PostgreSQL 15**
- Multi-tenant schema with `customer_id` isolation
- Row-level security via application layer

### Local Environment
- **Docker Compose**
- Three containers: `postgres`, `backend`, `frontend`
- Hot reload enabled for development

---

## 4. Containers & Responsibilities

### 4.1 Frontend Container (`frontend`)

**Port**: 3000 → 5173 (Vite dev server)

**Responsibilities**
- User login (JWT authentication)
- Excel upload UI
- Price projection visualization
- Futures selection and transaction building
- Trade execution confirmation
- Portfolio history (mock data)

**Reads from Backend**
- Price projections with futures overlay
- Available futures contracts
- Current hedge transaction (session)
- Data upload status
- Executed hedges (portfolio)

**Writes to Backend**
- Excel uploads (purchases, inventory)
- Transaction items (add/update/remove)
- Execute transaction request
- Data reset operations

---

### 4.2 Backend API Container (`backend`)

**Port**: 8000

**Responsibilities**
- Authentication (JWT)
- Excel ingestion & validation
- Market data ingestion (Yahoo Finance + fallback)
- Exposure bucketing (monthly)
- Mock futures generation
- Price projection with futures overlay
- Hedge transaction (session) management
- Transaction execution
- Data management (reset, seed, status)

**Does NOT**
- Render UI
- Store session state in memory (all in DB)
- Perform real market execution
- Compute VaR (placeholder only - not fully implemented)

---

### 4.3 Database Container (`postgres`)

**Port**: 5432

**Responsibilities**
- Persistent storage
- Source of truth
- Multi-tenant data isolation

---

## 5. Database Structure (Multi-Tenant)

### Core Tables

#### `customers`
Top-level tenant entity.
```sql
id                UUID PRIMARY KEY
name              VARCHAR(100) UNIQUE NOT NULL
is_demo           BOOLEAN DEFAULT false
created_at        TIMESTAMP WITH TIME ZONE
```

#### `users`
Users belong to a customer.
```sql
id                UUID PRIMARY KEY
customer_id       UUID NOT NULL REFERENCES customers
username          VARCHAR(50) NOT NULL
password_hash     VARCHAR(255) NOT NULL
created_at        TIMESTAMP WITH TIME ZONE
UNIQUE(customer_id, username)
```

#### `commodities`
Global reference data (sugar, flour).
```sql
id                UUID PRIMARY KEY
name              VARCHAR(50) UNIQUE NOT NULL
unit              VARCHAR(20) NOT NULL
created_at        TIMESTAMP WITH TIME ZONE
```

#### `purchases`
Customer-specific historic procurement.
```sql
id                      UUID PRIMARY KEY
customer_id             UUID NOT NULL REFERENCES customers
commodity_id            UUID NOT NULL REFERENCES commodities
purchase_date           DATE NOT NULL
delivery_start_date     DATE NOT NULL
delivery_end_date       DATE NOT NULL
quantity                DECIMAL(15, 3) NOT NULL
unit                    VARCHAR(20) NOT NULL
purchase_price          DECIMAL(15, 2) NOT NULL
created_at              TIMESTAMP WITH TIME ZONE
```

**Note**: Schema has additional fields (`price_type`, `payment_date`) added but not fully utilized.

#### `inventory_snapshots`
Customer-specific inventory levels.
```sql
id                UUID PRIMARY KEY
customer_id       UUID NOT NULL REFERENCES customers
date              DATE NOT NULL
commodity_id      UUID NOT NULL REFERENCES commodities
quantity          DECIMAL(15, 3) NOT NULL
created_at        TIMESTAMP WITH TIME ZONE
```

#### `market_prices`
**Shared across all customers** (market data is universal).
```sql
id                UUID PRIMARY KEY
commodity_id      UUID NOT NULL REFERENCES commodities
price_date        DATE NOT NULL
contract_month    DATE
price             DECIMAL(15, 2) NOT NULL
cost              DECIMAL(15, 2)  -- Cost to purchase future (1-3 cents total)
source            VARCHAR(50) NOT NULL
created_at        TIMESTAMP WITH TIME ZONE
```

**Sources**:
- `yahoo_finance`: Historical spot prices
- `mock_futures_low`: Low-price futures (better lock-in, higher cost: 3 cents)
- `mock_futures_high`: High-price futures (worse lock-in, lower cost: 1 cent)

**IMPORTANT**: `cost` field represents **total fixed contract cost** in cents (not per-unit), distinct from `price` which is the commodity price per unit the future locks in.

#### `exposure_buckets`
Customer-specific monthly exposure (derived from purchases).
```sql
id                      UUID PRIMARY KEY
customer_id             UUID NOT NULL REFERENCES customers
commodity_id            UUID NOT NULL REFERENCES commodities
bucket_month            DATE NOT NULL
quantity                DECIMAL(15, 3) NOT NULL
source_purchase_id      UUID REFERENCES purchases
created_at              TIMESTAMP WITH TIME ZONE
```

#### `hedge_sessions`
Active transaction session (shopping cart).
```sql
id                UUID PRIMARY KEY
customer_id       UUID NOT NULL REFERENCES customers
user_id           UUID NOT NULL REFERENCES users
status            VARCHAR(20) NOT NULL CHECK (status IN ('active', 'executed', 'cancelled'))
created_at        TIMESTAMP WITH TIME ZONE
updated_at        TIMESTAMP WITH TIME ZONE
```

#### `hedge_session_items`
User-selected futures (not yet executed).
```sql
id                  UUID PRIMARY KEY
hedge_session_id    UUID NOT NULL REFERENCES hedge_sessions
commodity_id        UUID NOT NULL REFERENCES commodities
contract_month      DATE NOT NULL
future_type         VARCHAR(10) NOT NULL CHECK (future_type IN ('high', 'low'))
quantity            DECIMAL(15, 3) NOT NULL
price_snapshot      DECIMAL(15, 2) NOT NULL  -- Commodity price the future locks in
future_cost         DECIMAL(15, 2)  -- Total contract cost in cents (1-3 cents)
created_at          TIMESTAMP WITH TIME ZONE
```

**IMPORTANT**: `future_type` field ensures unique identification of futures (commodity + contract_month + future_type).

#### `executed_hedges`
Persisted after transaction execution.
```sql
id                  UUID PRIMARY KEY
customer_id         UUID NOT NULL REFERENCES customers
commodity_id        UUID NOT NULL REFERENCES commodities
contract_month      DATE NOT NULL
quantity            DECIMAL(15, 3) NOT NULL
execution_price     DECIMAL(15, 2) NOT NULL
execution_date      TIMESTAMP WITH TIME ZONE
hedge_session_id    UUID REFERENCES hedge_sessions
```

**Note**: Does not currently store `future_type` or `future_cost` (should be added).

---

## 6. Backend API Endpoints (Current State)

### 6.1 Authentication (`/auth.py`)

```
POST /login
```

**Request**:
```json
{
  "username": "string",
  "password": "string"
}
```

**Response**:
```json
{
  "access_token": "string",
  "token_type": "bearer",
  "username": "string",
  "customer_name": "string"
}
```

---

### 6.2 Data Upload (`/upload.py`)

Used by Data Upload screen.

```
POST /upload/purchases
POST /upload/inventory
```

**Request**: Multipart form data with Excel file

**Behavior**:
- Parses Excel (expects specific column names)
- Validates data
- Clears existing customer data of that type
- Inserts new data
- Rebuilds exposure buckets (for purchases)
- Triggers futures generation (for purchases)

**Issues**:
- No schema validation feedback to user
- No partial upload (all-or-nothing)

---

### 6.3 Data Management (`/data_management.py`)

```
GET  /data/status
POST /data/reset?data_type={purchases|inventory|all}
POST /data/seed
```

**GET /data/status** returns:
```json
{
  "purchases": {
    "count": 22,
    "last_uploaded_at": "2026-01-20T10:30:00Z"
  },
  "inventory": {
    "count": 2,
    "last_uploaded_at": "2026-01-20T10:31:00Z"
  },
  "market_data": {
    "count": 764,
    "last_refreshed_at": "2026-01-20T10:30:05Z"
  }
}
```

---

### 6.4 Market Data (`/market_data.py`)

```
POST /market-data/refresh
```

**Behavior**:
- Fetches historical prices from Yahoo Finance (fallback: synthetic)
- Stores in `market_prices` with source `yahoo_finance`
- Shared across all customers

---

### 6.5 Futures (`/futures.py`)

```
GET /futures/list
```

**Response**:
```json
{
  "futures": [
    {
      "commodity": "sugar",
      "contract_month": "2026-02-01",
      "price": 0.440,
      "cost": 3.0,
      "future_type": "low",
      "suggested_quantity": 2500.0
    }
  ]
}
```

**Behavior**:
- Returns empty list if customer has no purchases (data-driven UI)
- Generates mock futures on-demand if not already generated
- `suggested_quantity` = average purchase volume for commodity

---

### 6.6 Price Projection (`/price_projection.py`)

```
GET  /price-projection
POST /price-projection/evaluate
```

**GET /price-projection** returns:
```json
{
  "currency": "USD",
  "projections": [
    {
      "commodity": "sugar",
      "timeline": [
        {
          "date": "2025-12-01",
          "price": 0.45,
          "high_future": 0.47,
          "low_future": 0.43,
          "is_past": true,
          "var": 0.0,
          "is_milestone": false,
          "volume": 1500.0,
          "eval_high": null,
          "eval_low": null
        }
      ]
    }
  ]
}
```

**POST /price-projection/evaluate** (for live evaluation):
```json
{
  "evaluations": [
    {
      "commodity": "sugar",
      "contract_month": "2026-02-01",
      "future_type": "low"
    }
  ]
}
```

Returns same structure as GET with `eval_high` and `eval_low` populated.

**Issues**:
- Evaluation does not persist to hedge session (as designed)
- Chart shows dashed lines for evaluated futures

---

### 6.7 Hedge Session (Transaction) (`/hedge_session.py`)

```
POST   /hedge-session/create
GET    /hedge-session/current
POST   /hedge-session/add
POST   /hedge-session/update/{commodity}/{contract_month}/{future_type}
DELETE /hedge-session/remove/{commodity}/{contract_month}/{future_type}
POST   /hedge-session/execute
POST   /hedge-session/abort
```

**POST /hedge-session/add**:
```json
{
  "commodity": "sugar",
  "contract_month": "2026-02-01",
  "future_type": "low",
  "quantity": 2500
}
```

**Response**:
```json
{
  "commodity": "sugar",
  "contract_month": "2026-02-01",
  "future_type": "low",
  "quantity": 2500.0,
  "price_snapshot": 0.440,
  "future_cost": 3.0
}
```

**Behavior**:
- Creates session if not exists
- Adds/updates item (unique by commodity + contract_month + future_type)
- Stores `price_snapshot` (commodity price) and `future_cost` (contract cost)

**POST /hedge-session/execute**:
```json
{
  "status": "executed",
  "executed_at": "2026-01-20T12:00:00Z",
  "message": "Transaction executed successfully"
}
```

**Behavior**:
- Copies session items to `executed_hedges`
- Marks session as executed
- **Issue**: Does not copy `future_type` or `future_cost` to executed_hedges

---

### 6.8 VaR (Placeholder) (`/var.py`)

```
GET /var/timeline
```

**Status**: NOT FULLY IMPLEMENTED

Returns mock/placeholder VaR values. Does not perform actual variance-covariance calculations.

**Desired Design**: See section 8.

---

### 6.9 Portfolio (`/portfolio.py`)

```
GET /portfolio/executed-hedges
GET /portfolio/summary
```

**Status**: Backend endpoints exist but return minimal data.

Frontend uses **mock data** for portfolio history display.

---

## 7. Frontend Screens (Current State)

### Screen 1: Login (`NewLoginScreen.tsx`)

**Path**: `/`

**Features**:
- Professional full-screen design
- Username/password authentication
- JWT stored in localStorage
- Redirects to `/dashboard/upload` on success

**Demo Users**:
- `demo` / `demo123` (HedgyMunchy customer)
- `avi` / `avi123` (HedgyMunchy customer)

---

### Screen 2: Data Upload (`DataLoadScreen.tsx`)

**Path**: `/dashboard/upload`

**Features**:
- Upload Purchases Excel
- Upload Inventory Excel
- Data status indicators
- Manual market data refresh
- Reset data by type
- "Proceed to Analysis" button (always enabled)

**Issues**:
- Button always enabled even without data (should be conditional)
- No validation error feedback to user

---

### Screen 3: Value at Risk Analysis (`ValueAtRiskPage.tsx`)

**Path**: `/dashboard/var`

**Features**:
- **Primary**: Price projection chart with futures overlay
  - Historical prices (solid line)
  - Future projections (dashed lines: high, low)
  - Evaluated futures (dashed colored lines)
- **Secondary**: Futures tiles sidebar
  - Filterable by commodity
  - Shows contract month, price, cost
  - Quantity selector
  - "Evaluate" button (live preview, no persistence)
  - "Add to Transaction" button
  - "Drop" button (removes from transaction)
  - Visual indicators: checkmarks, "Added" badges
- **Tertiary**: Market price chart

**Data-Driven UI**:
- Commodity filter buttons only appear if data exists
- Futures sidebar shows empty state if no data
- Charts only render if data exists

**Behavior**:
- On load, fetches price projection and current transaction
- Populates evaluated futures and transaction state from persisted session
- Evaluate: shows dashed lines, does not add to transaction
- Add: persists to backend hedge session, updates UI
- Drop: removes from backend hedge session, clears evaluation, resets tile

**Issues**:
- Quantity increments hardcoded (should be based on commodity unit)
- No real-time VaR calculation (placeholder only)

---

### Screen 4: Trade Execution (`TradeExecutionPage.tsx`)

**Path**: `/dashboard/transaction`

**Features**:
- Review transaction items
- Shows per-item:
  - Contract month
  - Locks in price (commodity price per unit)
  - Quantity (in lbs)
  - Guaranteed value (quantity × price)
  - Contract cost (fixed, in dollars converted from cents)
- Summary totals:
  - Total guaranteed value (sum of all guaranteed values)
  - Total transaction cost (sum of all contract costs)
- Remove item button (inline)
- Execute button (commits transaction)
- Abort button (cancels transaction)
- Back to Analysis button

**Issues**:
- Navigation path was `/value-at-risk` (fixed to `/dashboard/var`)
- Alert/confirm modals replaced with inline banners (complete)

---

### Screen 5: Portfolio History (`PortfolioHistoryPage.tsx`)

**Path**: `/dashboard/portfolio`

**Status**: MOCK DATA ONLY

**Features**:
- Summary cards (savings, contracts, success rate)
- Time filters (last month, 6 months, all time)
- Table of historical hedges
- Profit/loss indicators

**Desired Design**: Should fetch from `/portfolio/executed-hedges` backend endpoint.

---

## 8. VaR Calculation Strategy (DESIRED DESIGN - NOT IMPLEMENTED)

The VaR engine should be **fully server-side**. The frontend never computes risk; it only requests scenarios and renders results.

All VaR calculations should be **parametric (variance–covariance)** and assume normally distributed returns.

---

### 8.1 Core Concepts & Notation

Let:
- `i` = commodity index (Sugar, Flour)
- `t` = time bucket (monthly)
- `Q_{i,t}` = net physical exposure quantity
- `H_{i,t}` = hedge quantity (futures)
- `P_{i,t}` = forward price
- `σ_{i,t}` = annualized volatility
- `T_t` = time horizon in years
- `Z_α` = Z-score (e.g. 1.65 for 95%)

Net exposure:
```
E_{i,t} = Q_{i,t} − H_{i,t}
```

---

### 8.2 Single-Commodity VaR (per bucket)

For one commodity and one time bucket:
```
VaR_{i,t} = Z_α × σ_{i,t} × P_{i,t} × |E_{i,t}| × √T_t
```

This is the **atomic VaR unit** used everywhere in the system.

---

### 8.3 Commodity-Level VaR (aggregated over time)

For a commodity across multiple buckets:
```
VaR_i = √( Σ_t VaR_{i,t}² )
```

Assumes independence across delivery buckets (acceptable for demo).

---

### 8.4 Portfolio VaR (Multi-Commodity)

Let:
- `w` = vector of commodity VaRs
- `Σ` = covariance matrix derived from historical returns

```
Portfolio VaR = √( wᵀ Σ w )
```

Correlation is estimated from historical price returns.

---

### 8.5 VaR Scenarios

The backend should compute **two parallel scenarios**:
1. **Without Hedge** – physical exposure only
2. **With Hedge** – physical exposure minus hedge session

Both should be returned together so the frontend can compare.

---

### 8.6 Current Status

**CRITICAL GAP**: VaR engine returns placeholder values only. Real variance-covariance calculations are NOT implemented.

**Implementation Path**:
1. Compute historical volatilities per commodity
2. Compute correlation matrix
3. Apply hedge session to exposure buckets
4. Calculate per-bucket VaR
5. Aggregate to commodity and portfolio VaR
6. Return timeline with both scenarios

---

## 9. API Schemas (TypeScript / Pydantic Alignment)

### 9.1 Shared Primitive Types

**Commodity**: `"sugar" | "flour"`

**Scenario**: `"with_hedge" | "without_hedge"`

**Future Type**: `"high" | "low"`

---

### 9.2 Hedge Session Item

**TypeScript** (`frontend/src/types/api.ts`):
```typescript
export interface HedgeSessionItem {
  commodity: Commodity;
  contract_month: string;
  future_type: 'high' | 'low';
  quantity: number;
  price_snapshot: number;  // Commodity price per unit
  future_cost: number;     // Total contract cost in cents
}
```

**Pydantic** (`backend/app/models/schemas.py`):
```python
class HedgeSessionItem(BaseModel):
    commodity: Commodity
    contract_month: date
    future_type: Literal["high", "low"]
    quantity: float
    price_snapshot: float
    future_cost: float
```

**Alignment**: ✅ Complete

---

### 9.3 Future Contract

**TypeScript**:
```typescript
export interface FutureContract {
  commodity: Commodity;
  contract_month: string;
  price: number;  // Per-unit commodity price
  cost: number;   // Total fixed contract cost (cents)
  future_type: 'high' | 'low';
  suggested_quantity: number;
}
```

**Pydantic**:
```python
class FutureContract(BaseModel):
    commodity: str
    contract_month: str
    price: float
    cost: float
    future_type: str
    suggested_quantity: float
```

**Alignment**: ✅ Complete

---

### 9.4 Frontend Invariants (Non-Negotiable)

- Frontend **never computes VaR**
- Frontend **never infers correlations**
- Frontend **never aggregates VaR values**
- Frontend **never hardcodes commodity units**
- All charts render backend outputs verbatim

Any deviation is considered a bug.

---

## 10. Docker Compose (Local Development)

**File**: `docker-compose.yml`

```yaml
services:
  postgres:
    image: postgres:15
    ports: 5432:5432
    environment:
      POSTGRES_USER: findemo
      POSTGRES_PASSWORD: findemo_dev_pass
      POSTGRES_DB: findemo

  backend:
    build: ./backend
    ports: 8000:8000
    depends_on:
      postgres: {condition: service_healthy}
    environment:
      DATABASE_URL: postgresql://findemo:findemo_dev_pass@postgres:5432/findemo
      JWT_SECRET: dev_secret_key_change_in_production_12345

  frontend:
    build: ./frontend
    ports: 3000:5173
    depends_on: [backend]
    environment:
      VITE_API_BASE_URL: http://localhost:8000
```

---

## 11. Known Issues & Design Gaps

### 11.1 VaR Engine
**Status**: Placeholder only
**Priority**: HIGH
**Issue**: No real variance-covariance calculations
**Impact**: Core feature not functional

### 11.2 Executed Hedges Schema
**Issue**: `executed_hedges` table missing `future_type` and `future_cost` columns
**Impact**: Cannot reconstruct full transaction history
**Fix**: Add columns via migration

### 11.3 Data Upload Validation
**Issue**: No user feedback on Excel schema errors
**Impact**: Poor UX when upload fails
**Fix**: Return structured error messages

### 11.4 Portfolio History
**Issue**: Using mock data, not real executed hedges
**Impact**: Demo shows fake data
**Fix**: Connect to backend `/portfolio/executed-hedges`

### 11.5 Proceed to Analysis Button
**Issue**: Always enabled, even without data
**Impact**: User can navigate to empty analysis page
**Fix**: Disable until purchases + market data available

### 11.6 Transaction Terminology
**Status**: Complete
**Note**: Successfully replaced "cart" with "transaction" throughout

### 11.7 Empty State Handling
**Status**: Complete
**Note**: UI now data-driven, shows empty states correctly

---

## 12. Multi-Tenant Architecture (Current Implementation)

**Status**: Schema ready, partially implemented

**Complete**:
- `customers` and `users` tables with foreign keys
- `customer_id` column on all transactional tables
- JWT includes `customer_id`
- API endpoints filter by `current_user.customer_id`

**Gaps**:
- No customer registration flow
- No admin interface
- Seed data only for single customer "HedgyMunchy"

**Future Evolution**:
- Customer signup/onboarding
- Role-based access control
- Per-customer billing/limits
- Supabase migration
- Fly.io deployment

---

## 13. Non-Goals

- Real trade execution via broker API
- Intraday risk monitoring
- Options pricing
- Regulatory reporting (e.g., Dodd-Frank)
- Real-time market feeds (using daily close prices)
- Mobile app

---

## 14. Success Criteria for Demo

✅ **Complete**:
- User can login
- Upload purchases and inventory
- View price projections with futures
- Build transaction (add/remove futures)
- Execute transaction
- View executed transactions (mock portfolio)

⚠️ **Incomplete**:
- Real VaR calculation
- VaR comparison (with/without hedge)
- Transaction impact on risk metrics

---

## 15. Development Workflow

**Start System**:
```bash
docker-compose up -d
```

**View Logs**:
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

**Reset Data**:
```bash
# Via API
POST http://localhost:8000/data/reset?data_type=all

# Or via psql
docker-compose exec postgres psql -U findemo -d findemo -c "DELETE FROM purchases WHERE customer_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';"
```

**Re-seed Demo Data**:
```bash
POST http://localhost:8000/data/seed
```

**Stop System**:
```bash
docker-compose down
```

**Clean Restart**:
```bash
docker-compose down -v
docker-compose up -d
# Wait for postgres health check
docker-compose exec postgres psql -U findemo -d findemo -f /docker-entrypoint-initdb.d/schema_v2.sql
docker-compose exec postgres psql -U findemo -d findemo -f /docker-entrypoint-initdb.d/seed_minimal.sql
```

---

## 16. Terminology

**Transaction** (not "cart"): The hedge session being built before execution

**Futures**: Forward contracts with fixed commodity price and fixed contract cost

**Contract Cost**: Fixed fee to purchase a future (1-3 cents total, not per unit)

**Locks In Price**: The commodity price per unit that the future guarantees

**Guaranteed Value**: Quantity × locked-in price (total value secured)

**Evaluate**: Preview a future's impact without adding to transaction

**Add to Transaction**: Persist future selection to backend hedge session

**Drop**: Remove from transaction and clear evaluation

---

This is a **decision demo**, not a trading system.
