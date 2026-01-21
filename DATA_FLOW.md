# Data Flow & Futures Generation

## Overview
This document explains how the system processes customer data and generates futures contracts.

---

## 🔄 Complete Data Flow

### 1. **Login** (Smart futures regeneration)
```
User Login → Authentication → Check data status → Regenerate stale futures → Route
```
- ✅ If purchases exist:
  - Check futures freshness (created today?)
  - If stale (from previous day) → Regenerate
  - If fresh (same day) → Skip regeneration
  - Route to Value at Risk page
- ✅ If no purchases:
  - No futures generated (no data yet)
  - Route to Data Upload page

### 2. **Data Upload** (Force regenerates futures)
```
Upload Purchases Excel → Parse & Validate → Store in DB → Force Generate Futures
```

#### Upload Purchases Endpoint: `/upload/purchases`
1. Parse Excel file
2. Validate schema (commodity, dates, prices, quantities)
3. Insert purchases into database (customer-scoped)
4. Rebuild exposure buckets
5. **Force regenerate futures** (always, even if fresh)
   - New purchase data may change base prices
   - Futures recalculated from TODAY with new averages

#### Futures Generation Logic:
```python
# Get commodities from customer's purchases only
commodities_purchased = query(
    SELECT commodity_id, AVG(purchase_price), COUNT(*)
    FROM purchases
    WHERE customer_id = current_customer
    GROUP BY commodity_id
)

# For each commodity with purchases:
for commodity in commodities_purchased:
    base_price = commodity.avg_purchase_price
    
    # Generate 5 futures: 1M, 3M, 6M, 9M, 12M
    for months_ahead in [1, 3, 6, 9, 12]:
        low_price = base_price * (1.0 - months_ahead * 0.02)  # -2%/month
        high_price = base_price * (1.0 + months_ahead * 0.02) # +2%/month
        
        create_mock_future(commodity, months_ahead, low_price, high_price)
```

---

## 📊 Why This Approach?

### ❌ What We DON'T Do:
- Hardcode commodity names (no "sugar", "flour" assumptions)
- Hardcode base prices ($20, $15, etc.)
- Generate futures on login (before data exists)
- Generate futures for ALL commodities in database

### ✅ What We DO:
- Generate futures **ONLY after data upload**
- Generate futures **ONLY for commodities customer has purchased**
- Base prices **from customer's actual purchase history**
- Calculate average from recent purchases (realistic pricing)

---

## 🎯 Benefits

1. **Flexible**: Works with ANY commodity (corn, wheat, rice, coffee, etc.)
2. **Realistic**: Prices reflect customer's actual procurement costs
3. **Customer-specific**: Each customer sees their own price ranges
4. **Scalable**: Supports multi-tenant architecture

---

## 📝 Example Scenario

### Customer: HedgyMunchy
**Purchases uploaded:**
- Sugar: 5 purchases, avg price $0.48/lb
- Flour: 4 purchases, avg price $0.37/lb

**Futures generated:**
```
Sugar futures (base: $0.48):
  1M: Low $0.47, High $0.49
  3M: Low $0.45, High $0.51
  6M: Low $0.42, High $0.54
  9M: Low $0.39, High $0.57
 12M: Low $0.36, High $0.60

Flour futures (base: $0.37):
  1M: Low $0.36, High $0.38
  3M: Low $0.35, High $0.39
  6M: Low $0.33, High $0.41
  9M: Low $0.31, High $0.44
 12M: Low $0.28, High $0.47
```

**Other customers:**
- Different commodities? ✅ Works
- Different price ranges? ✅ Adapts automatically
- More/fewer commodities? ✅ Scales naturally

---

## 🧪 Testing

### Test 1: Fresh User (No Data)
```bash
# Login
POST /login → username: avi, password: avi123

# Check futures (should be empty)
GET /futures/list → {"futures": []}

# Upload data
POST /upload/purchases → file: demo_purchases_v2.xlsx
Response: "Generated 10 mock futures"

# Check futures again
GET /futures/list → {"futures": [sugar 1M/3M/6M/9M/12M, flour 1M/3M/6M/9M/12M]}
```

### Test 2: Different Commodities
```bash
# Upload corn purchases (avg price $4.50/bushel)
POST /upload/purchases → file: corn_purchases.xlsx

# Futures generated for corn
GET /futures/list → {"futures": [corn 1M/3M/6M/9M/12M]}
# Base price: $4.50, NOT hardcoded $20 or $15
```

---

## ⏰ Futures Freshness & Regeneration

### Problem
Futures are **1M, 3M, 6M, 9M, 12M from TODAY**, so they must be regenerated daily.

### Solution: Smart Regeneration
1. **Freshness Check**: Verify futures were created today
2. **Auto-Regenerate**: Update on login if stale
3. **Skip if Fresh**: Don't regenerate unnecessarily

### Trigger Points
| Event | Regeneration | Reason |
|-------|--------------|--------|
| **Data Upload** | Force (always) | New base prices from purchases |
| **Login** | Smart (if stale) | Futures may be from previous day |
| **Manual** | Optional force | Admin/testing purposes |

See `FUTURES_REGENERATION.md` for detailed implementation.

---

## 🔐 Multi-Tenant Safety

Each customer's futures are:
- ✅ Generated from THEIR purchases only
- ✅ Isolated by `customer_id` in all queries
- ✅ Regenerated daily (smart check)
- ✅ Force regenerated on new uploads
- ✅ Never mixed with other customers' data

---

## 🚀 Production Considerations

When deploying to production:
1. Replace mock futures with real market data API
2. Keep the same structure (high/low price scenarios)
3. Maintain customer-specific pricing logic
4. Add caching for performance
5. Consider rate limiting for market data calls

The architecture is designed to swap mock → real with minimal changes.
