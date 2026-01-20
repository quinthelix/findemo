# agents.md — Commodity Hedging & VaR Demo Application

## 1. Purpose & Scope

This project is a **demo web application** for a company selling **commodity hedging and risk (VaR) tools**.

The demo simulates:

- A single customer
- Two commodities (Sugar, Flour)
- Historic purchases and inventory
- Forward price risk
- Dynamic VaR and portfolio VaR
- User-driven futures hedging decisions

The goal is **decision support**, not trade execution accuracy.

---

## 2. High-Level Architecture

The system is **containerized and modular**, designed to run locally using **Docker Compose**.

Each major responsibility runs in its own container.

```
┌────────────┐
│  Frontend  │  React (UI, charts, decisions)
└─────┬──────┘
      │ REST / JSON
┌─────▼──────┐
│  Backend   │  Python (FastAPI)
│  API       │  VaR engine, ingestion, logic
└─────┬──────┘
      │ SQL
┌─────▼──────┐
│ PostgreSQL │  Central state & history
└────────────┘
```

---

## 3. Technology Choices

### Frontend

- **React + TypeScript**
- Charting: **Recharts** or **ECharts**
- State management: React Context or lightweight store
- Auth: Simple demo login (username/password → JWT)

### Backend

- **Python**
- **FastAPI** for APIs
- **NumPy / Pandas** for risk calculations
- Async-compatible, stateless API

### Database

- **PostgreSQL**
- Single-tenant schema (for now)
- Designed to evolve into multi-tenant later

### Local Environment

- **Docker Compose**
- One container per module
- No cloud dependencies during development

---

## 4. Containers & Responsibilities

### 4.1 Frontend Container (`frontend`)

**Responsibilities**

- User login (demo security)
- Excel upload UI
- VaR visualization
- Hedge decision UI
- Trade execution UI (simulated)

**Reads from Backend**

- VaR time series (with / without hedge)
- Available futures prices
- Current hedge session (cart)
- Exposure summaries

**Writes to Backend**

- Excel uploads
- Hedge quantity selections
- Execute-trade requests

---

### 4.2 Backend API Container (`backend`)

**Responsibilities**

- Authentication (simple JWT)
- Excel ingestion & validation
- Market data ingestion (historical + forward)
- Exposure bucketing
- VaR & portfolio VaR calculations
- Hedge session (shopping cart) logic
- Persisting executed trades

**Does NOT**

- Render UI
- Store session state in memory
- Perform real market execution

---

### 4.3 Database Container (`postgres`)

**Responsibilities**

- Persistent storage
- Source of truth
- Session durability

---

## 5. Database Structure (Single Customer, Two Commodities)

### Core Tables

#### `users`

```
id
username
password_hash
created_at
```

---

#### `commodities`

```
id
name            -- sugar, flour
unit            -- kg / ton
```

---

#### `purchases`

Represents historic procurement.

```
id
commodity_id
purchase_date
delivery_start_date
delivery_end_date
quantity
unit
purchase_price
```

---

#### `inventory_snapshots`

Optional but important for realism.

```
id
date
commodity_id
quantity
```

---

#### `market_prices`

Historical and forward prices.

```
id
commodity_id
price_date
contract_month
price
source
```

---

#### `exposure_buckets`

Expanded monthly exposure (derived).

```
id
commodity_id
bucket_month
quantity
source_purchase_id
```

---

#### `hedge_sessions`

Represents an **active decision session** (shopping cart).

```
id
user_id
status          -- active / executed / cancelled
created_at
```

---

#### `hedge_session_items`

User-selected futures (not yet executed).

```
id
hedge_session_id
commodity_id
contract_month
quantity
price_snapshot
```

---

#### `executed_hedges`

Persisted after execution.

```
id
commodity_id
contract_month
quantity
execution_price
execution_date
```

---

## 6. Backend API Responsibilities

### Authentication

```
POST /login
```

---

### Excel Ingestion

These endpoints are actively used by the **Data Upload** screen.

```
POST /upload/purchases
POST /upload/inventory

---

### Data Status

Used by the **Data Upload** screen to show upload state and readiness.

```

GET /data/status

```

Response:
```

{ "purchases": { "uploaded": boolean, "last\_uploaded\_at": "ISO-8601" | null }, "inventory": { "uploaded": boolean, "last\_uploaded\_at": "ISO-8601" | null }, "market\_data": { "available": boolean, "last\_refreshed\_at": "ISO-8601" | null, "source": "string" } }

```
```

- Parses Excel
- Validates schema
- Writes to `purchases`, `inventory_snapshots`
- Triggers exposure bucketing

---

### Market Data

```
POST /market-data/refresh
GET  /market-data/futures
```

- Pulls historical prices
- Stores forward curves (1M / 3M / 6M / 12M)

---

### VaR Engine

```
GET /var/timeline
```

Returns:

- Historic VaR
- Forward VaR
- With hedge / without hedge

