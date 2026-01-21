# Demo Checklist - Commodity Hedging & VaR Tool

## ✅ Pre-Demo Setup (Complete)
- [x] Clean Docker build
- [x] Database schema created
- [x] User created: `avi` / `avi123`
- [x] Company: HedgyMunchy

## 📋 Demo Flow

### 1. Login (http://localhost:3000)
- Username: `avi`
- Password: `avi123`
- Should show: "HedgyMunchy (avi)" in top left

### 2. Data Upload Page
- Click "Data Upload" in sidebar (first icon)
- Upload files:
  - **Purchases**: `data/demo_purchases_v2.xlsx` (uploads first, triggers futures generation)
  - **Inventory**: `data/demo_inventory_v2.xlsx`
- Wait for "Upload successful" message
- Check data status shows row counts
- **Note**: Mock futures are automatically generated from purchase data
  - Base prices calculated from average of customer's purchase prices
  - Futures created for each commodity in the upload (not hardcoded)

### 3. Value at Risk Page
- Click "Value at Risk" in sidebar (second icon)
- Should see:
  - **Legend**: Sugar and Flour (half solid, half dashed)
  - **Main Chart**: Total Cost Projection with uncertainty bands
  - **Right Sidebar**: Future tiles for both commodities
  - **Data Labels Buttons**: Price, Future, Eval High, Eval Low

### 4. Chart Features to Demonstrate
- **Solid Lines**: 
  - Blue (Sugar), Purple (Flour)
  - Past = actual costs
  - Future = projected with uncertainty bands
- **Dashed Lines**: 
  - Start aligned with solid lines
  - Diverge when futures are evaluated
- **VaR Labels**: Show at 1M, 3M, 6M, 9M, 12M milestones
- **Data Labels**: Toggle on/off to show backend data points
  - ● Circle = Historic prices
  - ◆ Diamond = Future projections
  - ▲ Triangle = Evaluated high
  - ■ Square = Evaluated low

### 5. Evaluate Futures
- On right sidebar, check a future checkbox
- Watch dashed lines diverge showing hedged scenario
- Click "Add" to add to portfolio
- "Drop" to remove and reset

### 6. Trade Execution
- Click "Trade Execution" in sidebar (third icon)
- Review selected futures
- Show Execute/Abort functionality

## 🎯 Key Talking Points

### Problem Statement
"Commodity buyers face price volatility risk. They need to see:
1. Historical purchase costs
2. Future price projections with uncertainty
3. Impact of hedging decisions on risk"

### Solution Highlights
1. **Data-Driven Analysis**: System adapts to YOUR commodities and purchase history
   - No hardcoded assumptions
   - Futures priced from actual purchase averages
2. **Visual Risk Assessment**: See total cost projections with growing uncertainty over time
3. **Real-time Hedge Impact**: Dashed lines show immediate effect of hedging decisions
4. **Portfolio Risk (VaR)**: Quantified downside risk at key milestones
5. **Interactive Decision Support**: Toggle evaluations, compare scenarios

### Technical Architecture
- **Frontend**: React + TypeScript + Recharts
- **Backend**: Python FastAPI + PostgreSQL
- **Deployment**: Docker Compose (easy cloud migration)

## ⚠️ Known Limitations (For Transparency)
- Demo data only (2 commodities)
- Mock futures (not real market data)
- Simplified VaR calculation (parametric, no correlation yet)
- Single user/company

## 🔧 Troubleshooting

### If chart doesn't load:
1. Check browser console for errors
2. Verify data was uploaded successfully
3. Refresh page to regenerate mock futures

### If login fails:
```bash
# Reset user
docker-compose exec backend python -c "
from app.database import AsyncSessionLocal
from app.models.database import User
from app.services.auth_service import get_password_hash
import asyncio
import uuid

async def reset():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.username == 'avi'))
        user = result.scalar_one_or_none()
        if user:
            user.password_hash = get_password_hash('avi123')
            await db.commit()
            print('✅ Password reset')

asyncio.run(reset())
"
```

## 📊 Demo Data Files
- Location: `/Users/yonihalevi/dev/findemo/data/`
- Files:
  - `demo_purchases_v2.xlsx` - Historic purchase data
  - `demo_inventory_v2.xlsx` - Current inventory levels

## 🌐 URLs
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## ⏱️ Demo Timeline (15-20 minutes)
1. **Intro** (2 min): Problem statement
2. **Data Upload** (3 min): Show Excel ingestion
3. **Risk Visualization** (5 min): Explain chart, uncertainty, VaR
4. **Hedge Evaluation** (5 min): Interactive scenario testing
5. **Q&A** (5 min): Technical architecture, roadmap

## 🚀 Post-Demo
- Collect feedback
- Discuss multi-tenant requirements
- Plan production deployment
