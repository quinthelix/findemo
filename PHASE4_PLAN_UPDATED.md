# Phase 4: Integration Testing & End-to-End Validation (UPDATED)

**Updated based on AGENTS.md changes**

---

## 🔄 Key Changes from AGENTS.md

### New/Updated API Contracts

1. **`GET /data/status`** - NEW endpoint for Data Upload screen
2. **`POST /var/preview`** - NEW endpoint for Eval button (non-mutating)
3. **`GET /portfolio/executed-hedges`** - Confirmed required (was identified earlier)
4. **Updated Futures Schema** - Must include `contract_unit`, `contract_unit_label`, `notional`
5. **VaR Timeline Behavior** - Only uses persisted hedge session (no ad-hoc quantities)
6. **Hedge Session Workflow** - Only mutates on explicit Add/Update/Remove

---

## Critical Implementation Requirements

### ⚠️ Must Implement Before Integration Testing

#### 1. Data Status Endpoint
```python
# backend/app/routers/data_management.py

@router.get("/data/status")
async def get_data_status(current_user: User = Depends(get_current_user)):
    """
    Returns upload status for purchases, inventory, and market data
    """
    return {
        "purchases": {
            "uploaded": bool,  # Check if data exists for this customer
            "last_uploaded_at": "ISO-8601" | None
        },
        "inventory": {
            "uploaded": bool,
            "last_uploaded_at": "ISO-8601" | None
        },
        "market_data": {
            "available": bool,
            "last_refreshed_at": "ISO-8601" | None,
            "source": "Yahoo Finance / Stooq"
        }
    }
```

#### 2. VaR Preview Endpoint (NEW)
```python
# backend/app/routers/var.py

@router.post("/var/preview")
async def preview_var_impact(
    commodity: str,
    contract_month: str,
    quantity: int,
    current_user: User = Depends(get_current_user)
):
    """
    Temporarily preview VaR impact WITHOUT mutating hedge session
    Used by frontend ⚡ Eval button
    """
    # 1. Get current hedge session
    # 2. Temporarily apply this hedge ON TOP of current session
    # 3. Calculate VaR with temporary hedge
    # 4. Calculate delta from current VaR
    # 5. Return both delta and preview (DO NOT PERSIST)
    
    return {
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

#### 3. Updated Futures Contract Response
```python
# backend/app/routers/market_data.py

@router.get("/market-data/futures")
async def get_futures_contracts(current_user: User = Depends(get_current_user)):
    """
    Must include contract_unit and contract_unit_label
    """
    return [
        {
            "commodity": "sugar",
            "contract_month": "2026-03-01",
            "price": 0.52,
            "contract_unit": 50000,           # NEW - numeric
            "contract_unit_label": "50k lbs", # NEW - display string
            "notional": 26000                  # NEW - price * unit
        },
        # ...
    ]
```

#### 4. Portfolio Endpoint
```python
# backend/app/routers/portfolio.py (NEW FILE)

@router.get("/portfolio/executed-hedges")
async def get_executed_hedges(current_user: User = Depends(get_current_user)):
    """
    Returns all executed hedges for this customer
    """
    return {
        "summary": {
            "total_positions": int,
            "total_quantity": int,
            "total_value": float
        },
        "hedges": [
            {
                "id": "string",
                "commodity": "sugar" | "flour",
                "contract_month": "2026-03-01",
                "quantity": int,
                "execution_price": float,
                "execution_date": "ISO-8601",
                "value": float,
                "status": "active" | "expired"
            }
        ],
        "breakdown": {
            "sugar": {
                "total_quantity": int,
                "total_value": float,
                "contracts": int
            },
            "flour": {
                "total_quantity": int,
                "total_value": float,
                "contracts": int
            }
        }
    }
```

---

## Updated Phase 4 Tasks

### Task 0: Implement Missing Backend Endpoints (PRIORITY)

**Before starting integration testing, implement:**

```bash
# Create new router for portfolio
touch backend/app/routers/portfolio.py

