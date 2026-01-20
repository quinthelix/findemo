# Running Tests Inside Docker Container

All tests run inside the Docker container using pytest. No need for curl or local tools!

## ✅ **Complete Test Suite Results**

```
23 tests total
✓ 17 API integration tests
✓ 6 Database validation tests
```

---

## 🚀 **Quick Start**

### Prerequisites

1. **Schema must be created** (one-time setup):
```bash
cat backend/db/schema_v2.sql | docker-compose exec -T postgres psql -U findemo -d findemo_db
```

2. **Data must be seeded**:
```bash
cat backend/db/seed_v2.sql | docker-compose exec -T postgres psql -U findemo -d findemo_db
```

Or use the API endpoint:
```bash
TOKEN=$(curl -s -X POST http://localhost:8000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo123"}' | \
  python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")

curl -X POST http://localhost:8000/data/seed -H "Authorization: Bearer $TOKEN"
```

---

## 📊 **Run All Tests**

### Option 1: Complete Test Suite

```bash
docker-compose exec backend pytest tests/ -v
```

**Expected output:**
```
============================== 23 passed in 2.14s ===============================
```

---

### Option 2: Individual Test Suites

**Database Tests Only:**
```bash
docker-compose exec backend pytest tests/test_database.py -v
```

Tests:
- ✓ Database connection
- ✓ Table existence (10 tables)
- ✓ Seed data (users, commodities, purchases, inventory, market prices)
- ✓ Foreign key constraints
- ✓ Index existence
- ✓ Data constraints (positive quantities, valid date ranges)

**API Tests Only:**
```bash
docker-compose exec backend pytest tests/test_api.py -v
```

Tests:
- ✓ Health check
- ✓ Root endpoint
- ✓ Authentication (login, invalid credentials, missing user)
- ✓ Data management (status, reset, seed flow)
- ✓ Market data (futures prices)
- ✓ Upload endpoints (purchases, inventory)
- ✓ Hedge session (create, get, add items)
- ✓ VaR calculation
- ✓ Protected endpoints

---

## 📋 **Test Details**

### Database Tests (6 tests)

```python
tests/test_database.py::test_connection ✓
tests/test_database.py::test_tables_exist ✓
tests/test_database.py::test_seed_data ✓
tests/test_database.py::test_foreign_keys ✓
tests/test_database.py::test_indexes ✓
tests/test_database.py::test_constraints ✓
```

### API Tests (17 tests)

**Health & Auth (5 tests):**
```python
tests/test_api.py::TestHealthAndAuth::test_health_check ✓
tests/test_api.py::TestHealthAndAuth::test_root_endpoint ✓
tests/test_api.py::TestHealthAndAuth::test_login_success ✓
tests/test_api.py::TestHealthAndAuth::test_login_invalid_credentials ✓
tests/test_api.py::TestHealthAndAuth::test_login_missing_user ✓
```

**Data Management (2 tests):**
```python
tests/test_api.py::TestDataManagement::test_data_status ✓
tests/test_api.py::TestDataManagement::test_reset_and_seed_flow ✓
```

**Market Data (1 test):**
```python
tests/test_api.py::TestMarketData::test_get_futures_prices ✓
```

**Upload (2 tests):**
```python
tests/test_api.py::TestUpload::test_upload_purchases_requires_file ✓
tests/test_api.py::TestUpload::test_upload_inventory_requires_file ✓
```

**Hedge Session (3 tests):**
```python
tests/test_api.py::TestHedgeSession::test_create_hedge_session ✓
tests/test_api.py::TestHedgeSession::test_get_current_hedge_session ✓
tests/test_api.py::TestHedgeSession::test_add_hedge_item ✓
```

**VaR (1 test):**
```python
tests/test_api.py::TestVaR::test_var_timeline ✓
```

**Authentication (2 tests):**
```python
tests/test_api.py::TestAuthentication::test_protected_endpoint_without_auth ✓
tests/test_api.py::TestAuthentication::test_protected_endpoint_with_invalid_token ✓
```

**Summary (1 test):**
```python
tests/test_api.py::test_summary ✓
```

---

## 🔍 **Advanced Options**

### With Coverage Report

```bash
docker-compose exec backend pytest tests/ -v --cov=app --cov-report=term-missing
```

### Specific Test

```bash
docker-compose exec backend pytest tests/test_api.py::TestHealthAndAuth::test_login_success -v
```

### Stop on First Failure

```bash
docker-compose exec backend pytest tests/ -x
```

### Show All Output

```bash
docker-compose exec backend pytest tests/ -v -s
```

### Parallel Execution

```bash
# Install pytest-xdist first
docker-compose exec backend uv pip install --system pytest-xdist

# Run tests in parallel
docker-compose exec backend pytest tests/ -n auto
```

---

## 🛠️ **Troubleshooting**

### Tests Fail with "connection refused"

**Problem:** Backend not running

**Solution:**
```bash
docker-compose ps
docker-compose up -d backend
sleep 3
# Run tests again
```

### Tests Fail with "relation does not exist"

**Problem:** Schema not created

**Solution:**
```bash
cat backend/db/schema_v2.sql | docker-compose exec -T postgres psql -U findemo -d findemo_db
```

### Tests Fail with "Incorrect username or password"

**Problem:** Data not seeded

**Solution:**
```bash
cat backend/db/seed_v2.sql | docker-compose exec -T postgres psql -U findemo -d findemo_db
```

### Import Errors

**Problem:** Test dependencies not installed

**Solution:**
```bash
docker-compose exec backend uv pip install --system pytest pytest-asyncio httpx psycopg2-binary
```

---

## 📝 **Test Files Location**

```
backend/
├── tests/
│   ├── conftest.py          # Pytest configuration & fixtures
│   ├── test_database.py     # Database validation tests
│   └── test_api.py          # API integration tests
└── run_tests.sh             # Test runner script (optional)
```

---

## ✅ **Complete Setup from Scratch**

```bash
# 1. Clean everything
docker-compose down -v --remove-orphans --rmi all

# 2. Build
docker-compose up -d

# 3. Create schema
cat backend/db/schema_v2.sql | docker-compose exec -T postgres psql -U findemo -d findemo_db

# 4. Seed data
cat backend/db/seed_v2.sql | docker-compose exec -T postgres psql -U findemo -d findemo_db

# 5. Install test dependencies (if not in image)
docker-compose exec backend uv pip install --system pytest pytest-asyncio httpx psycopg2-binary

# 6. Run all tests
docker-compose exec backend pytest tests/ -v

# Expected: 23 passed in ~2s ✓
```

---

## 🎯 **Summary**

| Command | Purpose |
|---------|---------|
| `docker-compose exec backend pytest tests/ -v` | Run all tests |
| `docker-compose exec backend pytest tests/test_database.py -v` | Database tests only |
| `docker-compose exec backend pytest tests/test_api.py -v` | API tests only |
| `docker-compose exec backend pytest tests/ -v --cov=app` | With coverage |
| `docker-compose exec backend pytest tests/ -x` | Stop on first fail |

**All tests run inside Docker - no local dependencies needed!** 🚀
