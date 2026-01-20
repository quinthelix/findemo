# Phase 2: Smart VaR Calculation Logic

## Decision Tree for Each Exposure Bucket

```
For each bucket at time T:
  │
  ├─ Get source purchase
  │
  ├─ Check price_type
  │  │
  │  ├─ IF price_type == 'fixed':
  │  │   ├─ VaR = 0 (no risk)
  │  │   └─ expected_cost = purchase_price × quantity
  │  │
  │  └─ IF price_type == 'floating':
  │      │
  │      ├─ Check payment_date
  │      │  │
  │      │  ├─ IF payment_date EXISTS AND payment_date < today:
  │      │  │   ├─ Price is now locked
  │      │  │   ├─ VaR = 0
  │      │  │   └─ expected_cost = purchase_price × quantity
  │      │  │
  │      │  └─ ELSE (payment in future or not set):
  │      │      ├─ Still has price risk!
  │      │      ├─ Calculate time to payment/delivery
  │      │      ├─ VaR = Z_α × σ × current_price × |quantity| × √T
  │      │      └─ expected_cost = current_price × quantity
  │
  └─ Return: (expected_cost, var_amount)
```

## Response Schema Changes

### Current (returns only VaR):
```json
{
  "var": {
    "sugar": 42000,
    "flour": 31000,
    "portfolio": 61000
  }
}
```

### New (returns cost + var):
```json
{
  "expected_cost": {
    "sugar": 450000,
    "flour": 380000,
    "portfolio": 830000
  },
  "var": {
    "sugar": 42000,
    "flour": 5000,
    "portfolio": 47000
  }
}
```

## Implementation Steps

1. Update `var_engine.py` to check `price_type` and `payment_date`
2. Calculate VaR only for at-risk positions
3. Add `expected_cost` calculation
4. Update response schema
5. Update frontend to display dual Y-axis chart

## Files to Modify

- [ ] backend/app/services/var_engine.py
- [ ] backend/app/models/schemas.py
- [ ] backend/app/routers/var.py (response handling)
- [ ] frontend/src/types/api.ts
- [ ] frontend/src/components/VaRTimelineChart.tsx (dual Y-axis)
