# Futures Regeneration Strategy

## Problem Statement

Mock futures are generated as **1M, 3M, 6M, 9M, 12M from TODAY**.

This means:
- Upload on **Jan 1** → Futures: Feb 1, Apr 1, Jul 1, Oct 1, Jan 1 (next year)
- Login on **Jan 15** → Futures are STALE (still based on Jan 1)
- Login on **Feb 1** → The 1M future is NOW TODAY (wrong!)

**Solution**: Regenerate futures whenever they become stale.

---

## Implementation

### 1. Enhanced Freshness Check
```python
async def check_futures_freshness(db: AsyncSession, customer_id: str = None) -> bool:
    """
    Check if existing futures were created today AND customer has purchase data
    Returns True if futures need regeneration or deletion
    """
    today = date.today()
    
    # Check if futures exist
    result = await db.execute(
        select(MarketPrice.price_date)
        .where(MarketPrice.source.in_(['mock_futures_high', 'mock_futures_low']))
        .limit(1)
    )
    price_date = result.scalar_one_or_none()
    
    if not price_date:
        return True  # No futures exist
    
    # CRITICAL: Check if customer has purchases
    if customer_id:
        purchase_count = await db.execute(
            select(func.count(Purchase.id))
            .where(Purchase.customer_id == customer_id)
        ).scalar_one()
        
        if purchase_count == 0:
            return True  # No purchases → futures should be cleared
    
    return price_date != today  # True if stale
```

**Key Addition**: The freshness check now verifies customer has purchase data. If purchases are cleared, futures are cleared too.

### 2. Smart Regeneration
```python
async def generate_mock_futures(
    db: AsyncSession, 
    customer_id: str = None, 
    force: bool = False
) -> Dict[str, int]:
    """
    Generate futures with smart regeneration
    
    Args:
        customer_id: Required for customer-specific pricing
        force: If False, skip if futures are fresh (default)
    """
    # Check if regeneration needed
    if not force:
        needs_regen = await check_futures_freshness(db)
        if not needs_regen:
            return {"futures_created": 0, "skipped": True}
    
    # Clear old futures and generate new ones
    # ... (generation logic)
```

---

## Trigger Points

### 1. **Data Upload** (Force Regeneration)
```python
# upload.py
await generate_mock_futures(db, customer_id=customer_id, force=True)
```
- **When**: After purchases uploaded
- **Why**: New purchase data → new base prices
- **Force**: YES (always regenerate)

### 2. **Login** (Smart Regeneration)
```python
# auth.py
await generate_mock_futures(db, customer_id=customer_id, force=False)
```
- **When**: User logs in with existing data
- **Why**: Futures might be stale (from previous day)
- **Force**: NO (skip if fresh)

### 3. **Manual Endpoint** (Optional Force)
```python
# price_projection.py
POST /price-projection/generate-futures?force=true
```
- **When**: Admin/debug or refresh button
- **Why**: Testing or manual refresh
- **Force**: Query parameter (optional)

---

## Scenarios

### Scenario 1: First-Time User
```
Day 1:
1. Login → No data → Routed to upload page
2. Upload purchases → Futures generated (force=True)
3. View analysis → Futures: Feb 1, Apr 1, Jul 1, Oct 1, Jan 1+1

Day 2:
1. Login → Check freshness → Stale (created Jan 1, today is Jan 2)
2. Auto-regenerate → New futures: Feb 2, Apr 2, Jul 2, Oct 2, Jan 2+1
3. View analysis → Fresh futures
```

### Scenario 2: Multiple Logins Same Day
```
Day 1:
1. Login 9am → Generate futures (Jan 1 base)
2. Logout
3. Login 2pm → Check freshness → Fresh (created today)
4. Skip regeneration → Use existing futures
```

### Scenario 3: New Data Upload
```
Day 5:
1. User has data from Day 1
2. Upload NEW purchases (different prices)
3. Force regeneration → New base prices applied
4. Futures updated with new pricing
```

### Scenario 4: Data Cleared (NEW)
```
Day 1, 9am:
1. Login → Upload purchases → Futures generated
2. View analysis → Charts show futures

Day 1, 11am:
1. User calls /data/reset (clears purchases)
2. Futures still exist in DB (created today)

Day 1, 2pm:
1. Login → Check finds NO purchases
2. Futures CLEARED automatically
3. User routed to Upload page
4. Charts empty until new data uploaded
```

**Key Insight**: Futures are tied to purchase data existence, not just date freshness.

---

## Benefits

### ✅ Accuracy
- Futures always relative to TODAY
- Never stale or expired

### ✅ Performance
- Skips unnecessary regeneration
- Only regenerates when needed

### ✅ Flexibility
- Manual force option available
- Works across multiple days/sessions

### ✅ Data-Driven
- Base prices from actual purchases
- Updates when new data uploaded

---

## Database Storage

### MarketPrice Table
```sql
| commodity_id | price_date | contract_month | price | source           |
|--------------|------------|----------------|-------|------------------|
| sugar-uuid   | 2026-01-21 | 2026-02-01    | 18.72 | mock_futures_low |
| sugar-uuid   | 2026-01-21 | 2026-02-01    | 19.28 | mock_futures_high|
| sugar-uuid   | 2026-01-21 | 2026-04-01    | 17.88 | mock_futures_low |
| sugar-uuid   | 2026-01-21 | 2026-04-01    | 19.92 | mock_futures_high|
```

**Key Fields:**
- `price_date`: When futures were CREATED (used for freshness check)
- `contract_month`: When futures EXPIRE (1M/3M/6M/9M/12M ahead)
- `source`: Distinguishes mock futures from real market data

---

## Testing

### Test 1: Freshness Check
```bash
# Day 1: Generate futures
curl -X POST http://localhost:8000/login -d '{"username":"avi","password":"avi123"}'
# → Generates futures with price_date = 2026-01-21

# Same day: Login again
curl -X POST http://localhost:8000/login -d '{"username":"avi","password":"avi123"}'
# → Skips regeneration (futures fresh)

# Next day: Login
# Change system date to 2026-01-22 (testing)
curl -X POST http://localhost:8000/login -d '{"username":"avi","password":"avi123"}'
# → Regenerates futures (stale)
```

### Test 2: Force Regeneration
```bash
# Force regeneration even if fresh
curl -X POST http://localhost:8000/price-projection/generate-futures?force=true
# → Always regenerates

# Normal regeneration (skip if fresh)
curl -X POST http://localhost:8000/price-projection/generate-futures?force=false
# → Skips if fresh
```

---

## Production Considerations

### 1. **Caching**
- Cache futures in Redis with TTL = 1 day
- Invalidate on upload or manual regeneration

### 2. **Async Jobs**
- Daily cron job to regenerate all customers' futures
- Run at midnight to ensure fresh data

### 3. **Real Market Data**
- Replace mock generation with real API calls
- Keep same freshness check logic
- Rate limit API calls

### 4. **Monitoring**
- Log regeneration events
- Alert if regeneration fails
- Track API call volume

---

## Summary

The futures regeneration system ensures:
1. ✅ Futures are always current (from TODAY)
2. ✅ Efficient (skip if fresh)
3. ✅ Data-driven (based on customer purchases)
4. ✅ Flexible (manual force option)
5. ✅ Production-ready (logging, error handling)

This approach balances accuracy, performance, and user experience for the demo.
