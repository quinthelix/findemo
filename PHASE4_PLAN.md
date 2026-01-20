# Phase 4: Integration Testing & End-to-End Validation

**Goal:** Validate that the complete system works end-to-end with all components integrated.

---

## Overview

We have:
- ✅ Backend API (FastAPI + PostgreSQL)
- ✅ Frontend UI (React + TypeScript)
- ✅ Docker containers configured
- ✅ Database with seed data
- ✅ Individual component tests

**Now we need to:**
- 🎯 Run the full stack together
- 🎯 Test complete user workflows
- 🎯 Validate API contracts match frontend expectations
- 🎯 Fix any integration issues
- 🎯 Ensure data flows correctly through all layers

---

## Phase 4 Tasks

### Task 1: Start Full Stack System
**Objective:** Get all containers running together

```bash
# Clean start
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d

# Verify all containers are running
docker-compose ps

# Check logs
docker-compose logs -f
```

**Expected Result:**
- ✅ PostgreSQL running on port 5432
- ✅ Backend running on port 8000
- ✅ Frontend running on port 3000 (Docker) or 5173 (local npm)

---

### Task 2: Database Initialization
**Objective:** Ensure database is properly set up with demo data

```bash
# Access PostgreSQL
docker-compose exec postgres psql -U findemo -d findemo

# Run schema (if needed)
docker-compose exec postgres psql -U findemo -d findemo < db/schema_v2.sql

# Run seed data
docker-compose exec postgres psql -U findemo -d findemo < db/seed_v2.sql

# Verify data
docker-compose exec postgres psql -U findemo -d findemo -c "SELECT * FROM customers;"
docker-compose exec postgres psql -U findemo -d findemo -c "SELECT * FROM users;"
docker-compose exec postgres psql -U findemo -d findemo -c "SELECT * FROM commodities;"
```

**Expected Result:**
- ✅ Demo customer exists
- ✅ Demo user (demo/demo123) exists
- ✅ Commodities (sugar, flour) exist
- ✅ No schema errors

---

### Task 3: Backend Health Check
**Objective:** Verify backend APIs are accessible

```bash
# Test health endpoint
curl http://localhost:8000/health

# Test login
curl -X POST http://localhost:8000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo123"}'

# Save token
TOKEN=$(curl -s -X POST http://localhost:8000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo123"}' | jq -r '.access_token')

echo $TOKEN

# Test authenticated endpoint
curl http://localhost:8000/var/timeline \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Result:**
- ✅ Health check returns 200 OK
- ✅ Login returns JWT token
- ✅ Authenticated endpoints work with token

---

### Task 4: Frontend Connection Test
**Objective:** Verify frontend can reach backend

1. **Open frontend:** http://localhost:3000
2. **Open browser console** (F12)
3. **Test login:**
   - Username: `demo`
   - Password: `demo123`
4. **Check console for errors**
5. **Check Network tab for API calls**

**Expected Result:**
- ✅ Login successful
- ✅ JWT token stored in localStorage
- ✅ Redirected to /dashboard/upload
- ✅ No CORS errors
- ✅ No 401/403 errors

---

### Task 5: Data Upload Workflow Test
**Objective:** Test Excel file upload and processing

**Test Steps:**
1. Navigate to Data Upload page
2. Select a test Excel file (create if needed)
3. Upload Purchases file
4. Upload Inventory file
5. Click "Refresh Market Data"
6. Click "Proceed to Analysis"

**Backend Verification:**
```bash
# Check if data was ingested
docker-compose exec postgres psql -U findemo -d findemo -c "SELECT COUNT(*) FROM purchases;"
docker-compose exec postgres psql -U findemo -d findemo -c "SELECT COUNT(*) FROM inventory_snapshots;"
docker-compose exec postgres psql -U findemo -d findemo -c "SELECT COUNT(*) FROM market_prices;"
```

**Expected Result:**
- ✅ File uploads succeed
- ✅ Data appears in database
- ✅ Market data is fetched
- ✅ No errors in backend logs

---

### Task 6: Value at Risk Workflow Test
**Objective:** Test VaR calculation and futures interaction

**Test Steps:**
1. Navigate to Value at Risk page
2. Verify VaR chart loads
3. Verify futures list appears on right sidebar
4. Set quantity for a future (e.g., 1000)
5. Click "Evaluate" button
6. Verify VaR updates
7. Click "Add to Portfolio" button
8. Verify item added to hedge session

**API Calls to Verify:**
```bash
# Get VaR timeline
curl http://localhost:8000/var/timeline?start_date=2026-01-01&end_date=2026-12-31 \
  -H "Authorization: Bearer $TOKEN"

