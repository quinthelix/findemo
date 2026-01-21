# FinOs Demo - Commodity Hedging & VaR Platform

## Overview

A multi-tenant web application for commodity price risk management. Allows customers to:
- Upload purchase and inventory data
- Visualize forward price projections with futures overlay
- Build hedging transactions
- Execute and track hedges
- Monitor portfolio risk (VaR)

**Tech Stack**: React + TypeScript, Python + FastAPI, PostgreSQL, Docker

---

## Quick Start

### Prerequisites

- **Docker Desktop** (or Docker Engine + Docker Compose)
- **Git**
- Ports available: 3000, 5432, 8000

### 1. Clone Repository

```bash
git clone <repository-url>
cd findemo
```

### 2. Start All Services

```bash
docker-compose up -d
```

This will:
- Start PostgreSQL container (port 5432)
- Create database schema
- Seed demo data
- Start FastAPI backend (port 8000)
- Start React frontend (port 3000)

### 3. Wait for Services

Monitor startup:
```bash
docker-compose logs -f
```

Wait for:
- `findemo_postgres | database system is ready to accept connections`
- `findemo_backend | Uvicorn running on http://0.0.0.0:8000`
- `findemo_frontend | VITE ... ready in ... ms`

### 4. Access Application

**Frontend**: http://localhost:3000

**Backend API**: http://localhost:8000

**API Docs**: http://localhost:8000/docs

**Demo Login**:
- Username: `demo`
- Password: `demo123`

---

## Architecture

```
findemo/
├── backend/              # Python FastAPI application
│   ├── app/
│   │   ├── main.py      # FastAPI app entry point
│   │   ├── routers/     # API endpoints
│   │   ├── models/      # SQLAlchemy models + Pydantic schemas
│   │   ├── services/    # Business logic (VaR, exposure, futures)
│   │   └── dependencies.py  # JWT auth dependency
│   ├── db/              # Database scripts
│   │   ├── schema_v2.sql       # PostgreSQL schema
│   │   ├── seed_minimal.sql   # Demo customer + users
│   │   └── seed_demo.sql      # Sample purchase data
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/             # React + TypeScript application
│   ├── src/
│   │   ├── screens/     # Page components
│   │   ├── components/  # Reusable UI components
│   │   ├── api/         # Backend API client
│   │   ├── types/       # TypeScript type definitions
│   │   └── App.tsx      # Main app with routing
│   ├── Dockerfile
│   └── package.json
├── data/                 # Sample Excel files
│   ├── demo_purchases_v2.xlsx
│   └── demo_inventory_v2.xlsx
├── docker-compose.yml
├── AGENTS.md            # System design documentation
├── README.md            # This file
└── TESTING.md           # Testing guide
```

---

## Development Workflow

### View Logs

**All services**:
```bash
docker-compose logs -f
```

**Specific service**:
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

**Last N lines**:
```bash
docker-compose logs --tail 50 backend
```

### Restart Services

**All**:
```bash
docker-compose restart
```

**Specific**:
```bash
docker-compose restart backend
docker-compose restart frontend
```

### Access Database

**psql shell**:
```bash
docker-compose exec postgres psql -U findemo -d findemo
```

**Run SQL file**:
```bash
docker-compose exec postgres psql -U findemo -d findemo -f /path/to/file.sql
```

**Run SQL command**:
```bash
docker-compose exec postgres psql -U findemo -d findemo -c "SELECT COUNT(*) FROM purchases;"
```

### Backend Development

**Install dependencies locally** (for IDE autocomplete):
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

**Code changes**: Hot reload enabled via `--reload` flag in docker-compose

**Add Python package**:
```bash
cd backend
pip install <package>
pip freeze > requirements.txt
docker-compose restart backend
```

### Frontend Development

**Install dependencies locally**:
```bash
cd frontend
npm install
```

**Code changes**: Hot reload enabled via Vite

**Add npm package**:
```bash
cd frontend
npm install <package>
docker-compose restart frontend
```

---