All VaR calculations happen **server-side**.

---

### Hedge Session (Decision Screen)

```
POST   /hedge-session/create
GET    /hedge-session/current
POST   /hedge-session/add
POST   /hedge-session/update
DELETE /hedge-session/remove
```

- Acts as a **shopping cart**
- Persisted in DB (not frontend state)
- Used for live VaR recalculation

---

### Execute Hedge

```
POST /hedge-session/execute
```

- Converts session items → `executed_hedges`
- Locks prices (simulated)
- Marks session as executed
- VaR recalculated post-execution

---

## 7. Frontend Screens

### Screen 1: Login

- Simple demo login
- No roles, no permissions

---

### Screen 2: Data Upload

Purpose: upload exposure data before analysis.

- Upload Excel (Historic Purchases)
- Upload Excel (Inventory)
- Auto / manual market data refresh
- Status indicators per dataset
- “Proceed to Analysis” enabled only when required data is available

---

### Screen 3: Risk & Decision (Main Screen)

**Primary element**

- Large **VaR Timeline Chart**
  - Past (solid)
  - Future (dashed)
  - Before vs After hedge

**Secondary elements**

- Hedge session panel (futures list + quantity selectors)
- ΔVaR indicator
- Small supporting charts

This screen updates **in real time** as hedge quantities change.

---

### Screen 4: Execute Hedge

Purpose: simulate real decision commitment.

- Review hedge session
- Show final VaR impact
- “Execute” button
- Confirmation summary

Execution is final and immutable.

---

## 8. VaR Calculation Strategy (v1)

The VaR engine is **fully server-side**. The frontend never computes risk; it only requests scenarios and renders results.

All VaR calculations are **parametric (variance–covariance)** and assume normally distributed returns.

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

The backend always computes **two parallel scenarios**:

1. **Without Hedge** – physical exposure only
2. **With Hedge** – physical exposure minus hedge session

Both are returned together so the frontend can compare.

---

## 9. VaR API Contracts (Exact Inputs & Outputs)

### 9.1 Request: VaR Timeline

```
GET /var/timeline
```

**Query Parameters**

```
confidence_level=0.95
start_date=YYYY-MM-DD
end_date=YYYY-MM-DD
```

---

### 9.2 Backend Processing Steps

1. Load exposure buckets from DB
2. Apply inventory offsets (short-term)
3. Apply hedge session quantities (if any)
4. Join market prices
5. Compute volatilities & correlations
6. Compute VaR per commodity
7. Compute portfolio VaR

---

### 9.3 Response Payload

```
{
  "confidence_level": 0.95,
  "currency": "USD",
  "timeline": [
    {
      "date": "2026-01-01",
      "scenario": "without_hedge",
      "var": {
        "sugar": 420000,
        "flour": 310000,
        "portfolio": 610000
      }
    },
    {
      "date": "2026-01-01",
      "scenario": "with_hedge",
      "var": {
        "sugar": 280000,
        "flour": 290000,
        "portfolio": 460000
      }
    }
  ]
}
```

---

### 9.4 Live Hedge Impact (Used While Sliding Quantities)

Frontend workflow:

1. User updates hedge quantity
2. Frontend calls hedge-session update endpoint
3. Frontend re-requests `/var/timeline`
4. Backend recomputes VaR using updated hedge session

No partial or client-side calculations are allowed.

---

### 9.5 Execute Hedge Response

```
POST /hedge-session/execute
```

Response:

```
{
  "status": "executed",
  "executed_at": "2026-01-15T10:12:00Z",
  "final_var": {
    "sugar": 270000,
    "flour": 285000,
    "portfolio": 455000
  }
}
```

---

This contract is **authoritative**: frontend logic, charts, and animations must be driven exclusively by these responses.

---

## 10. Typed API Schemas (Authoritative)

This section defines the **exact typed contracts** between frontend and backend.

These schemas are the **single source of truth** and must be used to generate:

- FastAPI Pydantic models
- OpenAPI spec
- Frontend TypeScript interfaces

No endpoint may return data outside these schemas.

---

### 10.1 Shared Primitive Types

**Commodity**

```
"sugar" | "flour"
```

**Scenario**

```
"with_hedge" | "without_hedge"
```

---

### 10.2 Authentication

**POST /login**

Request:

```
{
  "username": "string",
  "password": "string"
}
```

Response:

```
{
  "access_token": "string",
  "token_type": "bearer"
}
```

---

### 10.3 Hedge Session Schemas

> **Note (Updated FE Behavior)** Hedge sessions are now updated **only on explicit user actions** (Add / Update / Remove). VaR preview does **not** mutate session state.

**HedgeSession**

```
{
  "id": "uuid",
  "status": "active" | "executed" | "cancelled",
  "created_at": "ISO-8601"
}
```

**HedgeSessionItem**

```
{
  "commodity": "sugar" | "flour",
  "contract_month": "YYYY-MM-01",
  "quantity": number,
  "price_snapshot": number
}
```

