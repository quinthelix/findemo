/**
 * Portfolio History Page
 * Shows executed hedges and their performance
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './PortfolioHistoryPage.css';

interface HistoricalHedge {
  id: string;
  date: string;
  commodity: string;
  future_type: 'high' | 'low';
  contract_month: string;
  quantity: number;
  locked_price: number;
  contract_cost: number;
  current_market_price: number;
  savings: number;
}

export const PortfolioHistoryPage = () => {
  const navigate = useNavigate();
  const [timeFilter, setTimeFilter] = useState<'1m' | '6m' | 'all'>('all');

  // Mock historical data
  const historicalHedges: HistoricalHedge[] = [
    // Last Month
    {
      id: '1',
      date: '2025-12-15',
      commodity: 'sugar',
      future_type: 'low',
      contract_month: '2026-01-01',
      quantity: 150000,
      locked_price: 0.42,
      contract_cost: 0.03,
      current_market_price: 0.48,
      savings: 9000, // (0.48 - 0.42) × 150,000
    },
    {
      id: '2',
      date: '2025-12-20',
      commodity: 'flour',
      future_type: 'low',
      contract_month: '2026-02-01',
      quantity: 100000,
      locked_price: 0.35,
      contract_cost: 0.03,
      current_market_price: 0.39,
      savings: 4000, // (0.39 - 0.35) × 100,000
    },
    {
      id: '3',
      date: '2025-12-22',
      commodity: 'sugar',
      future_type: 'high',
      contract_month: '2026-03-01',
      quantity: 80000,
      locked_price: 0.46,
      contract_cost: 0.01,
      current_market_price: 0.44,
      savings: -1600, // Loss: locked higher than market
    },
    // 6 Months Ago
    {
      id: '4',
      date: '2025-07-10',
      commodity: 'sugar',
      future_type: 'low',
      contract_month: '2025-08-01',
      quantity: 200000,
      locked_price: 0.38,
      contract_cost: 0.03,
      current_market_price: 0.52,
      savings: 28000, // Excellent hedge!
    },
    {
      id: '5',
      date: '2025-07-15',
      commodity: 'flour',
      future_type: 'low',
      contract_month: '2025-09-01',
      quantity: 120000,
      locked_price: 0.32,
      contract_cost: 0.03,
      current_market_price: 0.41,
      savings: 10800,
    },
    {
      id: '6',
      date: '2025-07-20',
      commodity: 'sugar',
      future_type: 'low',
      contract_month: '2025-10-01',
      quantity: 180000,
      locked_price: 0.40,
      contract_cost: 0.03,
      current_market_price: 0.49,
      savings: 16200,
    },
    {
      id: '7',
      date: '2025-08-05',
      commodity: 'flour',
      future_type: 'high',
      contract_month: '2025-11-01',
      quantity: 90000,
      locked_price: 0.37,
      contract_cost: 0.01,
      current_market_price: 0.38,
      savings: -900, // Small loss
    },
  ];

  const filterByTime = (hedges: HistoricalHedge[]) => {
    const now = new Date();
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());

    return hedges.filter(hedge => {
      const hedgeDate = new Date(hedge.date);
      if (timeFilter === '1m') return hedgeDate >= oneMonthAgo;
      if (timeFilter === '6m') return hedgeDate >= sixMonthsAgo;
      return true;
    });
  };

  const filteredHedges = filterByTime(historicalHedges);
  const totalSavings = filteredHedges.reduce((sum, h) => sum + h.savings, 0);
  const totalContracts = filteredHedges.length;
  const profitableContracts = filteredHedges.filter(h => h.savings > 0).length;

  return (
    <div className="portfolio-page">
      <header className="page-header">
        <div>
          <h1>Portfolio History</h1>
          <p>Review executed hedges and their performance</p>
        </div>
        <div className="header-actions">
          <button onClick={() => navigate('/dashboard/var')} className="btn-secondary">
            ← Back to Analysis
          </button>
        </div>
      </header>

      <div className="portfolio-content">
        {/* Summary Cards */}
        <div className="summary-cards">
          <div className="summary-card">
            <div className="card-icon">💰</div>
            <div className="card-content">
              <div className="card-label">Total Savings</div>
              <div className="card-value" style={{ color: totalSavings >= 0 ? '#10b981' : '#ef4444' }}>
                ${totalSavings.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
          
          <div className="summary-card">
            <div className="card-icon">📊</div>
            <div className="card-content">
              <div className="card-label">Total Contracts</div>
              <div className="card-value">{totalContracts}</div>
            </div>
          </div>

          <div className="summary-card">
            <div className="card-icon">✅</div>
            <div className="card-content">
              <div className="card-label">Success Rate</div>
              <div className="card-value">
                {((profitableContracts / totalContracts) * 100).toFixed(0)}%
              </div>
            </div>
          </div>

          <div className="summary-card">
            <div className="card-icon">💸</div>
            <div className="card-content">
              <div className="card-label">Avg Savings per Contract</div>
              <div className="card-value" style={{ color: totalSavings >= 0 ? '#10b981' : '#ef4444' }}>
                ${(totalSavings / totalContracts).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>

        {/* Time Filter */}
        <div className="time-filter">
          <button 
            className={timeFilter === '1m' ? 'active' : ''}
            onClick={() => setTimeFilter('1m')}
          >
            Last Month
          </button>
          <button 
            className={timeFilter === '6m' ? 'active' : ''}
            onClick={() => setTimeFilter('6m')}
          >
            Last 6 Months
          </button>
          <button 
            className={timeFilter === 'all' ? 'active' : ''}
            onClick={() => setTimeFilter('all')}
          >
            All Time
          </button>
        </div>

        {/* Hedges Table */}
        <div className="hedges-table-container">
          <table className="hedges-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Commodity</th>
                <th>Type</th>
                <th>Contract Month</th>
                <th>Quantity</th>
                <th>Locked Price</th>
                <th>Contract Cost</th>
                <th>Current Market</th>
                <th>Savings</th>
              </tr>
            </thead>
            <tbody>
              {filteredHedges.map(hedge => (
                <tr key={hedge.id} className={hedge.savings >= 0 ? 'profitable' : 'loss'}>
                  <td>{new Date(hedge.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td>
                    <span className={`commodity-badge ${hedge.commodity}`}>
                      {hedge.commodity.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <span className={`type-badge ${hedge.future_type}`}>
                      {hedge.future_type.toUpperCase()}
                    </span>
                  </td>
                  <td>{new Date(hedge.contract_month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</td>
                  <td>{hedge.quantity.toLocaleString()} lbs</td>
                  <td>${hedge.locked_price.toFixed(3)}/lb</td>
                  <td>${hedge.contract_cost.toFixed(2)}</td>
                  <td>${hedge.current_market_price.toFixed(3)}/lb</td>
                  <td className="savings">
                    {hedge.savings >= 0 ? '+' : ''}${hedge.savings.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
