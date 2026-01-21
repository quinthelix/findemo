# Demo Quick Start Guide

## ⏰ T-2 Hours to Demo

---

## 🚀 Pre-Demo Checklist

### 1. System Status
```bash
# Check all containers running
docker-compose ps

# Expected output:
# findemo_frontend   Up    0.0.0.0:3000->5173/tcp
# findemo_backend    Up    0.0.0.0:8000->8000/tcp
# findemo_postgres   Up    0.0.0.0:5432->5432/tcp
```

### 2. Quick Health Check
```bash
# Backend health
curl http://localhost:8000/health
# → {"status":"healthy"}

# Frontend
curl -I http://localhost:3000
# → HTTP/1.1 200 OK
```

### 3. Test Login
- Open: http://localhost:3000
- Login: `avi` / `avi123`
- Should route to: Upload page (no data yet)

---

## 🎬 Demo Script (15 minutes)

### Part 1: Introduction (2 min)

**Opening:**
> "Today I'll show you a commodity risk management tool that adapts to YOUR business - not generic assumptions, but YOUR actual commodities and pricing."

**Key Points:**
- Real-time risk analysis
- Data-driven futures scenarios
- Interactive hedging decisions

---

### Part 2: Data Upload (3 min)

**Show:**
1. Login automatically routes to Upload (smart!)
2. Upload `demo_purchases_v2.xlsx`
   - Point out: "System analyzes YOUR purchase history"
   - Futures generated from YOUR average prices
3. Upload `demo_inventory_v2.xlsx`

**Talking Point:**
> "Notice the system doesn't assume 'sugar' or 'flour' - it works with ANY commodities you upload. Base prices come from your actual procurement costs, not industry averages."

**What Happens Behind:**
- Parses commodities (sugar, flour)
- Calculates avg prices: Sugar ~$0.48/lb, Flour ~$0.37/lb
- Generates 1M/3M/6M/9M/12M futures from TODAY
- Routes to Analysis page

---

### Part 3: Value at Risk Analysis (7 min)

**Main Chart - The Star of the Show:**

1. **Legend (Top)**
   - Two items: Sugar (blue), Flour (purple)
   - Half solid / half dashed line (clever!)

2. **Solid Lines (Historical + Baseline Future)**
   - Past: Actual purchase costs (flat, no risk)
   - Future: Projected total cost with uncertainty
   - Shaded area: Growing uncertainty over time

3. **VaR Labels**
   - Point to 1M, 3M, 6M, 9M, 12M milestones
   - "This is your downside risk in dollars"

4. **Interactive Evaluation**
   - Click checkbox on Feb future tile
   - Watch dashed line diverge
   - "This shows impact of locking in that future price"
   - Uncheck → dashed line aligns back

5. **Data Labels (Optional - if asked)**
   - Show toggle buttons
   - Different shapes for different data types
   - Technical feature for validation

**Talking Points:**
- "Uncertainty grows over time - natural"
- "Dashed lines let you test scenarios instantly"
- "No need to execute to see impact"

**Futures Tiles (Right Side):**
- Show price per unit (e.g., $0.47/lb)
- Quantity matches purchase volumes
- Three buttons: Checkbox (eval), Add (cart), Drop (reset)

---

### Part 4: Trade Execution (3 min)

**Add to Cart:**
1. **Set quantity** on Sugar Feb future (e.g., 5000)
2. Click **"Add"** → Button changes to "✓ In Cart"
3. **Set quantity** on Flour Apr future (e.g., 3000)
4. Click **"Add"** → Button changes to "✓ In Cart"

**Navigate to Execution:**
1. Click **Shopping Cart icon** in sidebar
2. Should show **2 items in cart**

**Review Cart:**
- Each item shows:
  - Commodity (colored: blue=sugar, purple=flour)
  - Contract month
  - Quantity
  - Price snapshot ($/unit)
  - **Total value** for that item
- Bottom shows **Total Portfolio Value**

**Demo Options:**

**Option A - Remove Item (optional):**
- Click "✕ Remove" on one item
- Confirm → Item disappears, total updates

**Option B - Execute:**
- Click "✓ Execute Trades"
- Confirm → Success dialog with timestamp
- Returns to Analysis (cart cleared)

**Option C - Abort:**
- Click "✕ Abort Session"
- Confirm → Returns to Analysis (cart cleared)