# Update existing routers with new endpoints:
# - backend/app/routers/data_management.py (add GET /data/status)
# - backend/app/routers/var.py (add POST /var/preview)
# - backend/app/routers/market_data.py (update futures response)
```

**Implementation Checklist:**
- [ ] `GET /data/status` - Check database for customer data presence
- [ ] `POST /var/preview` - Temporary VaR calculation WITHOUT session mutation
- [ ] `GET /portfolio/executed-hedges` - Query executed_hedges table
- [ ] Update futures response with unit fields
- [ ] Register portfolio router in main.py

---

### Task 1: Update Frontend API Client

**Update TypeScript types to match new contracts:**

```typescript
// frontend/src/types/api.ts

// NEW: Data Status Response
export interface DataStatus {
  purchases: {
    uploaded: boolean;
    last_uploaded_at: string | null;
  };
  inventory: {
    uploaded: boolean;
    last_uploaded_at: string | null;
  };
  market_data: {
    available: boolean;
    last_refreshed_at: string | null;
    source: string;
  };
}

// UPDATED: Futures Contract (add unit fields)
export interface FuturesContract {
  commodity: Commodity;
  contract_month: string;
  price: number;
  contract_unit: number;           // NEW
  contract_unit_label: string;     // NEW
  notional: number;                // NEW
}

// NEW: VaR Preview Request/Response
export interface VarPreviewRequest {
  commodity: Commodity;
  contract_month: string;
  quantity: number;
}

export interface VarPreviewResponse {
  delta_var: CommodityVaR;
  preview_var: CommodityVaR;
}

// NEW: Portfolio Response
export interface PortfolioResponse {
  summary: {
    total_positions: number;
    total_quantity: number;
    total_value: number;
  };
  hedges: ExecutedHedge[];
  breakdown: {
    sugar: CommodityBreakdown;
    flour: CommodityBreakdown;
  };
}

export interface ExecutedHedge {
  id: string;
  commodity: Commodity;
  contract_month: string;
  quantity: number;
  execution_price: number;
  execution_date: string;
  value: number;
  status: 'active' | 'expired';
}

export interface CommodityBreakdown {
  total_quantity: number;
  total_value: number;
  contracts: number;
}
```

**Add new API endpoints:**

```typescript
// frontend/src/api/endpoints.ts

export const getDataStatus = () => 
  apiClient.get<DataStatus>('/data/status');

export const previewVarImpact = (data: VarPreviewRequest) =>
  apiClient.post<VarPreviewResponse>('/var/preview', data);

export const getExecutedHedges = () =>
  apiClient.get<PortfolioResponse>('/portfolio/executed-hedges');
```

---

### Task 2: Update Frontend Components

#### 2.1 Data Upload Screen

**Use `GET /data/status`:**

```typescript
// frontend/src/screens/DataLoadScreen.tsx

const [dataStatus, setDataStatus] = useState<DataStatus | null>(null);

useEffect(() => {
  loadDataStatus();
}, []);

const loadDataStatus = async () => {
  try {
    const status = await getDataStatus();
    setDataStatus(status);
  } catch (err) {
    console.error('Failed to load data status:', err);
  }
};

// Update status indicators based on dataStatus
```

#### 2.2 Value at Risk Page - Eval Button

**Change Eval button to use `POST /var/preview`:**

```typescript
// frontend/src/screens/ValueAtRiskPage.tsx

const handleEvaluate = async (future: FuturesContract) => {
  setEvaluating(true);
  try {
    const qty = quantities[`${future.commodity}-${future.contract_month}`] || 0;
    
    // Use preview endpoint (non-mutating)
    const preview = await previewVarImpact({
      commodity: future.commodity,
      contract_month: future.contract_month,
      quantity: qty
    });
    
    // Show preview results (maybe in a tooltip or modal?)
    alert(`VaR Delta: Portfolio ${preview.delta_var.portfolio.toLocaleString()}`);
    
  } catch (err) {
    console.error('Failed to preview:', err);
  } finally {
    setEvaluating(false);
  }
};
```

#### 2.3 Remove Hardcoded Contract Units

**Use `contract_unit_label` from API:**

```typescript
// frontend/src/screens/ValueAtRiskPage.tsx

// BEFORE (hardcoded):
<span className="future-price">
  ${future.price.toFixed(2)}/{future.commodity === 'sugar' ? '50k lbs' : '100k lbs'}
</span>

// AFTER (from API):
<span className="future-price">
  ${future.price.toFixed(2)}/{future.contract_unit_label}
