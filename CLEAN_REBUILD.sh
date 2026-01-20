#!/bin/bash
# Complete clean rebuild script for Findemo

set -e  # Exit on error

echo "=========================================="
echo "FINDEMO CLEAN REBUILD"
echo "=========================================="
echo ""

# Step 1: Stop and remove all containers, networks, volumes
echo "Step 1: Stopping and removing all Docker resources..."
docker-compose down -v 2>/dev/null || true
echo "✓ Docker compose down complete"
echo ""

# Step 2: Remove Docker images
echo "Step 2: Removing Findemo Docker images..."
docker rmi findemo-backend findemo-frontend findemo_backend findemo_frontend 2>/dev/null || true
echo "✓ Images removed"
echo ""

# Step 3: Clean Python cache and generated files
echo "Step 3: Cleaning Python cache and generated files..."
find backend -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find backend -type f -name "*.pyc" -delete 2>/dev/null || true
find backend -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
find backend -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
echo "✓ Python cache cleaned"
echo ""

# Step 4: Clean frontend cache
echo "Step 4: Cleaning frontend cache..."
rm -rf frontend/node_modules/.cache 2>/dev/null || true
rm -rf frontend/dist 2>/dev/null || true
echo "✓ Frontend cache cleaned"
echo ""

# Step 5: Verify git status
echo "Step 5: Checking git status for unexpected files..."
git status --porcelain | grep -v "^??" || echo "✓ No modified tracked files"
echo ""

# Step 6: Build fresh images (no cache)
echo "Step 6: Building fresh Docker images (this will take a few minutes)..."
docker-compose build --no-cache
echo "✓ Images built"
echo ""

# Step 7: Start services
echo "Step 7: Starting services..."
docker-compose up -d
echo "✓ Services started"
echo ""

# Step 8: Wait for PostgreSQL to be ready
echo "Step 8: Waiting for PostgreSQL to be ready..."
sleep 10
docker-compose exec -T postgres pg_isready -U findemo > /dev/null 2>&1
echo "✓ PostgreSQL ready"
echo ""

# Step 9: Initialize database
echo "Step 9: Initializing database..."

# Create database
docker-compose exec -T postgres psql -U findemo -d postgres << 'SQL'
SELECT 'CREATE DATABASE findemo'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'findemo')\gexec
SQL

# Enable UUID extension
docker-compose exec -T postgres psql -U findemo -d findemo << 'SQL'
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
SQL

# Apply schema
docker cp backend/db/schema_v2.sql findemo-postgres-1:/tmp/ || docker cp backend/db/schema_v2.sql findemo_postgres:/tmp/
docker-compose exec -T postgres psql -U findemo -d findemo -f /tmp/schema_v2.sql > /dev/null
echo "✓ Schema applied"

# Apply seed data
docker cp backend/db/seed_v2.sql findemo-postgres-1:/tmp/ || docker cp backend/db/seed_v2.sql findemo_postgres:/tmp/
docker-compose exec -T postgres psql -U findemo -d findemo -f /tmp/seed_v2.sql > /dev/null
echo "✓ Seed data loaded"
echo ""

# Step 10: Restart backend to ensure fresh connection
echo "Step 10: Restarting backend..."
docker-compose restart backend
sleep 5
echo "✓ Backend restarted"
echo ""

# Step 11: Verify setup
echo "Step 11: Verifying setup..."
echo ""
echo "Services status:"
docker-compose ps
echo ""

echo "Database users:"
docker-compose exec -T postgres psql -U findemo -d findemo << 'SQL'
SELECT u.username, c.name as company, c.is_demo 
FROM users u 
JOIN customers c ON u.customer_id = c.id 
ORDER BY u.username;
SQL
echo ""

echo "=========================================="
echo "REBUILD COMPLETE!"
echo "=========================================="
echo ""
echo "Available users:"
echo "  - demo / demo123 (demo company)"
echo ""
echo "Services:"
echo "  - Backend:  http://localhost:8000"
echo "  - Frontend: http://localhost:5173"
echo "  - Docs:     http://localhost:8000/docs"
echo ""
echo "Test login with:"
echo "  curl -X POST http://localhost:8000/login \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"username\": \"demo\", \"password\": \"demo123\"}'"
echo ""
