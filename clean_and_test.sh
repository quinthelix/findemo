#!/bin/bash
set -e

echo "=========================================="
echo "Clean and Test Script"
echo "=========================================="

echo ""
echo "[1/6] Cleaning Docker..."
docker-compose down -v --remove-orphans --rmi all 2>/dev/null || true

echo ""
echo "[2/6] Building containers (with uv - should be fast)..."
docker-compose build --no-cache

echo ""
echo "[3/6] Starting services..."
docker-compose up -d

echo ""
echo "[4/6] Waiting for PostgreSQL to be ready..."
sleep 5

echo ""
echo "[5/6] Initializing database..."
cat backend/db/schema_v2.sql | docker-compose exec -T postgres psql -U findemo -d findemo_db > /dev/null
echo "Schema applied"

cat backend/db/seed_v2.sql | docker-compose exec -T postgres psql -U findemo -d findemo_db > /dev/null
echo "Data seeded"

echo ""
echo "[6/6] Running tests..."
echo ""

echo "--- Container Status ---"
docker-compose ps

echo ""
echo "--- Health Check ---"
curl -s http://localhost:8000/health | python3 -m json.tool

echo ""
echo "--- Authentication Test ---"
TOKEN=$(curl -s -X POST http://localhost:8000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo123"}' | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")

if [ -z "$TOKEN" ]; then
  echo "ERROR: Failed to get auth token"
  exit 1
fi

echo "Token obtained successfully"

echo ""
echo "--- Data Status ---"
curl -s http://localhost:8000/data/status \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

echo ""
echo "--- Reset Test ---"
curl -s -X POST http://localhost:8000/data/reset \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

echo ""
echo "--- Re-Seed Test ---"
curl -s -X POST http://localhost:8000/data/seed \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

echo ""
echo "--- Final Data Status ---"
curl -s http://localhost:8000/data/status \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

echo ""
echo "=========================================="
echo "All tests passed!"
echo "=========================================="
echo ""
echo "Services running at:"
echo "  Backend API: http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
echo "  PostgreSQL: localhost:5432"
echo ""
echo "To run database tests:"
echo "  docker-compose exec backend pytest tests/test_database.py -v"
echo ""
echo "To view logs:"
echo "  docker-compose logs -f backend"
