# TESTING.md - FinOs Demo Testing Guide

## Overview

This document covers both **manual testing** (for demo preparation) and **automated testing** (current + future plans).

---

## 1. Manual Testing Checklist

### Pre-Demo Setup (Clean Slate)

```bash
# 1. Stop all containers
docker-compose down -v

# 2. Start fresh
docker-compose up -d

# 3. Wait for services (check logs)
docker-compose logs -f

# 4. Verify all healthy
docker-compose ps
# Should show: postgres (healthy), backend (up), frontend (up)
```

---

### Test Scenario 1: Fresh User Flow

**Goal**: Verify complete workflow from login to execution.

#### 1.1 Login

- [ ] Navigate to http://localhost:3000
- [ ] Page loads without errors (check browser console)
- [ ] Login form is empty (no pre-filled values)
- [ ] Title shows "FinOs - Demo"
- [ ] Enter username: `demo`
- [ ] Enter password: `demo123`
- [ ] Click "Sign In"
- [ ] Redirects to `/dashboard/upload`
- [ ] Sidebar shows customer name "HedgyMunchy"

**Expected**: Successful login, JWT stored in localStorage.

---

#### 1.2 Data Upload

- [ ] On "Upload Data" page
- [ ] All status cards show "Not Uploaded" or "0 items"
- [ ] Upload `data/demo_purchases_v2.xlsx`
  - [ ] File picker accepts Excel
  - [ ] Upload progress/success message appears
  - [ ] Status updates to show purchase count
- [ ] Upload `data/demo_inventory_v2.xlsx`
  - [ ] Upload success message appears
  - [ ] Status updates to show inventory count
- [ ] Click "Refresh Market Data" (or check auto-triggered)
  - [ ] Success message appears
  - [ ] Market data status updates
- [ ] Click "Proceed to Analysis"
  - [ ] Navigates to `/dashboard/var`

**Expected**: All uploads succeed, data persisted to database.

**Verification**:
```bash
docker-compose exec postgres psql -U findemo -d findemo -c "
SELECT 
  'purchases' as type, COUNT(*) as count FROM purchases
  WHERE customer_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
UNION ALL
SELECT 'inventory', COUNT(*) FROM inventory_snapshots
  WHERE customer_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
UNION ALL
SELECT 'futures', COUNT(*) FROM market_prices
  WHERE source LIKE 'mock_futures%';
"
```

---

#### 1.3 Value at Risk Analysis

- [ ] Price projection chart loads
  - [ ] Shows both sugar and flour lines (if both uploaded)
  - [ ] Historical data (solid lines)
  - [ ] Future projections (dashed lines: high and low)
- [ ] Commodity filter buttons appear
  - [ ] Click "Sugar" - filters to sugar only
  - [ ] Click "Flour" - filters to flour only
  - [ ] Click "All" - shows both
- [ ] Futures sidebar shows available contracts
  - [ ] Each tile shows:
    - [ ] Commodity and contract month
    - [ ] "Locks: $X.XXX/lb" (commodity price)
    - [ ] "Contract: $Y.YY" (cost in dollars)
    - [ ] Quantity selector
    - [ ] "Evaluate" button
    - [ ] "Add to Transaction" button
- [ ] Market price chart loads (smaller chart)

**Expected**: All data-driven elements appear only if data exists.

---

#### 1.4 Evaluate Future (Preview)

- [ ] Select a future tile (e.g., Sugar Low Feb 2026)
- [ ] Adjust quantity to 2000 lbs
- [ ] Click "⚡ Evaluate"
  - [ ] Dashed colored line appears on chart
  - [ ] Tile shows checkmark or indicator
  - [ ] No backend persistence (verify by checking transaction count)
- [ ] Click "Evaluate" again to toggle off
  - [ ] Dashed line disappears

**Expected**: Evaluation is visual-only, no backend mutation.

**Verification**:
```bash
# Should return 0 items
docker-compose exec postgres psql -U findemo -d findemo -c "
SELECT COUNT(*) FROM hedge_session_items hsi
JOIN hedge_sessions hs ON hsi.hedge_session_id = hs.id
WHERE hs.status = 'active';
"
```

---

#### 1.5 Add to Transaction