# Get futures contracts
curl http://localhost:8000/market-data/futures \
  -H "Authorization: Bearer $TOKEN"

# Get current hedge session
curl http://localhost:8000/hedge-session/current \
  -H "Authorization: Bearer $TOKEN"

# Add hedge item
curl -X POST http://localhost:8000/hedge-session/add \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"commodity":"sugar","contract_month":"2026-03-01","quantity":1000,"price_snapshot":0.52}'
```

**Expected Result:**
- ✅ VaR chart displays data
- ✅ Futures list populates
- ✅ Evaluate updates VaR
- ✅ Add creates hedge session item
- ✅ No calculation errors

---

### Task 7: Trade Execution Workflow Test
**Objective:** Test hedge execution flow

**Test Steps:**
1. Navigate to Trade Execution page
2. Verify hedge session items appear
3. Modify quantity for an item
4. Remove an item (test remove button)
5. Click "Execute All"
6. Verify success message
7. Check executed hedges

**API Calls to Verify:**
```bash
# Get hedge session
curl http://localhost:8000/hedge-session/current \
  -H "Authorization: Bearer $TOKEN"

# Update quantity
curl -X POST http://localhost:8000/hedge-session/update \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"commodity":"sugar","contract_month":"2026-03-01","quantity":2000}'

# Remove item
curl -X DELETE "http://localhost:8000/hedge-session/remove?commodity=sugar&contract_month=2026-03-01" \
  -H "Authorization: Bearer $TOKEN"

# Execute
curl -X POST http://localhost:8000/hedge-session/execute \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Result:**
- ✅ Hedge session loads correctly
- ✅ Updates persist
- ✅ Remove works
- ✅ Execute completes successfully
- ✅ Session marked as executed

---

### Task 8: Portfolio Workflow Test
**Objective:** Test executed hedges display

**Test Steps:**
1. Navigate to Portfolio page
2. Verify executed hedges appear
3. Check summary statistics
4. Verify commodity breakdown

**Note:** Currently using mock data. Need to implement:
```
GET /portfolio/executed-hedges
```

**Backend Verification:**
```bash
# Check executed hedges
docker-compose exec postgres psql -U findemo -d findemo -c "SELECT * FROM executed_hedges;"
```

**Expected Result:**
- ✅ Executed hedges display
- ✅ Summary shows correct totals
- ✅ Breakdown by commodity works

---

### Task 9: API Contract Validation
**Objective:** Ensure frontend expectations match backend responses

**Review:**
1. Compare `FRONTEND_CHANGES.md` with actual API responses
2. Verify all TypeScript types in `frontend/src/types/api.ts` match backend
3. Test edge cases (empty data, errors, missing fields)

**Specific Checks:**
- [ ] VaR timeline response structure
- [ ] Futures contracts include all required fields
- [ ] Hedge session response matches frontend types
- [ ] Execute hedge response includes final VaR
- [ ] Error responses are handled gracefully

---

### Task 10: Error Handling Test
**Objective:** Verify system handles errors gracefully

**Test Cases:**
1. **Invalid login credentials**
2. **Expired JWT token**
3. **Missing required fields in API calls**
4. **File upload with invalid format**
5. **Empty database (no futures available)**
6. **Network timeout**
7. **Backend service down**

