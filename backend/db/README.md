# Database Files

## File Structure

```
backend/db/
├── schema_v2.sql      # Complete database schema (tables, indexes, triggers)
├── seed_minimal.sql   # Minimal seed for production (commodities + users, NO demo data)
├── seed_demo.sql      # Demo seed for testing (includes demo user + test purchases/inventory)
└── README.md          # This file
```

---

## Files Explained

### 1. `schema_v2.sql` - Database Schema

**Purpose**: Defines all database tables, indexes, and constraints.

**Contains**:
- 10 tables: customers, users, commodities, purchases, inventory_snapshots, market_prices, exposure_buckets, hedge_sessions, hedge_session_items, executed_hedges
- All indexes for performance
- Foreign key constraints
- Triggers (e.g., updated_at)

**When to use**: Every time you initialize a new database.

**Usage**:
```bash
docker-compose exec postgres psql -U findemo -d findemo -f /path/to/schema_v2.sql
```

---

### 2. `seed_minimal.sql` - Production Seed

**Purpose**: Minimal data required to run the application for **real customers**.

**Contains**:
- ✅ Commodities (sugar, flour) - required by the system
- ✅ Customer: hedgymunchy
- ✅ Users: demo, avi
- ❌ NO purchases (customer uploads Excel)
- ❌ NO inventory (customer uploads Excel)
- ❌ NO market data (fetched from Yahoo Finance)

**When to use**: For production/real customer setup where they will upload their own data.

**Usage**:
```bash
# After applying schema
docker cp backend/db/seed_minimal.sql $(docker-compose ps -q postgres | head -1):/tmp/
docker-compose exec postgres psql -U findemo -d findemo -f /tmp/seed_minimal.sql
```

**Credentials**:
- User: `demo` / Password: `demo123`
- User: `avi` / Password: `avi123`
- Company: `hedgymunchy`

---

### 3. `seed_demo.sql` - Demo/Testing Seed

**Purpose**: Full test dataset for **automated testing** and **demonstrations**.

**Contains**:
- ✅ Commodities (sugar, flour)
- ✅ Demo customer (is_demo=true)
- ✅ Demo user
- ✅ 14 demo purchases (7 sugar, 7 flour)
- ✅ 2 inventory snapshots

**When to use**: 
- For automated tests (pytest)
- For demonstrations
- For development/testing the full workflow

**Usage**:
```bash
# After applying schema
docker cp backend/db/seed_demo.sql $(docker-compose ps -q postgres | head -1):/tmp/
docker-compose exec postgres psql -U findemo -d findemo -f /tmp/seed_demo.sql
```

**Credentials**:
- User: `demo` / Password: `demo123`
- Company: `demo` (is_demo=true)

---

## Quick Start Commands

### Production Setup (Clean Database)

```bash
# 1. Create database
docker-compose exec postgres psql -U findemo -d postgres -c "CREATE DATABASE findemo;"

# 2. Enable UUID
docker-compose exec postgres psql -U findemo -d findemo -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"

# 3. Apply schema
docker cp backend/db/schema_v2.sql $(docker-compose ps -q postgres | head -1):/tmp/
docker-compose exec postgres psql -U findemo -d findemo -f /tmp/schema_v2.sql

# 4. Apply minimal seed (NO demo data)
docker cp backend/db/seed_minimal.sql $(docker-compose ps -q postgres | head -1):/tmp/
docker-compose exec postgres psql -U findemo -d findemo -f /tmp/seed_minimal.sql

# 5. Restart backend
docker-compose restart backend
```

Login with `demo/demo123` or `avi/avi123` and upload your Excel files.

---

### Testing Setup (With Demo Data)

```bash
# 1-3. Same as above (database, UUID, schema)

# 4. Apply demo seed (WITH test data)
docker cp backend/db/seed_demo.sql $(docker-compose ps -q postgres | head -1):/tmp/
docker-compose exec postgres psql -U findemo -d findemo -f /tmp/seed_demo.sql

# 5. Restart backend
docker-compose restart backend
```

Login with `demo/demo123` - you'll see 14 purchases and VaR calculations ready.

---

## Reset Database

To start fresh:

```bash
# Drop and recreate schema
docker-compose exec postgres psql -U findemo -d findemo << 'SQL'
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO findemo;
SQL

# Then reapply schema + seed (minimal or demo)
```

---

## Notes

- **Always apply `schema_v2.sql` first**
- **Then apply ONE seed file**: either `seed_minimal.sql` OR `seed_demo.sql`
- Don't mix seeds - choose based on your use case:
  - Real customer? → `seed_minimal.sql`
  - Testing/Demo? → `seed_demo.sql`
