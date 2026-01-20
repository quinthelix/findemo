# Testing with Real Data - Complete Guide

## Overview

This guide walks you through testing the upload functionality with your Excel files using a separate test customer (not the demo customer).

---

## Step 1: Create a New Test Customer and User

### Option A: Using SQL directly

```sql
-- Connect to the database
docker-compose exec postgres psql -U findemo -d findemo

-- Create test customer
INSERT INTO customers (name, email) 
VALUES ('Test Company', 'test@example.com')
RETURNING id;
-- Note the ID (e.g., '123e4567-e89b-12d3-a456-426614174000')

-- Create test user for this customer
INSERT INTO users (username, password_hash, customer_id)
VALUES (
  'testuser',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYvIl6YeoRu',  -- password: test123
  '123e4567-e89b-12d3-a456-426614174000'  -- Use the customer ID from above
);
```

### Option B: Using a Python script

Create `create_test_user.py`:

```python
import asyncio
import asyncpg
from app.services.auth_service import hash_password

async def create_test_customer():
    conn = await asyncpg.connect(
        user='findemo',
        password='findemo_dev_password',
        database='findemo',
        host='localhost',
        port=5432
    )
    
    # Create customer
    customer_id = await conn.fetchval(
        "INSERT INTO customers (name, email) VALUES ($1, $2) RETURNING id",
        'Test Company', 'test@example.com'
    )
    
    print(f"Created customer: {customer_id}")
    
    # Create user
    password_hash = hash_password('test123')
    user_id = await conn.fetchval(
        "INSERT INTO users (username, password_hash, customer_id) VALUES ($1, $2, $3) RETURNING id",
        'testuser', password_hash, customer_id
    )
    
    print(f"Created user: {user_id}")
    print(f"Login credentials: testuser / test123")
    
    await conn.close()

if __name__ == "__main__":
    asyncio.run(create_test_customer())
```

Run it in the backend container:
```bash
docker-compose exec backend python /app/create_test_user.py
```

---

## Step 2: Test the Upload Flow

### 2.1 Login with Test User

1. Navigate to `http://localhost:5173`
2. Login with:
   - Username: `testuser`
   - Password: `test123`

### 2.2 Upload Files

1. Go to "Data Upload" tab (should be default after login)
2. Upload `data/demo_purchases.xlsx`
3. Upload `data/demo_inventory.xlsx`
4. Check for success messages

### 2.3 Verify Data Upload

Check the database:

```sql
-- Connect to database
docker-compose exec postgres psql -U findemo -d findemo

-- Check uploaded purchases
SELECT 
    c.name as customer,
    com.name as commodity,
    p.purchase_date,
    p.quantity,
    p.unit,
    p.purchase_price
FROM purchases p
JOIN customers c ON p.customer_id = c.id
JOIN commodities com ON p.commodity_id = com.id
WHERE c.name = 'Test Company'
ORDER BY p.purchase_date
LIMIT 5;

-- Check uploaded inventory
SELECT 
    c.name as customer,
    com.name as commodity,
    i.date,
    i.quantity
FROM inventory_snapshots i
JOIN customers c ON i.customer_id = c.id
JOIN commodities com ON i.commodity_id = com.id
WHERE c.name = 'Test Company'
ORDER BY i.date
LIMIT 5;

-- Count records
SELECT 
    c.name as customer,
    COUNT(p.id) as purchase_count
FROM purchases p
JOIN customers c ON p.customer_id = c.id
WHERE c.name = 'Test Company'
GROUP BY c.name;

SELECT 
    c.name as customer,
    COUNT(i.id) as inventory_count
FROM inventory_snapshots i
JOIN customers c ON i.customer_id = c.id
WHERE c.name = 'Test Company'
GROUP BY c.name;
```

---

## Step 3: Refresh Market Data

After uploading data, refresh market data:

```bash
curl -X POST http://localhost:8000/market-data/refresh \
  -H "Authorization: Bearer <your_token_here>" \
  -H "Content-Type: application/json"
```

Or use the frontend (if there's a refresh button on Data Upload page).

---

## Step 4: View VaR Analysis

1. Navigate to "Value at Risk" tab
2. You should see:
   - VaR chart with historical and forward VaR
   - Commodity breakdown (Sugar, Flour)
   - Available futures contracts
3. Click on a commodity to see market prices

---

## Step 5: Test Hedge Workflow

1. On "Value at Risk" page:
   - Click ⚡ **Eval** button on a future to preview impact
   - Click ✓ **Add** to add to hedge session
   - Adjust quantities
2. Navigate to "Trade Execution" page
3. Review hedge session
4. Click **Execute** to finalize
5. Navigate to "Portfolio" page to see executed hedges

---

## Cleanup: Reset Test Customer Data

If you want to start fresh:

```sql
-- Connect to database
docker-compose exec postgres psql -U findemo -d findemo

-- Delete all data for test customer (cascades to purchases, inventory, etc.)
DELETE FROM customers WHERE name = 'Test Company';
```

Then repeat Step 1 to create a new test customer.

---

## Troubleshooting

### Upload fails with "Missing columns"
- Check that Excel file has exact column names (case-sensitive)
- Check for extra spaces in column headers

### Upload fails with "Invalid commodity"
- Ensure commodity values are exactly "sugar" or "flour" (lowercase)

### No data appears in VaR chart
- Check that market data was refreshed
- Check that exposure buckets were created
- Query database to verify data exists

### Can't see uploaded data
- Make sure you're logged in as `testuser` (not `demo`)
- Check `customer_id` matches in database

---

## Quick Commands Reference

```bash
# View Docker logs
docker-compose logs backend -f

# Restart backend
docker-compose restart backend

# Connect to database
docker-compose exec postgres psql -U findemo -d findemo

# Run backend tests
docker-compose exec backend pytest

# View all customers
docker-compose exec postgres psql -U findemo -d findemo -c "SELECT * FROM customers;"

# View all users
docker-compose exec postgres psql -U findemo -d findemo -c "SELECT username, customer_id FROM users;"
```

---

## Expected Results

After successful upload with 26 rows each:

- **Purchases:** 26 records in database
- **Inventory:** 26 records in database
- **Exposure Buckets:** Auto-generated from purchases
- **VaR Chart:** Shows risk profile based on uploaded data
- **Market Prices:** Shows for Sugar and Flour
- **Futures:** Available for hedging

---

## Notes

- Demo customer (`demo/demo123`) has seeded data - don't modify
- Test customer (`testuser/test123`) is isolated - safe to experiment
- All data is customer-specific (multi-tenant architecture)
- Excel files are validated before import
- Errors will show specific validation messages
