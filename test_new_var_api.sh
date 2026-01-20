#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Testing New VaR API with Cost + Risk"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Configuration
API_URL="http://localhost:8000"
USERNAME="avi"
PASSWORD="avi123"

echo "Step 1: Login as $USERNAME"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")

echo "Login response:"
echo "$LOGIN_RESPONSE" | python3 -m json.tool
echo ""

TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then
    echo "❌ Failed to get access token"
    exit 1
fi

echo "✅ Got access token: ${TOKEN:0:20}..."
echo ""

echo "Step 2: Get VaR Timeline (without hedge)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

VAR_RESPONSE=$(curl -s -X GET "$API_URL/var/timeline?confidence_level=0.95" \
  -H "Authorization: Bearer $TOKEN")

echo "VaR Timeline response (first 2 points):"
echo "$VAR_RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(json.dumps({
    'confidence_level': data.get('confidence_level'),
    'currency': data.get('currency'),
    'timeline_sample': data.get('timeline', [])[:2]
}, indent=2))
"
echo ""

echo "Step 3: Validate Response Structure"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "$VAR_RESPONSE" | python3 << 'EOF'
import sys, json

try:
    data = json.load(sys.stdin)
    timeline = data.get('timeline', [])
    
    if not timeline:
        print("❌ Timeline is empty")
        sys.exit(1)
    
    first_point = timeline[0]
    
    # Check required fields
    required_fields = ['date', 'scenario', 'expected_cost', 'var']
    missing_fields = [f for f in required_fields if f not in first_point]
    
    if missing_fields:
        print(f"❌ Missing fields: {missing_fields}")
        sys.exit(1)
    
    # Check expected_cost structure
    cost = first_point.get('expected_cost', {})
    if not all(k in cost for k in ['sugar', 'flour', 'portfolio']):
        print("❌ expected_cost missing commodities")
        sys.exit(1)
    
    # Check var structure
    var = first_point.get('var', {})
    if not all(k in var for k in ['sugar', 'flour', 'portfolio']):
        print("❌ var missing commodities")
        sys.exit(1)
    
    print("✅ Response structure is valid!")
    print(f"\n📊 Sample Data Point:")
    print(f"   Date: {first_point['date']}")
    print(f"   Scenario: {first_point['scenario']}")
    print(f"\n   Expected Cost:")
    print(f"     Sugar: ${cost['sugar']:,.2f}")
    print(f"     Flour: ${cost['flour']:,.2f}")
    print(f"     Portfolio: ${cost['portfolio']:,.2f}")
    print(f"\n   VaR (95% confidence):")
    print(f"     Sugar: ${var['sugar']:,.2f}")
    print(f"     Flour: ${var['flour']:,.2f}")
    print(f"     Portfolio: ${var['portfolio']:,.2f}")
    
    # Calculate risk percentage
    if cost['portfolio'] > 0:
        risk_pct = (var['portfolio'] / cost['portfolio']) * 100
        print(f"\n   Risk %: {risk_pct:.1f}%")
    
except json.JSONDecodeError as e:
    print(f"❌ JSON decode error: {e}")
    sys.exit(1)
except Exception as e:
    print(f"❌ Validation error: {e}")
    sys.exit(1)
EOF

VALIDATION_RESULT=$?

echo ""

if [ $VALIDATION_RESULT -eq 0 ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ ALL TESTS PASSED!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Backend is ready for frontend integration."
    echo "Response now includes both 'expected_cost' and 'var'."
else
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "❌ TESTS FAILED!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi
