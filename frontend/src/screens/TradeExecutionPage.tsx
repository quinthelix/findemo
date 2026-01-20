/**
 * Trade Execution Page
 * Shopping cart with ability to edit quantities, remove items, and execute all
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentHedgeSession, updateHedgeItem, removeHedgeItem, executeHedge } from '../api/endpoints';
import type { HedgeSessionWithItems, ExecuteHedgeResponse } from '../types/api';
import './TradeExecutionPage.css';

export const TradeExecutionPage = () => {
  const [hedgeSession, setHedgeSession] = useState<HedgeSessionWithItems | null>(null);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<ExecuteHedgeResponse | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    try {
      const session = await getCurrentHedgeSession();
      setHedgeSession(session);
    } catch (err) {
      console.error('No active session');
    }
  };

  const handleQuantityChange = async (commodity: string, contractMonth: string, newQuantity: number) => {
    try {
      await updateHedgeItem(commodity, contractMonth, newQuantity);
      loadSession();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update');
    }
  };

  const handleRemove = async (commodity: string, contractMonth: string) => {
    try {
      await removeHedgeItem(commodity, contractMonth);
      loadSession();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to remove');
    }
  };

  const handleExecute = async () => {
    if (!window.confirm('Execute all trades? This action is irreversible.')) {
      return;
    }

    setExecuting(true);
    try {
      const response = await executeHedge();
      setResult(response);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Execution failed');
    } finally {
      setExecuting(false);
    }
  };

  if (result) {
    return (
      <div className="execution-page">
        <div className="execution-success">
          <div className="success-icon">✓</div>
          <h1>Trades Executed Successfully</h1>
          <p className="execution-time">
            Executed at {new Date(result.executed_at).toLocaleString()}
          </p>

          <div className="final-var-summary">
            <h2>Final Portfolio VaR (95%)</h2>
            <div className="var-breakdown">
              <div className="var-item">
                <span className="label">Sugar</span>
                <span className="value">${(result.final_var.sugar / 1000).toFixed(0)}K</span>
              </div>
              <div className="var-item">
                <span className="label">Flour</span>
                <span className="value">${(result.final_var.flour / 1000).toFixed(0)}K</span>
              </div>
              <div className="var-item total">
                <span className="label">Total Portfolio</span>
                <span className="value">${(result.final_var.portfolio / 1000).toFixed(0)}K</span>
              </div>
            </div>
          </div>

          <div className="success-actions">
            <button onClick={() => navigate('/dashboard/portfolio')} className="btn-primary">
              View Portfolio
            </button>
            <button onClick={() => navigate('/dashboard/var')} className="btn-secondary">
              Back to Analysis
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalNotional = hedgeSession?.items.reduce(
    (sum, item) => sum + item.quantity * item.price_snapshot,
    0
  ) || 0;

  return (
    <div className="execution-page">
      <header className="page-header">
        <div>
          <h1>Trade Execution</h1>
          <p>Review and execute your hedge positions</p>
        </div>
        {hedgeSession && hedgeSession.items.length > 0 && (
          <div className="header-actions">
            <button
              onClick={handleExecute}
              disabled={executing}
              className="btn-execute"
            >
              {executing ? 'Executing...' : 'Execute All Trades'}
            </button>
          </div>
        )}
      </header>

      <div className="execution-content">
        {!hedgeSession || hedgeSession.items.length === 0 ? (
          <div className="empty-cart">
            <div className="empty-icon">📋</div>
            <h2>No Items in Execution Cart</h2>
            <p>Add futures contracts from the Value at Risk page to begin</p>
            <button
              onClick={() => navigate('/dashboard/var')}
              className="btn-primary"
            >
              Go to Analysis
            </button>
          </div>
        ) : (
          <>
            <div className="execution-table">
              <table>
                <thead>
                  <tr>
                    <th>Commodity</th>
                    <th>Contract Month</th>
                    <th>Price</th>
                    <th>Quantity</th>
                    <th>Notional Value</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {hedgeSession.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="commodity-cell">
                        <span className="commodity-badge">{item.commodity.toUpperCase()}</span>
                      </td>
                      <td>
                        {new Date(item.contract_month).toLocaleDateString('en-US', {
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td>${item.price_snapshot.toFixed(2)}</td>
                      <td>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            handleQuantityChange(item.commodity, item.contract_month, Number(e.target.value))
                          }
                          min="0"
                          step="100"
                          className="quantity-input"
                        />
                      </td>
                      <td className="notional-cell">
                        ${(item.quantity * item.price_snapshot).toLocaleString()}
                      </td>
                      <td>
                        <button
                          onClick={() => handleRemove(item.commodity, item.contract_month)}
                          className="btn-remove"
                          title="Remove"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="total-label">
                      <strong>Total Notional Value</strong>
                    </td>
                    <td colSpan={2} className="total-value">
                      <strong>${totalNotional.toLocaleString()}</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="execution-summary">
              <h2>Execution Summary</h2>
              <div className="summary-grid">
                <div className="summary-item">
                  <span className="summary-label">Total Positions</span>
                  <span className="summary-value">{hedgeSession.items.length}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Total Notional</span>
                  <span className="summary-value">${totalNotional.toLocaleString()}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Session Status</span>
                  <span className="summary-value status">{hedgeSession.status}</span>
                </div>
              </div>

              <div className="warning-box">
                <strong>⚠️ Important</strong>
                <p>Executing trades is a final action and cannot be undone. Please review all positions carefully.</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
