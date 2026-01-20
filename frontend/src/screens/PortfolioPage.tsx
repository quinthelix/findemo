/**
 * Portfolio Page
 * List all purchased futures with details (future id, quantity, structure, value, expiry)
 * NOW USES REAL API per AGENTS.md 10.10
 */
import { useState, useEffect } from 'react';
import { getExecutedHedges } from '../api/endpoints';
import type { PortfolioResponse } from '../types/api';
import './PortfolioPage.css';

export const PortfolioPage = () => {
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPortfolio();
  }, []);

  const loadPortfolio = async () => {
    try {
      // Use real API endpoint (no more mock data)
      const data = await getExecutedHedges();
      setPortfolio(data);
    } catch (err) {
      console.error('Failed to load portfolio:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="portfolio-page">
        <div className="loading-state">Loading portfolio...</div>
      </div>
    );
  }

  if (!portfolio || portfolio.hedges.length === 0) {
    return (
      <div className="portfolio-page">
        <div className="empty-portfolio">
          <div className="empty-icon">◉</div>
          <h2>No Executed Hedges</h2>
          <p>Execute hedges from the Trade Execution page to see them here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="portfolio-page">
      <header className="page-header">
        <div>
          <h1>Portfolio</h1>
          <p>All executed futures positions</p>
        </div>
        <div className="portfolio-summary">
          <div className="summary-card">
            <span className="summary-label">Total Positions</span>
            <span className="summary-value">{portfolio.summary.total_positions}</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Total Quantity</span>
            <span className="summary-value">{portfolio.summary.total_quantity.toLocaleString()}</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Total Value</span>
            <span className="summary-value">${portfolio.summary.total_value.toLocaleString()}</span>
          </div>
        </div>
      </header>

      <div className="portfolio-content">
        <div className="portfolio-table">
          <table>
            <thead>
              <tr>
                <th>Future ID</th>
                <th>Commodity</th>
                <th>Contract Month</th>
                <th>Quantity</th>
                <th>Execution Price</th>
                <th>Value</th>
                <th>Execution Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.hedges.map((hedge) => {
                const expiryDate = new Date(hedge.contract_month);
                const executionDate = new Date(hedge.execution_date);
                
                return (
                  <tr key={hedge.id}>
                    <td className="future-id">{hedge.id}</td>
                    <td>
                      <span className={`commodity-badge ${hedge.commodity}`}>
                        {hedge.commodity.toUpperCase()}
                      </span>
                    </td>
                    <td>{expiryDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</td>
                    <td className="quantity-cell">{hedge.quantity.toLocaleString()}</td>
                    <td>${hedge.execution_price.toFixed(2)}</td>
                    <td className="value-cell">${hedge.value.toLocaleString()}</td>
                    <td>{executionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td>
                      <span className={`status-badge ${hedge.status}`}>
                        {hedge.status.charAt(0).toUpperCase() + hedge.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="portfolio-breakdown">
          <h2>Breakdown by Commodity</h2>
          <div className="breakdown-grid">
            <div className="breakdown-card">
              <h3 className="commodity-title sugar">Sugar</h3>
              <div className="breakdown-stats">
                <div className="stat">
                  <span className="stat-label">Total Quantity</span>
                  <span className="stat-value">{portfolio.breakdown.sugar.total_quantity.toLocaleString()}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Total Value</span>
                  <span className="stat-value">${portfolio.breakdown.sugar.total_value.toLocaleString()}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Contracts</span>
                  <span className="stat-value">{portfolio.breakdown.sugar.contracts}</span>
                </div>
              </div>
            </div>

            <div className="breakdown-card">
              <h3 className="commodity-title flour">Flour</h3>
              <div className="breakdown-stats">
                <div className="stat">
                  <span className="stat-label">Total Quantity</span>
                  <span className="stat-value">{portfolio.breakdown.flour.total_quantity.toLocaleString()}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Total Value</span>
                  <span className="stat-value">${portfolio.breakdown.flour.total_value.toLocaleString()}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Contracts</span>
                  <span className="stat-value">{portfolio.breakdown.flour.contracts}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
