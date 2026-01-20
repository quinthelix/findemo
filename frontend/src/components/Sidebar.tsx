/**
 * Sidebar Navigation Component
 */
import { NavLink } from 'react-router-dom';
import './Sidebar.css';

export const Sidebar = () => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-logo">Findemo</h1>
        <p className="sidebar-subtitle">Risk Management Platform</p>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/dashboard/var" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <span className="nav-icon">◈</span>
          <span className="nav-label">Value at Risk</span>
        </NavLink>

        <NavLink to="/dashboard/execution" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <span className="nav-icon">⟫</span>
          <span className="nav-label">Trade Execution</span>
        </NavLink>

        <NavLink to="/dashboard/portfolio" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <span className="nav-icon">◉</span>
          <span className="nav-label">Portfolio</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <button 
          className="logout-btn"
          onClick={() => {
            localStorage.removeItem('access_token');
            window.location.href = '/';
          }}
        >
          <span className="nav-icon">⎋</span>
          <span className="nav-label">Logout</span>
        </button>
      </div>
    </aside>
  );
};
