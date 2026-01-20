# Reset & Re-Seed Guide

## The Reset/Seed Workflow

After testing, you often want a clean slate. Here's how:

```
┌─────────────┐
│  Has Data   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ POST /data  │  ← Clears transactional data
│   /reset    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Empty DB   │
└──────┬──────┘
       │
       ▼  (Choose one of 3 options below)
┌─────────────┐
│ Re-populate │
│    Data     │
└─────────────┘
```

---

## Option 1: API Seed Endpoint ⭐ (Easiest)

**Use when**: Quick reset during testing

### Via Browser (FastAPI GUI)
1. Open http://localhost:8000/docs
2. Authorize with `demo` / `demo123`
3. Run **POST /data/reset**
4. Run **POST /data/seed** ← Re-populates data instantly

### Via Command Line
```bash
# Get token
TOKEN=$(curl -s -X POST http://localhost:8000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo123"}' | jq -r .access_token)

# Reset data
curl -X POST http://localhost:8000/data/reset \
  -H "Authorization: Bearer $TOKEN"

# Re-seed data
curl -X POST http://localhost:8000/data/seed \
  -H "Authorization: Bearer $TOKEN"

# Check status
curl -s http://localhost:8000/data/status \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Output**:
```json
{
  "message": "Demo data seeded successfully",
  "purchases_created": 14,
  "inventory_snapshots_created": 2,
  "exposure_buckets_created": 84
}
```

**Advantages**:
- ✅ Instant (no container restart)
- ✅ Works from API docs GUI
- ✅ Only affects demo customer
- ✅ Includes exposure bucket generation

**Limitations**:
- Only works for demo customer (security feature)
- Doesn't re-create market prices (those are shared)

---

## Option 2: SQL Script

**Use when**: Need full control or want to seed different data

### Step 1: Create custom seed script

```sql
-- custom_seed.sql
BEGIN;

-- Clear demo customer data
DELETE FROM executed_hedges WHERE customer_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
DELETE FROM hedge_sessions WHERE customer_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
DELETE FROM exposure_buckets WHERE customer_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
DELETE FROM inventory_snapshots WHERE customer_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
DELETE FROM purchases WHERE customer_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

-- Insert your custom data here
INSERT INTO purchases (customer_id, commodity_id, purchase_date, delivery_start_date, delivery_end_date, quantity, unit, purchase_price)
VALUES 
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', '2026-03-01', '2026-04-01', '2026-06-30', 100000, 'kg', 0.55);

COMMIT;
```

### Step 2: Run script

```bash
docker-compose exec postgres psql -U findemo -d findemo_db -f /path/to/custom_seed.sql
```

**Or directly**:
```bash
docker-compose exec postgres psql -U findemo -d findemo_db << 'EOF'
DELETE FROM purchases WHERE customer_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
-- ... your inserts
EOF
```

**Advantages**:
- ✅ Full control over data
- ✅ Can seed any data structure
- ✅ Good for complex test scenarios

**Disadvantages**:
- ⚠️ Need to manually handle exposure buckets
- ⚠️ More complex

---

## Option 3: Container Restart (Full Reset)

**Use when**: Want completely fresh database

### Full Reset (Nuclear Option)

```bash
# Stop containers
docker-compose down

# Remove database volume (deletes everything!)
docker volume rm findemo_postgres_data

# Start fresh (runs schema.sql and seed.sql)
docker-compose up -d
```

**This recreates**:
- ✅ All tables
- ✅ Demo customer
- ✅ Demo user
- ✅ Commodities
- ✅ Market prices
- ✅ All seed data

**Advantages**:
- ✅ Complete fresh start
- ✅ Fixes any database corruption
- ✅ Resets everything to initial state

**Disadvantages**:
- ⚠️ Deletes ALL customers (not just demo)
- ⚠️ Takes longer (~10 seconds)
- ⚠️ Requires container restart

---

## Quick Reference

| Method | Speed | Use Case | Command |
|--------|-------|----------|---------|
| **API Seed** | ⚡ Fast | Quick testing loop | `POST /data/seed` |
| **SQL Script** | 🔧 Medium | Custom data | `psql < script.sql` |
| **Container Restart** | 🐢 Slow | Full reset | `docker-compose down -v && up` |

---

## Recommended Workflow

### During Development/Testing
```bash
# 1. Reset when needed
POST /data/reset

