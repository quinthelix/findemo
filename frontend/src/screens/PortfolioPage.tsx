/**
 * Portfolio Page
 * List all purchased futures with details (future id, quantity, structure, value, expiry)
 */
import { useState, useEffect } from 'react';
import './PortfolioPage.css';

interface ExecutedHedge {
  id: string;
  commodity: string;
  contract_month: string;
  quantity: number;
  execution_price: number;
  execution_date: string;
}

export const PortfolioPage = () => {
  const [hedges, setHedges] = useState<ExecutedHedge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPortfolio();
  }, []);

  const loadPortfolio = async () => {
    try {
      // Mock data for now - replace with actual API endpoint when available
      const mockData: ExecutedHedge[] = [
        {
          id: 'FUT-2026-001',
          commodity: 'sugar',
          contract_month: '2026-03-01',
          quantity: 5000,
          execution_price: 0.52,
          execution_date: '2026-01-15T10:30:00Z',
        },
        {
          id: 'FUT-2026-002',
          commodity: 'flour',
          contract_month: '2026-04-01',
          quantity: 3000,
          execution_price: 0.40,
          execution_date: '2026-01-15T10:30:00Z',
        },
        {
          id: 'FUT-2026-003',
          commodity: 'sugar',
          contract_month: '2026-06-01',
          quantity: 2000,
          execution_price: 0.53,
          execution_date: '2026-01-15T10:30:00Z',
        },
      ];
      
      setHedges(mockData);
    } catch (err) {
      console.error('Failed to load portfolio:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalValue = hedges.reduce((sum, h) => sum + h.quantity * h.execution_price, 0);
  const totalQuantity = hedges.reduce((sum, h) => sum + h.quantity, 0);

  if (loading) {
    return (
      <div className="portfolio-page">
        <div className="loading-state">Loading portfolio...</div>
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
            <span className="summary-value">{hedges.length}</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Total Quantity</span>
            <span className="summary-value">{totalQuantity.toLocaleString()}</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Total Value</span>
            <span className="summary-value">${totalValue.toLocaleString()}</span>
          </div>
        </div>
      </header>

      <div className="portfolio-content">
        {hedges.length === 0 ? (
          <div className="empty-portfolio">
            <div className="empty-icon">📋</div>
            <h2>No Executed Positions</h2>
            <p>Execute trades from the Trade Execution page to see them here</p>
          </div>
        ) : (
          <div className="portfolio-table">
            <table>
              <thead>
                <tr>
                  <th>Future ID</th>
                  <th>Commodity</th>
                  <th>Contract Month</th>
                  <th>Quantity</th>
                  <th>Execution Price</th>
                  <th>Notional Value</th>
                  <th>Execution Date</th>
                  <th>Expiry</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {hedges.map((hedge) => {
                  const expiryDate = new Date(hedge.contract_month);
                  const daysToExpiry = Math.floor(
                    (expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                  );
                  const isExpiringSoon = daysToExpiry < 30 && daysToExpiry > 0;
                  const isExpired = daysToExpiry < 0;

                  return (
                    <tr key={hedge.id}>
                      <td className="future-id">{hedge.id}</td>
                      <td>
                        <span className={`commodity-badge ${hedge.commodity}`}>
                          {hedge.commodity.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        {new Date(hedge.contract_month).toLocaleDateString('en-US', {
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="quantity-cell">{hedge.quantity.toLocaleString()}</td>
                      <td>${hedge.execution_price.toFixed(2)}</td>
                      <td className="value-cell">
                        ${(hedge.quantity * hedge.execution_price).toLocaleString()}
                      </td>
                      <td>
                        {new Date(hedge.execution_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td>
                        {daysToExpiry > 0 ? `${daysToExpiry} days` : 'Expired'}
                      </td>
                      <td>
                        <span
                          className={`status-badge ${
                            isExpired ? 'expired' : isExpiringSoon ? 'warning' : 'active'
                          }`}
                        >
                          {isExpired ? 'Expired' : isExpiringSoon ? 'Expiring Soon' : 'Active'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="portfolio-breakdown">
          <h2>Position Breakdown</h2>
          <div className="breakdown-grid">
            {['sugar', 'flour'].map((commodity) => {
              const commodityHedges = hedges.filter((h) => h.commodity === commodity);
              const commodityValue = commodityHedges.reduce(
                (sum, h) => sum + h.quantity * h.execution_price,
                0
              );
              const commodityQuantity = commodityHedges.reduce((sum, h) => sum + h.quantity, 0);

              return (
                <div key={commodity} className="breakdown-card">
                  <h3 className={`commodity-title ${commodity}`}>
                    {commodity.toUpperCase()}
                  </h3>
                  <div className="breakdown-stats">
                    <div className="stat">
                      <span className="stat-label">Positions</span>
                      <span className="stat-value">{commodityHedges.length}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Total Quantity</span>
                      <span className="stat-value">{commodityQuantity.toLocaleString()}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Total Value</span>
                      <span className="stat-value">${commodityValue.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
