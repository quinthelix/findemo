/**
 * Main App Component with Routing
 * New structure: Login -> Dashboard with Sidebar -> 3 Main Pages
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { NewLoginScreen } from './screens/NewLoginScreen';
import { DashboardLayout } from './screens/DashboardLayout';
import { ValueAtRiskPage } from './screens/ValueAtRiskPage';
import { TradeExecutionPage } from './screens/TradeExecutionPage';
import { PortfolioPage } from './screens/PortfolioPage';
import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = !!localStorage.getItem('access_token');
  
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<NewLoginScreen />} />
        
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard/var" replace />} />
          <Route path="var" element={<ValueAtRiskPage />} />
          <Route path="execution" element={<TradeExecutionPage />} />
          <Route path="portfolio" element={<PortfolioPage />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
