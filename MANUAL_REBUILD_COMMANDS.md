# Manual Clean Rebuild Commands

Follow these commands step-by-step for a complete clean rebuild.

## Prerequisites

```bash
cd /Users/yonihalevi/dev/findemo
```

---

## Step 1: Stop and Clean Docker

```bash
# Stop all services
docker-compose down -v

# Remove Findemo images
docker rmi findemo-backend findemo-frontend findemo_backend findemo_frontend 2>/dev/null || true

# Optional: Full Docker cleanup (WARNING: affects ALL Docker resources)
# docker system prune -a --volumes -f
```

---

## Step 2: Clean Generated Files

```bash
# Remove Python cache
find backend -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find backend -type f -name "*.pyc" -delete 2>/dev/null || true
find backend -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
find backend -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true

# Remove frontend cache
rm -rf frontend/node_modules/.cache 2>/dev/null || true
rm -rf frontend/dist 2>/dev/null || true
```

---

## Step 3: Verify Git Status

```bash
# Check for any accidentally committed generated files
git status

# If you see any __pycache__, *.pyc, *.egg-info in tracked files:
git rm -r --cached backend/**/__pycache__ 2>/dev/null || true
git rm --cached backend/**/*.pyc 2>/dev/null || true
```

---

## Step 4: Build Fresh Images

```bash
# Build with no cache (takes ~5 minutes)
docker-compose build --no-cache
```

---

## Step 5: Start Services

```bash
# Start all services
docker-compose up -d

# Wait for services to be ready
sleep 10
docker-compose ps
```

---

## Step 6: Initialize Database

```bash
# Create database
docker-compose exec postgres psql -U findemo -d postgres << 'SQL'
CREATE DATABASE findemo;
SQL

# Enable UUID extension
docker-compose exec postgres psql -U findemo -d findemo << 'SQL'
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
SQL

# Apply schema
docker cp backend/db/schema_v2.sql findemo-postgres-1:/tmp/
docker-compose exec postgres psql -U findemo -d findemo -f /tmp/schema_v2.sql

# Apply seed data
docker cp backend/db/seed_v2.sql findemo-postgres-1:/tmp/
docker-compose exec postgres psql -U findemo -d findemo -f /tmp/seed_v2.sql
```

**Note:** Container name might be `findemo_postgres` instead of `findemo-postgres-1`. Check with `docker-compose ps`.

---

## Step 7: Restart Backend

```bash
# Restart backend to ensure fresh DB connection
docker-compose restart backend

# Wait for restart
sleep 5
```

---

## Step 8: Verify Setup

```bash
# Check services
docker-compose ps

# Check users in database
docker-compose exec postgres psql -U findemo -d findemo << 'SQL'
SELECT u.username, c.name as company, c.is_demo, COUNT(p.id) as purchases
FROM users u
JOIN customers c ON u.customer_id = c.id
LEFT JOIN purchases p ON p.customer_id = c.id
GROUP BY u.username, c.name, c.is_demo
ORDER BY u.username;
SQL

# Test backend health
curl http://localhost:8000/docs

# Test login
curl -X POST http://localhost:8000/login \
  -H "Content-Type: application/json" \
  -d '{"username": "demo", "password": "demo123"}'
```

---

## Expected Output

Login should return:
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer"
}
```

If you see "Internal Server Error", check backend logs:
```bash
docker-compose logs backend --tail=50
```

---

## Troubleshooting

### Backend still shows "column does not exist"

This indicates SQLAlchemy metadata cache issue. Try:

```bash
# Stop backend
docker-compose stop backend

# Remove backend container completely
docker-compose rm -f backend

# Rebuild just backend
docker-compose build --no-cache backend

# Start backend
docker-compose up -d backend

# Wait and test
sleep 10
curl -X POST http://localhost:8000/login \
  -H "Content-Type: application/json" \
  -d '{"username": "demo", "password": "demo123"}'
```

### Database column actually doesn't exist

Verify schema:
```bash
docker-compose exec postgres psql -U findemo -d findemo -c "\d users"
```

Should show `customer_id` column.

If not, drop and recreate:
```bash
docker-compose exec postgres psql -U findemo -d findemo << 'SQL'
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO findemo;
SQL

# Then reapply schema and seed (Step 6 above)
```

---

## Quick Script Option

Run the automated script:
```bash
./CLEAN_REBUILD.sh
```

This executes all steps automatically.