- [ ] Select a future tile
- [ ] Adjust quantity
- [ ] Click "Add to Transaction"
  - [ ] Success banner appears (inline, not alert)
  - [ ] Tile shows "✓ Added" badge
  - [ ] Tile checkbox becomes checked
  - [ ] Dashed line appears on chart
- [ ] Navigate away (e.g., to Upload page)
- [ ] Navigate back to Analysis
  - [ ] Tile still shows "Added" state
  - [ ] Dashed line still visible
  - [ ] Quantity preserved

**Expected**: Transaction persisted to backend hedge session.

**Verification**:
```bash
# Should return 1 or more items
docker-compose exec postgres psql -U findemo -d findemo -c "
SELECT c.name, hsi.contract_month, hsi.future_type, hsi.quantity, hsi.future_cost
FROM hedge_session_items hsi
JOIN hedge_sessions hs ON hsi.hedge_session_id = hs.id
JOIN commodities c ON hsi.commodity_id = c.id
WHERE hs.status = 'active';
"
```

---

#### 1.6 Update Transaction Item

- [ ] Tile already in transaction
- [ ] Change quantity
- [ ] Click "Add to Transaction" again
  - [ ] Quantity updates (not duplicate)
  - [ ] Chart updates

**Expected**: Update existing item, not duplicate.

---

#### 1.7 Drop from Transaction

- [ ] Tile in transaction
- [ ] Click "Drop"
  - [ ] Tile resets to unchecked
  - [ ] "Added" badge disappears
  - [ ] Dashed line disappears from chart
  - [ ] Quantity resets to default
- [ ] Navigate away and back
  - [ ] Tile still shows not-added state

**Expected**: Item removed from backend hedge session.

**Verification**:
```bash
# Should return 0 or fewer items
docker-compose exec postgres psql -U findemo -d findemo -c "
SELECT COUNT(*) FROM hedge_session_items hsi
JOIN hedge_sessions hs ON hsi.hedge_session_id = hs.id
WHERE hs.status = 'active';
"
```

---

#### 1.8 Trade Execution

- [ ] Add 2-3 futures to transaction
- [ ] Click "Execute Transaction" in sidebar (or navigate to `/dashboard/transaction`)
- [ ] Transaction page loads
  - [ ] Shows all items
  - [ ] Each item shows:
    - [ ] Contract month
    - [ ] "Locks In Price: $X.XXX/lb"
    - [ ] "Quantity: X,XXX lbs"
    - [ ] "Guaranteed Value: $X,XXX.XX (quantity lbs @ $price/lb)"
    - [ ] "Contract Cost: $X.XX" (converted from cents)
- [ ] Summary section shows:
  - [ ] "Total Guaranteed Value: $X,XXX.XX"
  - [ ] "Total Transaction Cost: $X.XX"
  - [ ] Total lbs and contract count
- [ ] Click "Execute Transaction"
  - [ ] Success banner appears
  - [ ] Page shows "Transaction Executed" state
- [ ] Click "Back to Analysis"
  - [ ] Navigates to `/dashboard/var` (not logged out)
  - [ ] All tiles reset (no transaction items)

**Expected**: Transaction moves to executed_hedges, session marked executed.

**Verification**:
```bash
# Executed hedges
docker-compose exec postgres psql -U findemo -d findemo -c "
SELECT c.name, eh.contract_month, eh.quantity, eh.execution_price
FROM executed_hedges eh
JOIN commodities c ON eh.commodity_id = c.id
WHERE eh.customer_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
ORDER BY eh.execution_date DESC;
"

# Hedge session marked executed
docker-compose exec postgres psql -U findemo -d findemo -c "
SELECT status, COUNT(*) FROM hedge_sessions GROUP BY status;
"
```

---

#### 1.9 Abort Transaction

- [ ] Add items to transaction
- [ ] Navigate to `/dashboard/transaction`
- [ ] Click "Abort Transaction"
  - [ ] Confirmation banner
  - [ ] Session cleared
- [ ] Navigate back to Analysis
  - [ ] All tiles reset

**Expected**: Session marked cancelled or deleted.

---

#### 1.10 Portfolio History

