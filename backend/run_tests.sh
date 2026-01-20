#!/bin/bash
# Comprehensive test runner script
# Runs all tests inside the Docker container

set -e

echo "=========================================="
echo "Findemo Backend Test Suite"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0

echo "Environment: Docker Container"
echo "Database: postgres:5432"
echo "API: backend:8000"
echo ""

# Run database tests
echo "=========================================="
echo "1. Database Validation Tests"
echo "=========================================="
if pytest tests/test_database.py -v --tb=short; then
    echo -e "${GREEN}✓ Database tests passed${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ Database tests failed${NC}"
    ((FAILED++))
fi
echo ""

# Wait a moment for API to be ready
sleep 2

# Run API tests
echo "=========================================="
echo "2. API Integration Tests"
echo "=========================================="
if pytest tests/test_api.py -v --tb=short; then
    echo -e "${GREEN}✓ API tests passed${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ API tests failed${NC}"
    ((FAILED++))
fi
echo ""

# Summary
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo "Passed: $PASSED test suites"
echo "Failed: $FAILED test suites"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo "=========================================="
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo "=========================================="
    exit 1
fi
