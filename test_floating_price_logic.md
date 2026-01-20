# Testing Floating Price Logic

## Current State (All Fixed Prices)
```
VaR = 0 for all positions ✅
Reason: All purchases have price_type='fixed'
```

## To Test Floating Price Logic

### Option 1: Update Existing Purchase in Database
```sql
-- Make a future sugar purchase floating-price
UPDATE purchases 
SET 
  price_type = 'floating',
  payment_date = '2026-08-01'  -- Payment 3 months after delivery
WHERE 
  customer_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  AND commodity_id = (SELECT id FROM commodities WHERE name = 'sugar')
  AND delivery_start_date >= '2026-06-01'
LIMIT 1;
```

**Expected Result:**
- VaR > 0 for sugar until August 1, 2026
- VaR = 0 for sugar after August 1, 2026 (price locked)
- VaR timeline will decrease over time as payment date approaches

### Option 2: Upload New Excel with Floating Prices

Create `floating_orders.xlsx` with these columns:

| commodity | purchase_date | delivery_start_date | delivery_end_date | quantity | unit | purchase_price | price_type | payment_date |
|-----------|---------------|---------------------|-------------------|----------|------|----------------|------------|--------------|
| sugar     | 2026-01-20    | 2026-06-01          | 2026-06-30        | 5000     | lbs  | 0.55           | floating   | 2026-08-01   |
| flour     | 2026-01-20    | 2026-07-01          | 2026-07-31        | 3000     | lbs  | 0.42           | floating   |              |

**Expected Results:**

For sugar (payment_date = 2026-08-01):
- VaR > 0 until August 1, 2026
- VaR calculation uses time_horizon = days_until_payment / 365
- After August 1: VaR = 0 (price locked)

For flour (no payment_date):
- VaR > 0 until delivery_end_date (2026-07-31)
- VaR calculation uses time_horizon = days_until_delivery / 365
- After July 31: VaR = 0 (delivered)

## VaR Calculation Formula

For floating-price positions:
```
VaR = Z_α × σ × forward_price × |quantity| × √T

Where:
  Z_α = 1.645 (95% confidence)
  σ = annualized volatility (e.g., 0.15)
  forward_price = current market price
  quantity = net exposure
  T = time_horizon_years
```

### Example Calculation

Assumptions:
- quantity = 5000 lbs
- forward_price = $0.55/lb
- volatility = 15% (0.15)
- time_horizon = 6 months (0.5 years)
- confidence = 95% (Z = 1.645)

```
VaR = 1.645 × 0.15 × 0.55 × 5000 × √0.5
VaR = 1.645 × 0.15 × 0.55 × 5000 × 0.707
VaR ≈ $479

Expected Cost = 5000 × $0.55 = $2,750
Risk % = $479 / $2,750 = 17.4%
```

## Quick Test SQL Commands

### 1. Check current purchases
```sql
SELECT 
  c.name as commodity,
  p.delivery_start_date,
  p.price_type,
  p.payment_date,
  p.quantity,
  p.purchase_price
FROM purchases p
JOIN commodities c ON p.commodity_id = c.id
WHERE p.customer_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  AND p.delivery_start_date >= CURRENT_DATE
ORDER BY p.delivery_start_date
LIMIT 5;
```

### 2. Convert one to floating
```sql
-- Get the ID first
SELECT id, delivery_start_date, quantity 
FROM purchases 
WHERE customer_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  AND delivery_start_date >= '2026-06-01'
LIMIT 1;

-- Update it
UPDATE purchases 
SET 
  price_type = 'floating',
  payment_date = '2026-08-01'
WHERE id = '<purchase_id_from_above>';
```

### 3. Rebuild exposure buckets
```bash
curl -X POST "http://localhost:8000/data/seed" \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Test VaR endpoint again
```bash
curl -X GET "http://localhost:8000/var/timeline?confidence_level=0.95" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

Should now show VaR > 0 for the commodity with floating price!

## Verification Checklist

- [ ] VaR = 0 for fixed-price orders ✅ (confirmed)
- [ ] VaR > 0 for floating-price orders (payment in future)
- [ ] VaR = 0 for floating-price orders (payment in past)
- [ ] VaR decreases over time as payment date approaches
- [ ] expected_cost calculated for all orders
- [ ] Both with_hedge and without_hedge scenarios returned
