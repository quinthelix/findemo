/**
 * Main App Component with Routing
 * New structure: Login -> Dashboard with Sidebar -> 3 Main Pages
 */
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { NewLoginScreen } from './screens/NewLoginScreen';
import { DashboardLayout } from './screens/DashboardLayout';
import { DataLoadScreen } from './screens/DataLoadScreen';
import { ValueAtRiskPage } from './screens/ValueAtRiskPage';
import { TradeExecutionPage } from './screens/TradeExecutionPage';
import { PortfolioHistoryPage } from './screens/PortfolioHistoryPage';
import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = !!localStorage.getItem('access_token');
  
  useEffect(() => {
    // Update page title if user is logged in
    const customerName = localStorage.getItem('customer_name');
    if (customerName) {
      const displayName = customerName.charAt(0).toUpperCase() + customerName.slice(1);
      document.title = `${displayName} - Findemo`;
    }
  }, []);
  
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
          <Route index element={<Navigate to="/dashboard/upload" replace />} />
          <Route path="upload" element={<DataLoadScreen />} />
          <Route path="var" element={<ValueAtRiskPage />} />
          <Route path="execution" element={<TradeExecutionPage />} />
          <Route path="portfolio" element={<PortfolioHistoryPage />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
