/**
 * Sidebar Navigation Component
 */
import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import './Sidebar.css';

export const Sidebar = () => {
  const [displayName, setDisplayName] = useState('Findemo');
  
  useEffect(() => {
    // Get customer name and username from localStorage
    const customerName = localStorage.getItem('customer_name');
    const username = localStorage.getItem('username');
    
    if (customerName && username) {
      // Capitalize customer name
      const capitalizedCustomer = customerName.charAt(0).toUpperCase() + customerName.slice(1);
      setDisplayName(`${capitalizedCustomer} (${username})`);
    }
  }, []);
  
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-logo">{displayName}</h1>
        <p className="sidebar-subtitle">Risk Management Platform</p>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/dashboard/upload" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <span className="nav-icon">⬆</span>
          <span className="nav-label">Data Upload</span>
        </NavLink>

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
            localStorage.removeItem('username');
            localStorage.removeItem('customer_name');
            document.title = 'Findemo - Commodity Risk Management';
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