**Talking Point:**
> "Familiar shopping cart model - review your hedging decisions before committing. Execute is final, like placing a real trade order."

**Note:** Execute clears cart for clean demo. If keeping cart, just show the cart without executing.

---

### Part 5: Q&A Prompts (1 min)

**Anticipated Questions:**

Q: "Does this only work for sugar and flour?"
A: "No! Upload corn, wheat, coffee - any commodity. System adapts automatically."

Q: "What if I log in tomorrow?"
A: "Futures auto-regenerate to always be 1/3/6/9/12 months from that day."

Q: "What if I clear my data?"
A: "System detects no purchases and clears orphaned futures automatically."

Q: "How are futures priced?"
A: "From YOUR purchase history average. So if your sugar averages $0.48, that's the baseline."

---

## 🎯 Key Differentiators

### 1. Data-Driven (Not Generic)
- ❌ NOT: Hardcoded commodities
- ✅ YES: Works with ANY commodity uploaded
- ❌ NOT: Industry average prices
- ✅ YES: YOUR actual purchase averages

### 2. Always Current
- ❌ NOT: Static dates (Feb 1, Apr 1...)
- ✅ YES: Always 1M/3M/6M/9M/12M from TODAY
- Auto-regenerates daily

### 3. Intelligent System
- Smart login routing (data check)
- Orphan prevention (clears futures if no data)
- Efficient (skip regeneration if fresh)

---

## 🚨 Troubleshooting

### Issue: Login fails
```bash
# Check backend logs
docker-compose logs backend --tail 50

# Verify database
docker-compose exec postgres psql -U findemo -d findemo_db -c "SELECT username, customer_id FROM users;"
```

### Issue: Chart not loading
1. Check browser console (F12)
2. Verify data uploaded successfully
3. Check `/data/status` endpoint

### Issue: Futures not showing
1. Verify purchases uploaded (not just inventory)
2. Check backend logs for futures generation
3. Refresh page (triggers regeneration check)

---

## 📊 Technical Architecture (If Asked)

**Frontend:**
- React + TypeScript
- Recharts for visualization
- Docker containerized

**Backend:**
- Python FastAPI
- Async PostgreSQL
- Smart futures generation
- Customer-isolated (multi-tenant ready)

**Database:**
- PostgreSQL 15
- Customer-scoped data
- Automatic futures cleanup

---

## 📁 Demo Files

**Location:** `/Users/yonihalevi/dev/findemo/data/`

- `demo_purchases_v2.xlsx` - Sugar & Flour purchases (July 2025 - Jan 2026)
- `demo_inventory_v2.xlsx` - Current inventory levels

**Schema:**
- Purchases: commodity, date, quantity, unit, price, price_type (fixed/floating)
- Inventory: commodity, date, quantity

---

## 🎬 Demo Flow Timeline

| Time | Activity | Screen |
|------|----------|--------|
| 0:00 | Login | Login page |
| 0:30 | Upload purchases | Upload page |
| 1:00 | Upload inventory | Upload page |
| 1:30 | Navigate to analysis | Value at Risk page |
| 2:00 | Explain chart | Main chart |
| 4:00 | Show VaR labels | Milestones |
| 5:00 | Interactive eval | Futures tiles |
| 7:00 | Add to cart (2 items) | Futures tiles |
| 8:00 | Navigate to execution | Trade Execution page |
| 9:00 | Review cart & totals | Trade Execution page |
| 10:00 | Demo execute/abort | Trade Execution page |
| 11:00 | Back to analysis | Value at Risk page |
| 12:00 | Q&A | - |

---

## ✅ Success Criteria

After demo, audience should understand:
- ✅ System adapts to THEIR commodities
- ✅ Prices based on THEIR history
- ✅ Visual risk assessment (uncertainty bands)
- ✅ Interactive scenario testing (dashed lines)
- ✅ Decision support (not just data display)

---

## 🔗 Quick Links

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs
- **Health Check:** http://localhost:8000/health

---

## 📞 Emergency Contacts

If system crashes mid-demo:
```bash
# Quick restart
docker-compose restart

# Nuclear option (if needed)
docker-compose down && docker-compose up -d

# Wait 30 seconds, then:
# Recreate schema & seed (see DEMO_CHECKLIST.md)
```

---

## 🎉 You Got This!

- System is production-ready
- All edge cases handled
- Full documentation available
- Clean, modern UI
- Impressive technical depth

**Good luck!** 🚀