- [ ] Navigate to "Portfolio History" page
- [ ] Page loads (currently shows mock data)
- [ ] Summary cards display
- [ ] Time filters work (Last Month, 6 Months, All Time)
- [ ] Table shows historical hedges

**Expected**: Mock data displayed (real data integration pending).

---

#### 1.11 Data Reset

- [ ] Navigate to "Upload Data" page
- [ ] Click "Reset Purchases"
  - [ ] Confirmation banner
  - [ ] Purchase count goes to 0
- [ ] Navigate to Analysis
  - [ ] Commodities and futures disappear
  - [ ] Empty state message appears

**Expected**: Data-driven UI responds to empty state.

---

### Test Scenario 2: Edge Cases

#### 2.1 Navigate Without Data

- [ ] Clean database (reset all)
- [ ] Login
- [ ] Navigate directly to `/dashboard/var`
- [ ] Page shows empty state
  - [ ] No commodity filter buttons
  - [ ] No price chart
  - [ ] Futures sidebar shows "No futures available"

**Expected**: Graceful empty state, no errors.

---

#### 2.2 Duplicate Add

- [ ] Add same future twice
- [ ] Check database - should be 1 item, not 2

**Expected**: Update quantity, not duplicate.

---

#### 2.3 Large Quantity

- [ ] Enter very large quantity (e.g., 999999)
- [ ] Add to transaction
- [ ] Execute
- [ ] Check all calculations correct

**Expected**: Numbers formatted correctly, no overflow errors.

---

#### 2.4 Multiple Users Same Customer

- [ ] Login as `demo`
- [ ] Add futures to transaction
- [ ] Logout
- [ ] Login as `avi` (same customer)
- [ ] Navigate to Analysis
  - [ ] Should see same transaction items (shared customer session)

**Expected**: Customer-level isolation working.

---

#### 2.5 Browser Refresh

- [ ] Mid-workflow, refresh browser
- [ ] JWT still valid (check localStorage)
- [ ] User remains logged in
- [ ] Transaction state preserved

**Expected**: Stateless frontend, all state in backend.

---

#### 2.6 Logout

- [ ] Click "Logout" in sidebar
- [ ] Redirects to login page
- [ ] localStorage cleared
- [ ] Cannot access protected routes

**Expected**: Clean logout.

---

### Visual/UX Checks

- [ ] No emoji in text (per user rule)
- [ ] No colored terminal output (per user rule)
- [ ] Professional icons (◈⟫◐, not 📊⚡💼)
- [ ] Consistent "Transaction" terminology (not "cart")
- [ ] Inline banners (not alert/confirm modals)
- [ ] Loading states for async operations
- [ ] Error messages user-friendly
- [ ] Responsive layout (test window resize)

---

## 2. Automated Testing (Current State)

### Backend Tests

**Framework**: pytest (not yet implemented)

**Current Status**: ❌ No backend tests exist

**Planned Tests**:
- [ ] Unit tests for VaR engine
- [ ] Unit tests for exposure bucketing
- [ ] Unit tests for futures generation
- [ ] API endpoint tests (mocked database)
- [ ] Schema validation tests

**Run Command** (when implemented):
```bash
docker-compose exec backend pytest tests/
```

---

### Frontend Tests

**Framework**: Vitest / Jest (not yet implemented)

**Current Status**: ❌ No frontend tests exist

**Planned Tests**:
- [ ] Component unit tests (Login, Futures tiles)
- [ ] API client tests (mocked endpoints)
- [ ] Chart rendering tests
- [ ] Form validation tests
- [ ] Routing tests

**Run Command** (when implemented):
```bash
docker-compose exec frontend npm test
```

---

### Integration Tests

**Current Status**: ❌ Not implemented

**Planned**:
- [ ] End-to-end API flows (pytest + httpx)
- [ ] Database transaction tests
- [ ] Multi-tenant isolation tests

---

## 3. Automated Testing (Future Plans)

### 3.1 Backend Unit Tests