</span>
```

#### 2.4 Portfolio Page - Use Real Data

**Replace mock data with API call:**

```typescript
// frontend/src/screens/PortfolioPage.tsx

const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);

useEffect(() => {
  loadPortfolio();
}, []);

const loadPortfolio = async () => {
  try {
    const data = await getExecutedHedges();
    setPortfolio(data);
  } catch (err) {
    console.error('Failed to load portfolio:', err);
  }
};

// Render portfolio.hedges instead of mock data
```

---

### Task 3: Integration Testing Workflow

Now that we've clarified the behavior, test these workflows:

#### 3.1 Eval Button Workflow (NON-MUTATING)

**Expected Behavior:**
1. User sets quantity for a future
2. User clicks **⚡ Eval**
3. Frontend calls `POST /var/preview` (does NOT mutate session)
4. Backend calculates VaR with temporary hedge
5. Frontend shows delta/preview
6. **Hedge session remains unchanged**
7. User clicks **✓ Add** to actually commit

**Test:**
```bash
# 1. Set quantity in frontend
# 2. Click Eval
# 3. Verify hedge session NOT updated:

curl http://localhost:8000/hedge-session/current \
  -H "Authorization: Bearer $TOKEN"

# Should return empty or previous session (no new item)

# 4. Click Add
# 5. Verify hedge session IS updated:

curl http://localhost:8000/hedge-session/current \
  -H "Authorization: Bearer $TOKEN"

# Should now include the item
```

#### 3.2 VaR Timeline Uses Persisted Session Only

**Expected Behavior:**
- `GET /var/timeline` always uses the current hedge session from database
- Does NOT accept ad-hoc quantities
- To preview, must use `/var/preview`

**Test:**
```bash
# 1. Create hedge session with 1000 sugar
curl -X POST http://localhost:8000/hedge-session/add \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"commodity":"sugar","contract_month":"2026-03-01","quantity":1000,"price_snapshot":0.52}'

# 2. Get VaR timeline
curl http://localhost:8000/var/timeline \
  -H "Authorization: Bearer $TOKEN"

# 3. Verify "with_hedge" scenario reflects 1000 sugar hedge

# 4. Preview different quantity (2000)
curl -X POST http://localhost:8000/var/preview \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"commodity":"sugar","contract_month":"2026-03-01","quantity":2000}'

# 5. Get VaR timeline again
curl http://localhost:8000/var/timeline \
  -H "Authorization: Bearer $TOKEN"

# 6. Verify "with_hedge" STILL shows 1000 (preview didn't persist)
```

#### 3.3 Data Upload Status

**Test:**
```bash
# 1. Check status before upload
curl http://localhost:8000/data/status \
  -H "Authorization: Bearer $TOKEN"

# Should show uploaded: false

# 2. Upload purchases
curl -X POST http://localhost:8000/upload/purchases \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@purchases.xlsx"

# 3. Check status again
curl http://localhost:8000/data/status \
  -H "Authorization: Bearer $TOKEN"

# Should show purchases: { uploaded: true, last_uploaded_at: "..." }
```

#### 3.4 Portfolio Display

**Test:**
```bash
# 1. Execute a hedge
curl -X POST http://localhost:8000/hedge-session/execute \
  -H "Authorization: Bearer $TOKEN"

# 2. Get portfolio
curl http://localhost:8000/portfolio/executed-hedges \
  -H "Authorization: Bearer $TOKEN"

# 3. Verify executed hedge appears with correct data

# 4. Check frontend Portfolio page
# - Should display executed hedges (not mock data)
# - Summary should match API response
# - Breakdown by commodity should be accurate
```

---

### Task 4: Contract Unit Display Validation

**Remove all hardcoded units from frontend:**

```bash
# Search for hardcoded units
grep -r "50k lbs" frontend/src/
grep -r "100k lbs" frontend/src/
grep -r "50000" frontend/src/
grep -r "100000" frontend/src/

# Should only find them in comments or old code
```

**Verify frontend displays:**
- Price: `$0.52/50k lbs` (from `contract_unit_label`)
- Notional: Calculated using `price * contract_unit * quantity`

---

### Task 5: API Contract Test Suite

Create automated tests for new endpoints:

```python
# backend/tests/test_new_endpoints.py

