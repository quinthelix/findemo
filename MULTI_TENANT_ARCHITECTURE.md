# Multi-Tenant Architecture

## Overview

The application supports **customer isolation** where each customer has their own data:

- **Demo Customer**: Pre-seeded with sample data for testing and demonstrations
- **Real Customers**: Upload their own data via Excel interface

## Data Isolation

### Customer-Specific Tables
Each of these tables has a `customer_id` column:
- `users` - User accounts per customer
- `purchases` - Historic procurement
- `inventory_snapshots` - Inventory levels
- `exposure_buckets` - Monthly exposure (derived)
- `hedge_sessions` - Active shopping cart
- `executed_hedges` - Completed hedges

### Shared Tables
These are global across all customers:
- `commodities` - Sugar and Flour (universal reference data)
- `market_prices` - Market data from Yahoo Finance/Stooq (universal)

## Demo Customer

**Customer ID**: `dddddddd-dddd-dddd-dddd-dddddddddddd`
**Customer Name**: `demo`
**Username**: `demo`
**Password**: `demo123`

The demo customer has:
- 14 sample purchases (Sugar and Flour from 2025-2026)
- 2 inventory snapshots
- Pre-calculated exposure buckets
- Sample market prices and futures contracts

## Adding New Customers

1. Insert customer record in `customers` table
2. Create user(s) for that customer
3. User uploads data via Excel interface
4. All operations automatically scoped to their `customer_id`

## Data Reset

Each customer can reset their transactional data:

```bash
POST /data/reset
```

This clears:
- Purchases
- Inventory snapshots
- Exposure buckets
- Hedge sessions
- Executed hedges

**Keeps:**
- User accounts
- Commodities (reference data)
- Market prices (shared data)

## Testing

Automated tests always run against the demo customer:
- Tests use demo customer credentials
- Seed data is consistent and predictable
- Real customer data never affected

## Security

- JWT tokens include `customer_id`
- All queries filter by `customer_id`
- Users cannot access other customers' data
- Database-level foreign key constraints enforce isolation

## Query Pattern

All customer data queries follow this pattern:

```python
result = await db.execute(
    select(Purchase).where(
        Purchase.customer_id == current_user.customer_id
    )
)
```

## Reset Before Demo

To ensure clean demo state:

```bash
# Login as demo user
curl -X POST http://localhost:8000/login \
  -d '{"username":"demo","password":"demo123"}'

# Get token from response, then reset
curl -X POST http://localhost:8000/data/reset \
  -H "Authorization: Bearer <token>"

# Check data status
curl http://localhost:8000/data/status \
  -H "Authorization: Bearer <token>"
```

After reset, re-upload seed data or let application regenerate from seed.sql.