**File Structure**:
```
backend/tests/
├── __init__.py
├── conftest.py                  # pytest fixtures
├── test_auth.py                 # Login, JWT validation
├── test_upload.py               # Excel parsing, validation
├── test_exposure.py             # Bucketing logic
├── test_futures_generation.py   # Mock futures creation
├── test_price_projection.py     # Price timeline calculation
├── test_hedge_session.py        # Transaction CRUD
├── test_var_engine.py           # VaR calculations (critical!)
└── test_data_management.py      # Reset, seed operations
```

**Key Test Cases**:

#### `test_var_engine.py`
```python
def test_single_commodity_var():
    """Test VaR_{i,t} = Z_α × σ_{i,t} × P_{i,t} × |E_{i,t}| × √T_t"""
    exposure = 1000  # lbs
    price = 0.50  # $/lb
    volatility = 0.15  # 15% annual
    horizon_years = 0.25  # 3 months
    confidence = 0.95  # Z = 1.65
    
    var = calculate_bucket_var(exposure, price, volatility, horizon_years, confidence)
    
    expected = 1.65 * 0.15 * 0.50 * 1000 * sqrt(0.25)
    assert abs(var - expected) < 0.01

def test_portfolio_var_with_correlation():
    """Test Portfolio VaR = √( wᵀ Σ w )"""
    sugar_var = 10000
    flour_var = 8000
    correlation = 0.6
    
    portfolio_var = calculate_portfolio_var(
        [sugar_var, flour_var],
        [[1.0, correlation], [correlation, 1.0]]
    )
    
    expected = sqrt(sugar_var**2 + flour_var**2 + 2*correlation*sugar_var*flour_var)
    assert abs(portfolio_var - expected) < 1
```

#### `test_exposure.py`
```python
def test_monthly_bucketing():
    """Purchases spanning multiple months should split correctly"""
    purchase = Purchase(
        delivery_start_date=date(2026, 1, 15),
        delivery_end_date=date(2026, 3, 10),
        quantity=3000
    )
    
    buckets = create_exposure_buckets(purchase)
    
    assert len(buckets) == 3  # Jan, Feb, Mar
    assert sum(b.quantity for b in buckets) == 3000
```

---

### 3.2 Frontend Unit Tests

**File Structure**:
```
frontend/src/__tests__/
├── components/
│   ├── FuturesTile.test.tsx
│   ├── PriceProjectionChart.test.tsx
│   └── Sidebar.test.tsx
├── screens/
│   ├── LoginScreen.test.tsx
│   ├── ValueAtRiskPage.test.tsx
│   └── TradeExecutionPage.test.tsx
├── api/
│   └── endpoints.test.ts
└── utils/
    └── formatting.test.ts
```

**Key Test Cases**:

#### `ValueAtRiskPage.test.tsx`
```typescript
describe('ValueAtRiskPage', () => {
  it('shows empty state when no data', async () => {
    mockAPI.getFutures.mockResolvedValue({ futures: [] });
    render(<ValueAtRiskPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/no futures available/i)).toBeInTheDocument();
    });
  });
  
  it('loads transaction items on mount', async () => {
    mockAPI.getCurrentSession.mockResolvedValue({
      items: [{ commodity: 'sugar', quantity: 2000, ... }]
    });
    
    render(<ValueAtRiskPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/added/i)).toBeInTheDocument();
    });
  });
});
```

---

### 3.3 E2E Tests with Browser Automation

**Framework**: Playwright or Cypress

**File Structure**:
```
e2e/
├── playwright.config.ts
├── tests/
│   ├── login.spec.ts
│   ├── upload-data.spec.ts
│   ├── build-transaction.spec.ts
│   ├── execute-transaction.spec.ts
│   └── empty-states.spec.ts
└── fixtures/
    ├── demo_purchases.xlsx
    └── demo_inventory.xlsx
```

**Example Test**:

#### `build-transaction.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test.describe('Build Transaction Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('http://localhost:3000');
    await page.fill('input[name=username]', 'demo');
    await page.fill('input[name=password]', 'demo123');
    await page.click('button[type=submit]');
    
    // Seed data via API
    await seedDemoData();
    
    // Navigate to analysis
    await page.goto('http://localhost:3000/dashboard/var');
  });
  
  test('should add future to transaction', async ({ page }) => {
    // Find first futures tile
    const tile = page.locator('.futures-tile').first();
    
    // Set quantity
    await tile.locator('input[type=number]').fill('2000');
    
    // Click add
    await tile.locator('button:has-text("Add to Transaction")').click();
    
    // Verify success banner
    await expect(page.locator('.notification')).toContainText('Added to transaction');
    
    // Verify tile state
    await expect(tile.locator('input[type=checkbox]')).toBeChecked();
    await expect(tile).toContainText('Added');
    
    // Navigate to execution page
    await page.click('text=Execute Transaction');
    
    // Verify item appears
    await expect(page.locator('.transaction-item')).toContainText('2,000 lbs');
  });
  
  test('should persist transaction across page reload', async ({ page }) => {
    // Add item
    await addFutureToTransaction(page, 'sugar', 2000);
    
    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Verify item still added
    const tile = page.locator('.futures-tile').first();
    await expect(tile).toContainText('Added');
    await expect(tile.locator('input[type=checkbox]')).toBeChecked();
  });
});
```

**Run Command**:
```bash
# Ensure services running
docker-compose up -d

# Run E2E tests
cd e2e
npx playwright test

# Or with UI
npx playwright test --ui
```

---

### 3.4 Database Integration Tests

**Goal**: Test multi-tenant isolation, data integrity, cascading deletes

```python
# backend/tests/integration/test_multi_tenant.py

async def test_customer_data_isolation(db_session):
    """Users from different customers should not see each other's data"""
    # Create two customers
    customer_a = Customer(name="Customer A")
    customer_b = Customer(name="Customer B")
    db_session.add_all([customer_a, customer_b])
    await db_session.commit()
    
    # Create purchases for each
    purchase_a = Purchase(customer_id=customer_a.id, commodity_id=..., quantity=1000)
    purchase_b = Purchase(customer_id=customer_b.id, commodity_id=..., quantity=2000)
    db_session.add_all([purchase_a, purchase_b])
    await db_session.commit()
    
    # Query as customer A
    result = await db_session.execute(
        select(Purchase).where(Purchase.customer_id == customer_a.id)
    )
    purchases = result.scalars().all()
    
    assert len(purchases) == 1
    assert purchases[0].quantity == 1000

async def test_cascade_delete_on_customer_removal(db_session):
    """Deleting customer should cascade to all related data"""
    customer = Customer(name="Test Customer")
    db_session.add(customer)
    await db_session.commit()
    
    # Add related data
    purchase = Purchase(customer_id=customer.id, ...)
    hedge_session = HedgeSession(customer_id=customer.id, ...)
    db_session.add_all([purchase, hedge_session])
    await db_session.commit()
    
    # Delete customer
    await db_session.delete(customer)
    await db_session.commit()
    
    # Verify cascades
    purchases = await db_session.execute(select(Purchase))
    sessions = await db_session.execute(select(HedgeSession))
    
    assert len(purchases.scalars().all()) == 0
    assert len(sessions.scalars().all()) == 0
```

---

### 3.5 Performance Tests

**Goal**: Ensure system handles realistic data volumes

```python
# backend/tests/performance/test_exposure_bucketing.py

def test_bucketing_performance_large_dataset():
    """Should process 10,000 purchases in < 5 seconds"""
    purchases = [create_purchase() for _ in range(10000)]
    
    start_time = time.time()
    buckets = create_exposure_buckets_bulk(purchases)
    duration = time.time() - start_time
    
    assert duration < 5.0
    assert len(buckets) > 0

def test_var_calculation_performance():
    """VaR timeline for 12 months should compute in < 2 seconds"""
    # Setup: 2 commodities, 100 exposure buckets, 365 days history
    
    start_time = time.time()
    timeline = calculate_var_timeline(start_date, end_date)
    duration = time.time() - start_time
    
    assert duration < 2.0
    assert len(timeline) == 12
```

---

## 4. Continuous Integration (Future)

**Platform**: GitHub Actions

**Workflow**:

```yaml
# .github/workflows/test.yml

name: Test Suite

