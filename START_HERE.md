# Clean Rebuild - Start Here

## 🔴 Root Cause Found

Python cache files (`__pycache__/*.pyc`) contained the **OLD User model without `customer_id`**.

Docker's `COPY . .` was including these cache files, causing SQLAlchemy to use the old schema even though the source code was updated.

---

## ✅ Quick Fix (Recommended)

```bash
./CLEAN_REBUILD.sh
```

This script will:
1. Clean Python cache files (THE KEY FIX)
2. Rebuild Docker images
3. Initialize database
4. Test login

Takes ~5-10 minutes.

---

## 📋 Manual Commands (Alternative)

If you prefer step-by-step control, see: `MANUAL_REBUILD_COMMANDS.md`

---

## 🚀 Super Quick Start (Copy/Paste)

```bash
# Clean cache FIRST (this is the fix!)
find backend -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find backend -type f -name "*.pyc" -delete 2>/dev/null || true

# Remove containers/volumes
docker-compose down -v

# Remove images (you can do this manually too)
docker rmi findemo-backend findemo-frontend findemo_backend findemo_frontend 2>/dev/null || true

# Rebuild and start
docker-compose build --no-cache
docker-compose up -d
sleep 10

# Initialize database
docker-compose exec postgres psql -U findemo -d postgres -c "CREATE DATABASE findemo;"
docker-compose exec postgres psql -U findemo -d findemo -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
docker cp backend/db/schema_v2.sql $(docker-compose ps -q postgres | head -1):/tmp/
docker-compose exec postgres psql -U findemo -d findemo -f /tmp/schema_v2.sql
docker cp backend/db/seed_v2.sql $(docker-compose ps -q postgres | head -1):/tmp/
docker-compose exec postgres psql -U findemo -d findemo -f /tmp/seed_v2.sql

# Restart backend for fresh DB connection
docker-compose restart backend
sleep 5

# Test
curl -X POST http://localhost:8000/login \
  -H "Content-Type: application/json" \
  -d '{"username": "demo", "password": "demo123"}'
```

Expected output: `{"access_token": "eyJ...", "token_type": "bearer"}`

---

## ✅ Prevention

The `backend/.dockerignore` has been updated to prevent this in the future. Cache files will no longer be copied into Docker images.

---

## 🔧 If Still Failing

1. Check container name:
   ```bash
   docker-compose ps
   ```
   Use actual name in `docker cp` commands (might be `findemo_postgres` instead of `findemo-postgres-1`)

2. Check backend logs:
   ```bash
   docker-compose logs backend --tail=50
   ```

3. Verify database schema:
   ```bash
   docker-compose exec postgres psql -U findemo -d findemo -c "\d users"
   ```
   Should show `customer_id` column.

---

## 📞 Resources

- **CLEAN_REBUILD.sh** - Automated script
- **MANUAL_REBUILD_COMMANDS.md** - Step-by-step guide with troubleshooting
- **backend/.dockerignore** - Updated to prevent cache issues

---

## 🎯 After Successful Rebuild

Login credentials:
- **demo / demo123** (demo company with seed data)

Services:
- Backend API: http://localhost:8000
- Frontend: http://localhost:5173  
- API Docs: http://localhost:8000/docs

Next step: Test Excel upload with `demo` user!