## Database Management

### Schema Initialization

**Automatic on First Startup**

Schema and seed data are automatically loaded when the postgres container starts **with an empty data volume**. This is done via volume mounts in `docker-compose.yml`:

```yaml
volumes:
  - postgres_data:/var/lib/postgresql/data
  - ./backend/db/schema_v2.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro
  - ./backend/db/seed_minimal.sql:/docker-entrypoint-initdb.d/02-seed.sql:ro
```

PostgreSQL automatically runs files in `/docker-entrypoint-initdb.d/` **only when initializing a new database** (i.e., when the data directory is empty).

### Manual Schema Reset (Complete Clean Slate)

**Warning**: This deletes all data.

```bash
# Stop containers and remove volumes
docker-compose down -v

# Start fresh (auto-initializes from mounted SQL files)
docker-compose up -d

# Wait for initialization to complete
sleep 10

# Verify database is ready
docker-compose exec postgres psql -U findemo -d findemo -c "\dt"
```

**How it works**: 
- `docker-compose down -v` removes the `postgres_data` volume
- When postgres starts with an empty volume, it runs `/docker-entrypoint-initdb.d/*.sql` files automatically
- Schema and seed data are loaded from the mounted SQL files

### Check Database State

**Table list**:
```bash
docker-compose exec postgres psql -U findemo -d findemo -c "\dt"
```

**Row counts**:
```bash
docker-compose exec postgres psql -U findemo -d findemo -c "
SELECT 
  'customers' as table, COUNT(*) FROM customers UNION ALL
  SELECT 'users', COUNT(*) FROM users UNION ALL
  SELECT 'purchases', COUNT(*) FROM purchases UNION ALL
  SELECT 'market_prices', COUNT(*) FROM market_prices;
"
```

**Active hedge sessions**:
```bash
docker-compose exec postgres psql -U findemo -d findemo -c "
SELECT hs.id, u.username, hs.status, COUNT(hsi.id) as items
FROM hedge_sessions hs
JOIN users u ON hs.user_id = u.id
LEFT JOIN hedge_session_items hsi ON hs.id = hsi.hedge_session_id
GROUP BY hs.id, u.username, hs.status;
"
```

### Data Reset via API

**Reset all data for current customer**:
```bash
curl -X POST "http://localhost:8000/data/reset?data_type=all" \
  -H "Authorization: Bearer <jwt_token>"
```

**Reset only purchases**:
```bash
curl -X POST "http://localhost:8000/data/reset?data_type=purchases" \
  -H "Authorization: Bearer <jwt_token>"
```

**Re-seed demo data**:
```bash
curl -X POST "http://localhost:8000/data/seed" \
  -H "Authorization: Bearer <jwt_token>"
```

**Get data status**:
```bash
curl "http://localhost:8000/data/status" \
  -H "Authorization: Bearer <jwt_token>"
```

---

## Seeding Data

### Via Web UI

1. Login at http://localhost:3000
2. Navigate to "Upload Data" page
3. Upload `data/demo_purchases_v2.xlsx`
4. Upload `data/demo_inventory_v2.xlsx`
5. Click "Refresh Market Data" (optional, auto-triggered)
6. Navigate to "Analysis" page

### Via SQL Script

```bash
docker-compose exec postgres psql -U findemo -d findemo -f /app/db/seed_demo.sql
```

### Via API

```bash
# Get JWT token
TOKEN=$(curl -X POST "http://localhost:8000/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo123"}' \
  | jq -r '.access_token')

# Seed demo data
curl -X POST "http://localhost:8000/data/seed" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Testing

See **TESTING.md** for comprehensive testing guide.

### Quick Smoke Test

```bash
# 1. Check all services running
docker-compose ps

# 2. Check backend health
curl http://localhost:8000/

# 3. Check login
curl -X POST "http://localhost:8000/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo123"}'