# 2. Re-seed instantly
POST /data/seed

# 3. Continue testing
```

### Before Demo Presentation
```bash
# Ensure clean state
curl -X POST http://localhost:8000/data/reset -H "Authorization: Bearer $TOKEN"
curl -X POST http://localhost:8000/data/seed -H "Authorization: Bearer $TOKEN"
```

### When Database is Corrupted
```bash
# Nuclear option
docker-compose down -v
docker-compose up -d
```

---

## Verification After Seed

Check data was created:

```bash
# Via API
curl -s http://localhost:8000/data/status -H "Authorization: Bearer $TOKEN" | jq

# Expected output:
{
  "customer_id": "dddddddd-dddd-dddd-dddd-dddddddddddd",
  "counts": {
    "purchases": 14,
    "inventory_snapshots": 2,
    "exposure_buckets": 84,
    "hedge_sessions": 0,
    "executed_hedges": 0
  }
}
```

**Via Database**:
```bash
docker-compose exec postgres psql -U findemo -d findemo_db -c \
  "SELECT COUNT(*) FROM purchases WHERE customer_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';"
```

---

## Security Notes

**Seed Endpoint Protection**:
- ✅ Only works for demo customer (`is_demo = true`)
- ✅ Requires valid JWT token
- ✅ Real customers cannot use seed endpoint
- ✅ Prevents accidental data injection

**Try to seed as non-demo customer**:
```json
{
  "detail": "Seeding is only allowed for demo customer"
}
```

---

## What Gets Seeded

The `/data/seed` endpoint creates:

**Purchases**: 14 records
- 7 Sugar purchases (2025-07 to 2026-01)
- 7 Flour purchases (2025-07 to 2026-01)

**Inventory Snapshots**: 2 records
- Sugar: 15,000 kg (2026-01-20)
- Flour: 12,000 kg (2026-01-20)

**Exposure Buckets**: ~84 records
- Auto-generated from purchases
- Monthly buckets spanning delivery periods

**Market Prices**: NOT seeded (shared across customers)
- Use `POST /market-data/refresh` to fetch

---

## Common Scenarios

### Scenario 1: "I want to test with fresh data"
```bash
POST /data/reset
POST /data/seed
# Done! Continue testing
```

### Scenario 2: "I uploaded wrong data"
```bash
POST /data/reset
# Upload correct Excel file via /upload/purchases
```

### Scenario 3: "Database seems broken"
```bash
docker-compose down -v
docker-compose up -d
# Wait 10 seconds for init
```

### Scenario 4: "I want custom test data"
```bash
POST /data/reset
# Create custom SQL script
docker-compose exec postgres psql -U findemo -d findemo_db < custom.sql
# Or upload via Excel
```

---

## Automated Testing Pattern

In your test setup:

```python
import pytest
import httpx

@pytest.fixture(scope="function")
async def clean_demo_data():
    """Reset and seed before each test"""
    async with httpx.AsyncClient() as client:
        # Login
        response = await client.post(
            "http://localhost:8000/login",
            json={"username": "demo", "password": "demo123"}
        )
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Reset and seed
        await client.post("http://localhost:8000/data/reset", headers=headers)
        await client.post("http://localhost:8000/data/seed", headers=headers)
        
        yield headers
        
        # Optional: cleanup after test
        # await client.post("http://localhost:8000/data/reset", headers=headers)
```

---

## Summary

**Recommended for most use cases**: Option 1 (API Seed Endpoint)
- Fast, safe, convenient
- Works from GUI or CLI
- Includes automatic exposure bucketing

**Your typical workflow**:
1. Test something
2. `POST /data/reset` (clean up)
3. `POST /data/seed` (restore)
4. Test again

**No need to restart containers!** 🎉
