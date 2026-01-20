# Frontend Functionality Changes from AGENTS.md Specification

This document lists all functionality changes made to the frontend implementation compared to the original AGENTS.md specification. Review these to determine if API contract changes are required.

---

## 1. SCREEN STRUCTURE CHANGES

### Original Spec (AGENTS.md Section 7)
```
Screen 1: Login
Screen 2: Data Load (Excel upload)
Screen 3: Risk & Decision (Main Screen)
Screen 4: Execute Hedge
```

### Current Implementation
```
Screen 1: Login (NewLoginScreen)
Screen 2: Data Load (NOT IMPLEMENTED - removed from navigation)
Screen 3: Dashboard with 3 tabs:
  - Value at Risk (Analysis)
  - Trade Execution
  - Portfolio
```

### Impact
- **Data Load screen removed** from main navigation flow
- **Navigation changed** from sequential flow to tabbed sidebar
- **Portfolio screen added** (not in original spec)

**API Impact**: ❓ REVIEW REQUIRED
- Excel upload endpoints may not be used in current UI flow
- May need portfolio/executed hedges endpoint (currently using mock data)

---

## 2. VALUE AT RISK PAGE (RISK & DECISION SCREEN)

### Original Spec (AGENTS.md Section 7, Screen 3)
**Primary Element:**
- Large VaR Timeline Chart (past solid, future dashed, before/after hedge)

**Secondary Elements:**
- Hedge session panel (futures list + quantity selectors)
- ΔVaR indicator
- Small supporting charts

**Workflow:**
1. User sees VaR chart
2. Adjusts hedge quantities in session panel
3. Sees real-time VaR update
4. Navigates to Execute screen

### Current Implementation
**Layout:**
- 70% width: Large VaR chart + 3 supporting charts below
- 30% width: Futures sidebar with individual tiles

**Futures Tiles (Individual Controls):**
- Each future has its own tile
- Per-tile controls:
  - `EXPIRES: [date]` and `QTY: [input]` on same line
  - Price shown as `$X.XX/50k lbs` or `$X.XX/100k lbs`
  - Notional value calculated per tile
  - Three equal-sized buttons: `⚡ Eval`, `✓ Add`, `✕ Drop`

**Workflow Changes:**
1. User adjusts quantity **per individual future**
2. Clicks `⚡ Eval` button **per future** (triggers VaR recalculation)
3. Clicks `✓ Add` to add to portfolio
4. Clicks `✕ Drop` to reset quantity and remove from purchase
5. Clicks "Go to Trade Execution" at bottom

### Impact
**Changed Behavior:**
- ❌ **Removed**: Global hedge session panel
- ❌ **Removed**: Live sliding quantity with auto-update
- ✅ **Added**: Individual "Evaluate" button per future (explicit action)
- ✅ **Added**: "Add to Portfolio" action per future
- ✅ **Added**: "Drop" action to reset/remove
- ✅ **Changed**: Price display includes unit (50k lbs / 100k lbs)

**API Impact**: ⚠️ **POTENTIAL CHANGES REQUIRED**

1. **Evaluate Button Workflow**
   - Original: User slides quantity → auto-triggers `GET /var/timeline`
   - Current: User sets quantity → clicks Eval → triggers `GET /var/timeline`
   - **Question**: Should eval button also update hedge session, or just preview VaR?

2. **Add to Portfolio Action**
   - Current implementation calls: `POST /hedge-session/add`
   - **Verify**: Does this endpoint accept individual future additions?
   
3. **Drop Action**
   - Current implementation: Removes from hedge session
   - **Verify**: Should this call `DELETE /hedge-session/remove`?

4. **Price Display**
   - Frontend now shows price per contract unit (50k lbs, 100k lbs)
   - **Verify**: Does `GET /market-data/futures` return unit information?
   - **Current assumption**: Hardcoded (sugar = 50k lbs, flour = 100k lbs)

---

## 3. TRADE EXECUTION PAGE

### Original Spec (AGENTS.md Section 7, Screen 4)
**Purpose**: Review hedge session and execute