---

### 10.4 VaR Structures

**CommodityVaR**

```
{
  "sugar": number,
  "flour": number,
  "portfolio": number
}
```

---

### 10.5 VaR Timeline Point

```
{
  "date": "YYYY-MM-DD",
  "scenario": "with_hedge" | "without_hedge",
  "var": {
    "sugar": number,
    "flour": number,
    "portfolio": number
  }
}
```

---

### 10.6 VaR Timeline Response

> **Important (Evaluate vs Commit)**
>
> - `/var/timeline` always computes VaR based on the **current persisted hedge session**.
> - It does **not** accept ad-hoc quantities.
> - The frontend `⚡ Eval` button must call the **Preview endpoint** (see 10.9).

```
{
  "confidence_level": number,
  "currency": "USD",
  "timeline": VaRTimelinePoint[]
}
```

```
{
  "confidence_level": number,
  "currency": "USD",
  "timeline": VaRTimelinePoint[]
}
```

---

### 10.7 Execute Hedge Response

```
{
  "status": "executed",
  "executed_at": "ISO-8601",
  "final_var": {
    "sugar": number,
    "flour": number,
    "portfolio": number
  }
}
```

---

### 10.8 Futures Contracts Schema (UPDATED)

Used by `GET /market-data/futures`

```
{
  "commodity": "sugar" | "flour",
  "contract_month": "YYYY-MM-01",
  "price": number,
  "contract_unit": number,
  "contract_unit_label": "string",
  "notional": number
}
```

**Rules**

- `contract_unit` is numeric (e.g. 50000)
- `contract_unit_label` is display-only (e.g. "50k lbs")
- Frontend must not hardcode units

---

### 10.9 VaR Preview (NEW)

Used by the **⚡ Eval** button on individual futures.

```
POST /var/preview
```

Request:

```
{
  "commodity": "sugar" | "flour",
  "contract_month": "YYYY-MM-01",
  "quantity": number
}
```

Behavior:

- Does **not** modify hedge session
- Temporarily applies this hedge on top of current session
- Computes VaR difference only

Response:

```
{
  "delta_var": {
    "sugar": number,
    "flour": number,
    "portfolio": number
  },
  "preview_var": {
    "sugar": number,
    "flour": number,
    "portfolio": number
  }
}
```

---

### 10.10 Portfolio (NEW)

```
GET /portfolio/executed-hedges
```

Response:

```
{
  "summary": {
    "total_positions": number,
    "total_quantity": number,
    "total_value": number
  },
  "hedges": [
    {
      "id": "string",
      "commodity": "sugar" | "flour",
      "contract_month": "YYYY-MM-01",
      "quantity": number,
      "execution_price": number,
      "execution_date": "ISO-8601",
      "value": number,
      "status": "active" | "expired"
    }
  ],
  "breakdown": {
    "sugar": {
      "total_quantity": number,
      "total_value": number,
      "contracts": number
    },
    "flour": {
      "total_quantity": number,
      "total_value": number,
      "contracts": number
    }
  }
}
```

---

### 10.11 Data Upload & Market Refresh APIs

These endpoints support the **Data Upload** screen.

```
POST /upload/purchases
POST /upload/inventory
POST /market-data/refresh
GET  /data/status
```

They may be bypassed in demo mode but remain first-class APIs.

The following endpoints exist but are **not required** in the current UI flow:

```
POST /upload/purchases
POST /upload/inventory
POST /market-data/refresh
```

They may be re-enabled later for a full demo data-loading flow.

```
{
  "status": "executed",
  "executed_at": "ISO-8601",
  "final_var": {
    "sugar": number,
    "flour": number,
    "portfolio": number
  }
}
```

---

### 10.12 Frontend Invariants (Non-Negotiable)

- Frontend **never computes VaR**
- Frontend **never infers correlations**
- Frontend **never aggregates VaR values**
- Frontend **never hardcodes contract units**
- VaR preview ≠ hedge session mutation
- All charts render backend outputs verbatim

Any deviation is considered a bug.

---

## 9. Docker Compose (Local Development)

```
services:
  frontend:
    build: ./frontend
    ports: 3000:3000

  backend:
    build: ./backend
    ports: 8000:8000
    depends_on:
      - postgres

  postgres:
    image: postgres:15
    ports: 5432:5432
```

---

## 10. Scalability & Multi-Tenant (Future)

Out of scope for v1.

Planned evolution:

- Add `customer_id` to all core tables
- Row-level isolation
- Auth-based scoping
- Supabase migration
- Fly.io deployment

---

## 11. Non-Goals

- Real trade execution
- Intraday risk
- Options pricing
- Regulatory reporting
- Real-time market feeds

---

## 12. Success Criteria for Demo

- Clear VaR narrative
- Immediate feedback from hedging actions
- Intuitive portfolio effect
- Executive-level readability
- Minimal UI clutter

This is a **decision demo**, not a trading system.