# 4. Check frontend loads
curl http://localhost:3000
```

### Backend Unit Tests

**Run pytest**:
```bash
docker-compose exec backend pytest
```

**With coverage**:
```bash
docker-compose exec backend pytest --cov=app --cov-report=term-missing
```

### Frontend Tests

**Run Jest/Vitest**:
```bash
docker-compose exec frontend npm test
```

**E2E tests** (if configured):
```bash
docker-compose exec frontend npm run test:e2e
```

---

## Troubleshooting

### Port Already in Use

**Error**: `Bind for 0.0.0.0:5432 failed: port is already allocated`

**Solution**:
```bash
# Find process using port
lsof -i :5432  # macOS/Linux
netstat -ano | findstr :5432  # Windows

# Kill process or change port in docker-compose.yml
# Example: "5433:5432" maps host port 5433 to container port 5432
```

### Frontend Can't Reach Backend

**Symptoms**: CORS errors, 404s, network failures

**Check**:
1. Backend is running: `docker-compose logs backend`
2. Backend responds: `curl http://localhost:8000/`
3. `VITE_API_BASE_URL` env var correct in docker-compose.yml

**Fix**:
```bash
docker-compose restart frontend
```

### Database Connection Failed

**Symptoms**: `sqlalchemy.exc.OperationalError: could not connect to server`

**Check**:
1. Postgres is running: `docker-compose ps postgres`
2. Health check passing: `docker-compose exec postgres pg_isready -U findemo`

**Fix**:
```bash
docker-compose restart postgres
# Wait 10 seconds
docker-compose restart backend
```

### Empty Analysis Page After Upload

**Symptoms**: Data uploaded, but analysis page shows no commodities/futures

**Check**:
1. Data actually inserted:
   ```bash
   docker-compose exec postgres psql -U findemo -d findemo -c "SELECT COUNT(*) FROM purchases;"
   ```
2. Futures generated:
   ```bash
   docker-compose exec postgres psql -U findemo -d findemo -c "SELECT COUNT(*) FROM market_prices WHERE source LIKE 'mock_futures%';"
   ```
3. Backend logs for errors:
   ```bash
   docker-compose logs --tail 100 backend | grep -i error
   ```

**Fix**:
```bash
# Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
# Or clear browser localStorage and re-login
```

### Hot Reload Not Working

**Backend**:
- Ensure `--reload` flag in docker-compose command
- Check file is mounted: `volumes: - ./backend:/app`
- May need manual restart for some changes

**Frontend**:
- Vite should auto-reload
- Check browser console for errors
- Try hard refresh (Cmd+Shift+R)

---

## Environment Variables

### Backend

Set in `docker-compose.yml` or create `.env` file:

```bash
DATABASE_URL=postgresql://findemo:findemo_dev_pass@postgres:5432/findemo
JWT_SECRET=dev_secret_key_change_in_production_12345
JWT_ALGORITHM=HS256
JWT_EXPIRATION_MINUTES=60
```

### Frontend

Set in `docker-compose.yml` or create `frontend/.env`:

```bash
VITE_API_BASE_URL=http://localhost:8000
```

---

## Production Deployment

**NOT CONFIGURED** - This is a local development setup only.

**Future considerations**:
- Use production WSGI server (Gunicorn + Uvicorn workers)
- Build frontend for production (`npm run build`)
- Use environment-specific secrets
- Add SSL/TLS termination
- Configure CORS properly
- Add rate limiting
- Set up monitoring/logging
- Database backups
- Multi-replica deployment

---

## Clean Teardown

**Stop containers** (preserves data):
```bash
docker-compose down
```

**Stop and remove volumes** (deletes all data):
```bash
docker-compose down -v
```

**Remove images**:
```bash
docker-compose down --rmi all
```

**Full cleanup**:
```bash
docker-compose down -v --rmi all
docker system prune -a
```

---

## Project Contacts

- **System Design**: See `AGENTS.md`
- **Testing Guide**: See `TESTING.md`
- **API Documentation**: http://localhost:8000/docs (when running)

---

## License

[License information here]

---

## Contributing

[Contribution guidelines here]