**Elements:**
- Review current hedge session
- Show final VaR impact
- "Execute" button
- Confirmation summary

**Workflow:**
1. User reviews hedges in session
2. Sees final VaR
3. Clicks Execute
4. Sees confirmation

### Current Implementation
**Purpose**: Shopping cart metaphor

**Elements:**
- Table showing all hedge session items
- Editable quantities (inline)
- Remove button per row (✕ icon)
- Total notional value
- VaR summary panel
- Warning box
- Execute All button

**Workflow:**
1. User reviews items in "cart"
2. Can edit quantities directly in table
3. Can remove individual items
4. Sees VaR impact summary
5. Clicks "Execute All"
6. Sees success screen with final VaR

### Impact
**Changed Behavior:**
- ✅ **Added**: Inline quantity editing in execution screen
- ✅ **Added**: Individual item removal in execution screen
- ✅ **Added**: Success screen with celebration UI

**API Impact**: ✅ **NO CHANGES REQUIRED**
- Uses existing endpoints:
  - `GET /hedge-session/current`
  - `POST /hedge-session/update`
  - `DELETE /hedge-session/remove`
  - `POST /hedge-session/execute`

---

## 4. PORTFOLIO PAGE (NEW)

### Original Spec
**NOT SPECIFIED IN AGENTS.MD**

### Current Implementation
**Purpose**: View all executed hedges

**Elements:**
- Summary cards (Total Positions, Total Value, Active Contracts)
- Table with columns:
  - Future ID
  - Commodity
  - Contract Month
  - Quantity
  - Execution Price
  - Value
  - Status
- Breakdown by commodity

**Data Source:**
- Currently uses **MOCK DATA**
- No API endpoint implemented

### Impact
**API Impact**: ⚠️ **NEW ENDPOINT REQUIRED**

```
GET /portfolio/executed-hedges
```

**Suggested Response:**
```json
{
  "summary": {
    "total_positions": 10,
    "total_value": 52000,
    "active_contracts": 8
  },
  "hedges": [
    {
      "id": "FUT-2026-001",
      "commodity": "sugar",
      "contract_month": "2026-03-01",
      "quantity": 5000,
      "execution_price": 0.52,
      "execution_date": "2026-01-15T10:30:00Z",
      "value": 2600,
      "status": "active"
    }
  ],
  "breakdown": {
    "sugar": {
      "total_quantity": 10000,
      "total_value": 30000,
      "contracts": 5
    },
    "flour": {
      "total_quantity": 8000,
      "total_value": 22000,
      "contracts": 3
    }
  }
}
```

---

## 5. DATA LOAD SCREEN

### Original Spec (AGENTS.md Section 7, Screen 2)
**Purpose**: Upload Excel files

**Elements:**
- Excel upload for Purchases
- Excel upload for Inventory
- Trigger market data fetch
- Validation feedback
- "Proceed to Risk View" button

### Current Implementation
**Status**: ❌ **NOT IN NAVIGATION**

**Code exists** in:
- `frontend/src/screens/DataLoadScreen.tsx`
- `frontend/src/screens/DataLoadScreen.css`

**But removed from routing** in `App.tsx`

### Impact
**API Impact**: ⚠️ **REVIEW WORKFLOW**

**Questions:**
1. How do users load their data now?
2. Should Data Load be added back to navigation?
3. Or is demo data sufficient for demo purposes?

**API Endpoints Potentially Unused:**
- `POST /upload/purchases`
- `POST /upload/inventory`
- `POST /market-data/refresh`

---

## 6. HEDGE SESSION WORKFLOW CHANGES

### Original Spec (AGENTS.md Section 9.4)
**Live Hedge Impact Workflow:**
1. User updates hedge quantity (slider)
2. Frontend calls hedge-session update endpoint
3. Frontend re-requests `/var/timeline`
4. Backend recomputes VaR using updated hedge session

### Current Implementation
**Two-Step Workflow:**
1. User sets quantity in tile
2. User clicks "Evaluate" button
3. Frontend calls `/var/timeline` (preview only?)
4. User clicks "Add to Portfolio"
5. Frontend calls `/hedge-session/add`
6. Frontend re-requests `/var/timeline`