**Expected Result:**
- ✅ User-friendly error messages
- ✅ No crashes or blank screens
- ✅ Appropriate HTTP status codes
- ✅ Clear error logging

---

### Task 11: Performance Test
**Objective:** Ensure system performs adequately

**Test:**
1. Measure VaR calculation time
2. Measure API response times
3. Check frontend render performance
4. Monitor Docker resource usage

**Benchmarks:**
- VaR calculation: < 2 seconds
- API calls: < 500ms
- Page load: < 2 seconds
- Frontend render: < 100ms

---

### Task 12: Multi-User Test (Optional)
**Objective:** Test multi-tenancy

**Test:**
1. Create second customer in database
2. Create second user account
3. Login with both users (different browsers)
4. Verify data isolation

**Expected Result:**
- ✅ Each customer sees only their data
- ✅ No data leakage between customers
- ✅ Hedge sessions are isolated

---

## Integration Issues to Watch For

### 1. CORS Issues
- Verify frontend and backend CORS settings
- Check browser console for CORS errors
- Ensure OPTIONS requests succeed

### 2. Authentication Flow
- Token refresh mechanism (if implemented)
- Token expiration handling
- Logout clears token properly

### 3. Data Type Mismatches
- Date formats (ISO 8601)
- Number precision (floats vs integers)
- Null vs undefined handling

### 4. Race Conditions
- Multiple simultaneous API calls
- State updates in React
- Database transactions

### 5. Missing Endpoints
- Portfolio endpoint (currently mock data)
- Data reset/seed endpoints
- Market data refresh status

---

## Success Criteria

### ✅ Phase 4 Complete When:

1. **Full stack runs without errors**
   - All containers healthy
   - No startup errors
   - Logs are clean

2. **All workflows work end-to-end**
   - Login → Upload → Analysis → Execute → Portfolio
   - No breaking errors
   - Data persists correctly

3. **API contracts validated**
   - Frontend types match backend responses
   - All required fields present
   - Error handling works

4. **Performance acceptable**
   - VaR calculations fast enough
   - UI responsive
   - No significant lag

5. **Documentation updated**
   - Known issues documented
   - Workarounds noted
   - Next steps identified

---

## Known Issues to Address

Based on `FRONTEND_CHANGES.md`:

### High Priority
1. **Portfolio Endpoint Missing**
   - Currently using mock data
   - Need to implement: `GET /portfolio/executed-hedges`

2. **Evaluate Button Behavior Unclear**
   - Does it update hedge session or just preview?
   - Need to document expected behavior

3. **Contract Unit Information**
   - Currently hardcoded (sugar=50k, flour=100k)
   - Should come from API response

### Medium Priority
4. **Data Upload Flow**
   - Excel upload endpoints exist but need testing
   - Validate file format handling

5. **Hedge Session Workflow**
   - Document complete flow
   - Clarify when session is created/updated

### Low Priority
6. **Market Data Refresh**
   - Add loading indicators
   - Show last refresh time

---

## Next Steps After Phase 4

1. **Phase 5: Documentation & Deployment**
   - Create comprehensive README
   - Document API endpoints
   - Create deployment guide
   - Add screenshots

2. **Potential Improvements**
   - Add real-time updates (WebSockets)
   - Implement data export (PDF/Excel)
   - Add more charting options
   - Enhanced error reporting

---

## Commands Reference

```bash
# Start system
docker-compose up -d

# Stop system
docker-compose down

# View logs
docker-compose logs -f [service]

# Restart service
docker-compose restart [service]

# Rebuild
docker-compose build --no-cache [service]

# Database access
docker-compose exec postgres psql -U findemo -d findemo

# Backend shell
docker-compose exec backend bash

# Frontend shell
docker-compose exec frontend sh

# Run backend tests
docker-compose exec backend pytest

# Run frontend tests
docker-compose exec frontend npm test

# Clean everything
docker-compose down -v
docker system prune -a
```

---

**Ready to begin Phase 4!** Start with Task 1 and work through each task systematically.
