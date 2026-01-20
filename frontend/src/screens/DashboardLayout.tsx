/**
 * Dashboard Layout with Sidebar
 */
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import './DashboardLayout.css';

export const DashboardLayout = () => {
  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-main">
        <Outlet />
      </main>
    </div>
  );
};