### Impact
**API Impact**: ❓ **CLARIFY BEHAVIOR**

**Questions:**
1. Should "Evaluate" update the hedge session or just preview?
2. Does "Add to Portfolio" create/update session item?
3. Should there be a separate "preview VaR" endpoint?

**Current Assumptions:**
- Evaluate: Calls `GET /var/timeline` (assumes session already updated?)
- Add: Calls `POST /hedge-session/add` → updates session
- Drop: Removes from session

**Potential Issue**: 
- If Evaluate doesn't update session, VaR calculation won't reflect changes
- Need to clarify: Does `/var/timeline` use current session state or parameters?

---

## 7. UI/UX CHANGES (NO API IMPACT)

These are visual/styling changes with **no API contract impact**:

✅ **Color Theme**
- Modern dark theme (#0f172a background)
- Indigo/purple primary colors
- Cyan success, amber warning, red danger

✅ **Layout**
- Sidebar navigation (260px fixed width)
- 70/30 split (charts/futures)
- Glowing active page indicator

✅ **Animations**
- Page transitions (0.4s fade + slide)
- Button hover effects
- Fluorescent button borders

✅ **Typography**
- Uppercase labels with letter-spacing
- Modern icons (Unicode symbols)

✅ **Futures Tiles**
- Compact design (25% height reduction)
- Inline date/quantity layout
- Three equal buttons with icons

---

## 8. SUMMARY OF API IMPACTS

### ✅ NO CHANGES NEEDED
- Login: `POST /login`
- VaR Timeline: `GET /var/timeline`
- Futures Contracts: `GET /market-data/futures`
- Hedge Session CRUD: All existing endpoints work

### ⚠️ REVIEW REQUIRED

1. **Futures Contracts Response**
   - Add unit information per commodity?
   - Current: Frontend hardcodes (sugar=50k, flour=100k)
   ```json
   {
     "commodity": "sugar",
     "contract_unit": "50000 lbs",  // ADD THIS?
     "price_per_unit": 0.52
   }
   ```

2. **Evaluate Button Behavior**
   - Clarify: Does evaluate update hedge session?
   - Or is it just a preview?
   - Consider: Separate preview endpoint?

3. **Add to Portfolio Flow**
   - Verify: `POST /hedge-session/add` accepts individual futures
   - Verify: Returns updated session

4. **Drop Action**
   - Verify: `DELETE /hedge-session/remove` handles reset

### ⚠️ NEW ENDPOINTS NEEDED

1. **Portfolio Page**
   ```
   GET /portfolio/executed-hedges
   ```
   - Returns all executed hedges for customer
   - Includes summary statistics
   - Includes commodity breakdown

2. **Data Load Workflow** (if re-enabled)
   - Excel upload endpoints exist but unused
   - Clarify if needed for demo

---

## 9. RECOMMENDED ACTIONS

1. **Clarify Evaluate Button Workflow**
   - Document expected behavior
   - Update API contract if needed

2. **Implement Portfolio Endpoint**
   - Create `GET /portfolio/executed-hedges`
   - Replace mock data in frontend

3. **Add Contract Unit Information**
   - Include in futures response
   - Remove hardcoded values from frontend

4. **Decide on Data Load Screen**
   - Re-add to navigation, or
   - Remove code entirely, or
   - Keep for future use

5. **Document Hedge Session Flow**
   - Write step-by-step workflow
   - Clarify when session is created/updated
   - Ensure VaR calculation uses correct state

---

## 10. TESTING CHECKLIST

Before finalizing, test these workflows:

- [ ] Login → Dashboard navigation
- [ ] Evaluate button updates VaR correctly
- [ ] Add to Portfolio creates hedge session item
- [ ] Drop removes hedge session item
- [ ] Trade Execution shows correct items
- [ ] Execute All completes successfully
- [ ] Portfolio shows executed trades (once endpoint exists)
- [ ] VaR chart reflects hedge session state accurately

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-20  
**Review Status**: Pending API Team Review
