# Findemo Frontend

React + TypeScript + Vite frontend for the Commodity Hedging & VaR Demo application.

## 🚀 Quick Start

### Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Visit http://localhost:5173
```

### Testing

```bash
# Run tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Build

```bash
# Production build
npm run build

# Preview production build
npm run preview
```

## 📁 Project Structure

```
src/
├── api/
│   ├── client.ts          # Axios instance with interceptors
│   └── endpoints.ts       # Typed API endpoints
├── components/
│   ├── VaRTimelineChart.tsx  # Main VaR visualization
│   └── HedgePanel.tsx     # Hedge session management
├── screens/
│   ├── LoginScreen.tsx    # Screen 1: Login
│   ├── DataLoadScreen.tsx # Screen 2: Data Upload
│   ├── RiskDecisionScreen.tsx  # Screen 3: Main risk view
│   └── ExecuteScreen.tsx  # Screen 4: Execute hedge
├── types/
│   └── api.ts             # TypeScript types (from AGENTS.md)
├── tests/
│   ├── mocks/             # MSW mock handlers
│   ├── setup.ts           # Vitest setup
│   └── *.test.tsx         # Test files
├── App.tsx                # Main app with routing
└── main.tsx               # Entry point
```

## 🎨 Screens

### 1. Login Screen (`/`)
- Simple demo login
- Pre-filled credentials: `demo` / `demo123`
- JWT token storage

### 2. Data Load Screen (`/data-load`)
- Upload purchases Excel
- Upload inventory Excel
- Trigger market data refresh
- Skip option for demo data

### 3. Risk & Decision Screen (`/risk`)
- Large VaR timeline chart
- Shows with/without hedge scenarios
- Hedge panel (shopping cart for futures)
- Real-time VaR updates as quantities change

### 4. Execute Screen (`/execute`)
- Review hedge positions
- Confirm and execute
- Display final VaR
- Immutable execution

## 🧪 Testing

### Technologies
- **Vitest**: Fast unit test framework
- **React Testing Library**: Component testing
- **MSW**: API mocking

### Test Coverage
- ✅ Login screen and authentication
- ✅ Risk decision screen rendering
- ✅ VaR chart component
- ✅ API client with interceptors
- ✅ All API endpoints mocked

### Run Tests

```bash
# Watch mode
npm test

# Single run
npm test -- --run

# With coverage
npm run test:coverage

# Interactive UI
npm run test:ui
```

## 🔧 Configuration

### Environment Variables

Create `.env.local`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

### Vite Config

See `vite.config.ts` for build configuration.

### Vitest Config

See `vitest.config.ts` for test configuration.

## 📊 Key Features

### VaR Timeline Chart
- Historical and forward VaR
- Two scenarios: with/without hedge
- Interactive Recharts visualization
- Responsive design

### Hedge Panel
- Add futures contracts
- Adjust quantities with sliders
- Remove positions
- Real-time notional calculation
- VaR recalculation on update

### Authentication
- JWT token management
- Auto-logout on 401
- Protected routes
- Token in localStorage

## 🎯 API Integration

All API calls use typed endpoints from `src/api/endpoints.ts`:

```typescript
import { login, getVaRTimeline, addHedgeItem } from './api/endpoints';

// Login
const response = await login({ username: 'demo', password: 'demo123' });

// Get VaR
const varData = await getVaRTimeline({ 
  confidence_level: 0.95,
  start_date: '2026-01-01',
  end_date: '2026-12-31',
});

// Add hedge
await addHedgeItem({
  commodity: 'sugar',
  contract_month: '2026-03-01',
  quantity: 1000,
});
```

## 🔒 Authentication Flow

1. User logs in → receives JWT token
2. Token stored in localStorage
3. apiClient interceptor adds `Authorization: Bearer {token}` to all requests
4. On 401 response → clear token and redirect to login

## 🚢 Deployment

### Docker

```bash
# Build image
docker build -t findemo-frontend .

# Run container
docker run -p 3000:3000 findemo-frontend
```

### Production Build

```bash
npm run build
# Output in ./dist directory
```

## 📝 Development Notes

- All TypeScript types match backend schemas (AGENTS.md section 10)
- API client has automatic token injection
- MSW provides realistic API mocking for tests
- All screens are responsive
- CSS modules for component styles

## 🐛 Troubleshooting

### Tests failing
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Vite dev server not starting
```bash
# Check port 5173 is available
lsof -ti:5173 | xargs kill -9
npm run dev
```

### API calls failing
- Check backend is running on port 8000
- Verify `VITE_API_BASE_URL` in `.env.local`
- Check network tab in browser DevTools

## 📚 Documentation

- [AGENTS.md](../AGENTS.md) - Full specification
- [Backend API](../backend/README.md) - API endpoints
- [Testing Guide](../TESTING_DOCKER.md) - How to test

## ✅ Phase 3 Complete

All Phase 3 requirements implemented:
- ✅ React + TypeScript + Vite setup
- ✅ API client and TypeScript types
- ✅ All 4 screens (Login, DataLoad, RiskDecision, Execute)
- ✅ VaR timeline chart with Recharts
- ✅ Hedge panel with real-time updates
- ✅ Frontend test suite with MSW
- ✅ Comprehensive test coverage

Ready for Phase 4: Integration Testing! 🚀
