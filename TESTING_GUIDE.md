# Testing Guide - Multi-Tenant Commodity Hedging & VaR Demo

## Prerequisites

- Docker and Docker Compose running
- Containers started: `docker-compose up -d`

## Current Status

✅ **Phase 1: Database** - Complete with multi-tenant support
✅ **Phase 2: Backend API** - Complete with customer isolation  
🚧 **Phase 3: Frontend** - In progress (API client ready)

---

## 1. FastAPI Interactive GUI (Recommended)

**Open in browser:** http://localhost:8000/docs

### Steps:
1. Click **"Authorize"** button (top right with lock icon)
2. Enter credentials:
   - **username**: `demo`
   - **password**: `demo123`
3. Click **"Authorize"** then **"Close"**
4. Now you can test any endpoint by clicking "Try it out"

### Test Sequence:
1. **GET /data/status** - See current data counts for demo customer
2. **POST /data/reset** - Clear all demo customer data (safe to test)
3. **POST /upload/purchases** - Upload Excel file (need to create sample)
4. **POST /market-data/refresh** - Fetch market data from Yahoo Finance
5. **GET /var/timeline** - Calculate VaR (requires data uploaded first)

---

## 2. Command Line Testing

### A. Login and Get Token

```bash
# Login
curl -X POST http://localhost:8000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo123"}' | jq

# Save token to variable
TOKEN=$(curl -s -X POST http://localhost:8000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo123"}' | jq -r .access_token)

echo $TOKEN
```

### B. Check Data Status

```bash
curl -s http://localhost:8000/data/status \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Expected Output:**
```json
{
  "customer_id": "dddddddd-dddd-dddd-dddd-dddddddddddd",
  "counts": {
    "purchases": 14,
    "inventory_snapshots": 2,
    "exposure_buckets": 0,
    "hedge_sessions": 0,
    "executed_hedges": 0
  }
}
```

### C. Reset and Re-Seed Data (Safe for Demo Customer)

```bash
# Reset (clears all data)
curl -X POST http://localhost:8000/data/reset \
  -H "Authorization: Bearer $TOKEN" | jq

# Re-seed (restores demo data)
curl -X POST http://localhost:8000/data/seed \
  -H "Authorization: Bearer $TOKEN" | jq
```

### D. Get VaR Timeline

```bash
curl -s "http://localhost:8000/var/timeline?confidence_level=0.95" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### E. Get Available Futures Contracts

```bash
curl -s http://localhost:8000/market-data/futures \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## 3. Database Direct Testing

### A. Connect to PostgreSQL

```bash
docker-compose exec postgres psql -U findemo -d findemo_db
```

### B. Check Multi-Tenant Setup

```sql
-- See all customers
SELECT * FROM customers;

-- See demo customer data
SELECT customer_id, username FROM users;

-- Count purchases per customer
SELECT c.name, COUNT(p.id) as purchase_count
FROM customers c
LEFT JOIN purchases p ON c.id = p.customer_id
GROUP BY c.name;

-- Check exposure buckets
SELECT customer_id, COUNT(*) as bucket_count, SUM(quantity) as total_quantity
FROM exposure_buckets
GROUP BY customer_id;
```

### C. Manual Data Inspection

```sql
-- See demo customer purchases
SELECT 
    p.purchase_date,
    co.name as commodity,
    p.quantity,
    p.purchase_price
FROM purchases p
JOIN commodities co ON p.commodity_id = co.id
WHERE p.customer_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
ORDER BY p.purchase_date;

-- Check market prices
SELECT 
    c.name as commodity,
    mp.price_date,
    mp.contract_month,
    mp.price,
    mp.source
FROM market_prices mp
JOIN commodities c ON mp.commodity_id = c.id
ORDER BY c.name, mp.price_date DESC
LIMIT 20;
```

---

## 4. Testing Multi-Tenancy

### Verify Data Isolation

**Goal**: Ensure demo customer data is isolated

```bash
# 1. Login as demo
TOKEN_DEMO=$(curl -s -X POST http://localhost:8000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo123"}' | jq -r .access_token)

# 2. Check demo data
curl -s http://localhost:8000/data/status \
  -H "Authorization: Bearer $TOKEN_DEMO" | jq

# 3. Reset demo data
curl -X POST http://localhost:8000/data/reset \
  -H "Authorization: Bearer $TOKEN_DEMO" | jq

# 4. Verify data cleared
curl -s http://localhost:8000/data/status \
  -H "Authorization: Bearer $TOKEN_DEMO" | jq
```

---

## 5. Expected Test Results

### After Fresh Start (with seed data):
- ✅ 14 purchases (7 sugar, 7 flour)
- ✅ 2 inventory snapshots
- ✅ ~22 market prices (historical + futures)
- ⚠️ 0 exposure buckets (need to run bucketing)
- ✅ 0 hedge sessions (none created yet)
- ✅ 0 executed hedges

### After Reset:
- ✅ All counts should be 0
- ✅ User still exists
- ✅ Commodities still exist
- ✅ Market prices still exist (shared data)

---

## 6. Common Issues & Solutions

### Issue: "Internal Server Error" on login
**Solution**: Check backend logs:
```bash
docker-compose logs backend --tail 50
```

### Issue: Exposure buckets not created
**Solution**: Trigger exposure bucketing:
```bash
# Upload purchases triggers auto-bucketing
# Or call exposure rebuild endpoint (if implemented)
```

### Issue: VaR calculation fails
**Check**:
1. Do you have purchases uploaded?
2. Do you have market prices?
3. Are exposure buckets generated?

```bash
curl -s http://localhost:8000/data/status \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## 7. Next Steps for Full Testing

### Create Sample Excel Files

You'll need to create sample Excel files to test upload:

**purchases_sample.xlsx**:
| commodity | purchase_date | delivery_start_date | delivery_end_date | quantity | unit | purchase_price |
|-----------|--------------|---------------------|-------------------|----------|------|----------------|
| sugar     | 2026-02-01   | 2026-03-01         | 2026-05-31        | 50000    | kg   | 0.53           |
| flour     | 2026-02-01   | 2026-03-01         | 2026-05-31        | 40000    | kg   | 0.41           |

**inventory_sample.xlsx**:
| date       | commodity | quantity |
|------------|-----------|----------|
| 2026-01-20 | sugar     | 20000    |
| 2026-01-20 | flour     | 15000    |

### Upload Test

```bash
curl -X POST http://localhost:8000/upload/purchases \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@purchases_sample.xlsx"
```

---

## 8. Automated Test Suite

### Run Python Tests (when implemented)

```bash
# Run all tests
docker-compose exec backend pytest tests/ -v

# Run specific test file
docker-compose exec backend pytest tests/test_var_engine.py -v

# Run database tests
docker-compose exec backend pytest tests/test_database.py -v
```

---

## Summary

**Working**:
- ✅ Multi-tenant database architecture
- ✅ Demo customer with seeded data
- ✅ Authentication with customer_id in JWT
- ✅ Data reset endpoint per customer
- ✅ Data status endpoint
- ✅ All API endpoints implemented

**To Test**:
- 📋 Upload Excel files (need sample files)
- 📋 VaR calculation end-to-end
- 📋 Hedge session workflow
- 📋 Market data refresh (hits Yahoo Finance)

**Demo Customer Credentials**:
- Username: `demo`
- Password: `demo123`
- Customer ID: `dddddddd-dddd-dddd-dddd-dddddddddddd`