on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: findemo
          POSTGRES_PASSWORD: test_pass
          POSTGRES_DB: findemo_test
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install pytest pytest-asyncio pytest-cov
      - name: Run tests
        run: cd backend && pytest --cov=app --cov-report=xml
      - name: Upload coverage
        uses: codecov/codecov-action@v3
  
  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: cd frontend && npm ci
      - name: Run tests
        run: cd frontend && npm test -- --coverage
  
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Start services
        run: docker-compose up -d
      - name: Wait for services
        run: sleep 10
      - name: Run Playwright
        run: cd e2e && npx playwright test
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: e2e/playwright-report/
```

---

## 5. Test Data Management

### Sample Data Files

Located in `data/`:
- `demo_purchases_v2.xlsx`: 22 purchases across sugar/flour
- `demo_inventory_v2.xlsx`: 2 inventory snapshots

### Generating Test Data

**Script** (future):
```python
# scripts/generate_test_data.py

def generate_purchases(num=100, commodities=['sugar', 'flour']):
    """Generate realistic purchase data"""
    purchases = []
    for i in range(num):
        commodity = random.choice(commodities)
        quantity = random.randint(500, 5000)
        price = random.uniform(0.30, 0.60)
        start_date = date.today() + timedelta(days=random.randint(-180, 180))
        end_date = start_date + timedelta(days=random.randint(1, 60))
        
        purchases.append({
            'commodity': commodity,
            'quantity': quantity,
            'price': price,
            'start': start_date,
            'end': end_date
        })
    
    return pd.DataFrame(purchases).to_excel('test_purchases.xlsx')
```

---

## 6. Testing Checklist for Production

Before production deployment:

### Functional
- [ ] All user flows work end-to-end
- [ ] VaR calculations mathematically correct
- [ ] Multi-tenant isolation verified
- [ ] Data validation prevents bad inputs
- [ ] Error handling graceful

### Performance
- [ ] Page load < 2 seconds
- [ ] API response times < 500ms (p95)
- [ ] Database queries optimized (EXPLAIN ANALYZE)
- [ ] Frontend bundle size < 1MB

### Security
- [ ] JWT expiration working
- [ ] SQL injection prevented (parameterized queries)
- [ ] CORS configured correctly
- [ ] Passwords hashed (bcrypt)
- [ ] Secrets not in git

### UX
- [ ] Mobile responsive
- [ ] Accessibility (WCAG 2.1 AA)
- [ ] Browser compatibility (Chrome, Firefox, Safari, Edge)
- [ ] Loading states for all async operations
- [ ] Error messages user-friendly

### DevOps
- [ ] Health check endpoints
- [ ] Logging configured
- [ ] Monitoring alerts
- [ ] Database backups automated
- [ ] Rollback procedure documented

---

## 7. Quick Test Commands Reference

```bash
# Manual smoke test
docker-compose up -d && \
  sleep 10 && \
  curl http://localhost:8000/ && \
  curl http://localhost:3000/

# Check database state
docker-compose exec postgres psql -U findemo -d findemo -c "
  SELECT 'purchases' as table, COUNT(*) FROM purchases UNION ALL
  SELECT 'futures', COUNT(*) FROM market_prices WHERE source LIKE 'mock%' UNION ALL
  SELECT 'sessions', COUNT(*) FROM hedge_sessions WHERE status = 'active';
"

# View backend logs (errors only)
docker-compose logs backend | grep -i error

# Reset to clean state
docker-compose down -v && docker-compose up -d

# Seed demo data via API
TOKEN=$(curl -s -X POST http://localhost:8000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo123"}' | jq -r '.access_token')

curl -X POST http://localhost:8000/data/seed \
  -H "Authorization: Bearer $TOKEN"

# Check current transaction
curl -s "http://localhost:8000/hedge-session/current" \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## Summary

**Current State**:
- ✅ Manual testing checklist complete
- ❌ No automated tests implemented yet

**Priority**:
1. **High**: VaR engine unit tests (when implemented)
2. **High**: E2E tests for critical flows (upload → add → execute)
3. **Medium**: Backend API tests
4. **Medium**: Frontend component tests
5. **Low**: Performance tests

**Next Steps**:
1. Implement VaR calculation logic (see AGENTS.md section 8)
2. Write backend unit tests for VaR engine
3. Set up Playwright for E2E tests
4. Add CI/CD pipeline (GitHub Actions)

---

**For immediate demo**: Use manual testing checklist (Section 1).