def test_data_status(client, token):
    """Test GET /data/status"""
    response = client.get(
        "/data/status",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "purchases" in data
    assert "inventory" in data
    assert "market_data" in data

def test_var_preview_non_mutating(client, token):
    """Test POST /var/preview does not mutate session"""
    # Get current session
    session_before = client.get(
        "/hedge-session/current",
        headers={"Authorization": f"Bearer {token}"}
    ).json()
    
    # Preview a hedge
    response = client.post(
        "/var/preview",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "commodity": "sugar",
            "contract_month": "2026-03-01",
            "quantity": 1000
        }
    )
    assert response.status_code == 200
    
    # Get session after preview
    session_after = client.get(
        "/hedge-session/current",
        headers={"Authorization": f"Bearer {token}"}
    ).json()
    
    # Session should be unchanged
    assert session_before == session_after

def test_futures_include_units(client, token):
    """Test futures response includes unit fields"""
    response = client.get(
        "/market-data/futures",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    futures = response.json()
    
    for future in futures:
        assert "contract_unit" in future
        assert "contract_unit_label" in future
        assert "notional" in future
        assert isinstance(future["contract_unit"], int)

def test_portfolio_endpoint(client, token):
    """Test GET /portfolio/executed-hedges"""
    response = client.get(
        "/portfolio/executed-hedges",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "hedges" in data
    assert "breakdown" in data
```

---

## Updated Success Criteria

### ✅ Phase 4 Complete When:

1. **All new endpoints implemented and tested**
   - [ ] `GET /data/status`
   - [ ] `POST /var/preview`
   - [ ] `GET /portfolio/executed-hedges`
   - [ ] Updated futures response with units

2. **Frontend uses correct APIs**
   - [ ] Eval button uses preview endpoint (non-mutating)
   - [ ] VaR timeline uses persisted session only
   - [ ] Data upload uses status endpoint
   - [ ] Portfolio uses real data (not mock)
   - [ ] No hardcoded contract units

3. **Workflows validated**
   - [ ] Eval → Preview (no mutation) → Add (mutation) works
   - [ ] Data upload → Status check works
   - [ ] Execute → Portfolio display works
   - [ ] VaR calculations use correct session state

4. **API contracts match specification**
   - [ ] All types in TypeScript match backend
   - [ ] All responses follow AGENTS.md schemas
   - [ ] Frontend invariants respected (no VaR calculation, no hardcoded units)

5. **Integration tests pass**
   - [ ] Backend test suite passes
   - [ ] Frontend test suite passes
   - [ ] Manual E2E workflow completes

---

## Implementation Priority Order

### Week 1: Backend Endpoints

1. **Day 1-2:** Implement `POST /var/preview`
   - Most critical for frontend workflow
   - Complex calculation logic

2. **Day 2-3:** Implement `GET /portfolio/executed-hedges`
   - Required to replace mock data
   - Straightforward database query

3. **Day 3:** Implement `GET /data/status`
   - Simple status check
   - Enhances UX on upload page

4. **Day 4:** Update futures response
   - Add unit fields to existing endpoint
   - Update seed data if needed

### Week 2: Frontend Integration

5. **Day 5:** Update TypeScript types and API client
6. **Day 6:** Update Value at Risk page (Eval button, remove hardcoded units)
7. **Day 7:** Update Data Upload page (status indicators)
8. **Day 8:** Update Portfolio page (real data)

### Week 3: Testing & Validation

9. **Day 9-10:** Write backend tests for new endpoints
10. **Day 11-12:** End-to-end integration testing
11. **Day 13:** Performance testing and optimization
12. **Day 14:** Bug fixes and documentation

---

## Commands Reference (Updated)

```bash
# Test new endpoints

# Data status
curl http://localhost:8000/data/status \
  -H "Authorization: Bearer $TOKEN"

# VaR preview (non-mutating)
curl -X POST http://localhost:8000/var/preview \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"commodity":"sugar","contract_month":"2026-03-01","quantity":1000}'

# Portfolio
curl http://localhost:8000/portfolio/executed-hedges \
  -H "Authorization: Bearer $TOKEN"

# Futures (check for unit fields)
curl http://localhost:8000/market-data/futures \
  -H "Authorization: Bearer $TOKEN" | jq '.[0]'
```

---

**Next Step:** Implement the 4 missing/updated backend endpoints, then proceed with integration testing!
