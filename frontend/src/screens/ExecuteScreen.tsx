/**
 * Screen 4: Execute Hedge
 * Review hedge session and execute (simulate trade commitment)
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentHedgeSession, executeHedge } from '../api/endpoints';
import type { HedgeSessionWithItems, ExecuteHedgeResponse } from '../types/api';
import './ExecuteScreen.css';

export const ExecuteScreen = () => {
  const [hedgeSession, setHedgeSession] = useState<HedgeSessionWithItems | null>(null);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<ExecuteHedgeResponse | null>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadHedgeSession();
  }, []);

  const loadHedgeSession = async () => {
    try {
      const session = await getCurrentHedgeSession();
      setHedgeSession(session);
    } catch (err: any) {
      setError('No active hedge session found');
    }
  };

  const handleExecute = async () => {
    if (!hedgeSession) return;

    setExecuting(true);
    setError('');

    try {
      const response = await executeHedge();
      setResult(response);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Execution failed');
    } finally {
      setExecuting(false);
    }
  };

  const handleBackToRisk = () => {
    navigate('/risk');
  };

  if (result) {
    return (
      <div className="execute-container">
        <div className="execute-card">
          <div className="success-icon">✓</div>
          <h1>Hedge Executed Successfully</h1>
          <p className="execute-time">
            Executed at {new Date(result.executed_at).toLocaleString()}
          </p>

          <div className="final-var">
            <h2>Final VaR (95% Confidence)</h2>
            <div className="var-grid">
              <div className="var-item">
                <span className="var-label">Sugar</span>
                <span className="var-value">
                  ${result.final_var.sugar.toLocaleString()}
                </span>
              </div>
              <div className="var-item">
                <span className="var-label">Flour</span>
                <span className="var-value">
                  ${result.final_var.flour.toLocaleString()}
                </span>
              </div>
              <div className="var-item portfolio">
                <span className="var-label">Portfolio</span>
                <span className="var-value">
                  ${result.final_var.portfolio.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <button onClick={handleBackToRisk} className="btn-primary">
            Back to Risk View
          </button>
        </div>
      </div>
    );
  }

  if (!hedgeSession) {
    return (
      <div className="execute-container">
        <div className="execute-card">
          <div className="error-icon">!</div>
          <h1>No Active Hedge Session</h1>
          <p>{error || 'Please create a hedge session first'}</p>
          <button onClick={handleBackToRisk} className="btn-secondary">
            Back to Risk View
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="execute-container">
      <div className="execute-card">
        <h1>Execute Hedge</h1>
        <p className="subtitle">Review and confirm your hedge positions</p>

        <div className="hedge-summary">
          <h2>Hedge Positions</h2>
          {hedgeSession.items.length === 0 ? (
            <p className="no-items">No hedge items</p>
          ) : (
            <table className="hedge-table">
              <thead>
                <tr>
                  <th>Commodity</th>
                  <th>Contract</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th>Notional</th>
                </tr>
              </thead>
              <tbody>
                {hedgeSession.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="capitalize">{item.commodity}</td>
                    <td>{new Date(item.contract_month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</td>
                    <td>{item.quantity.toLocaleString()}</td>
                    <td>${item.price_snapshot.toFixed(2)}</td>
                    <td>${(item.quantity * item.price_snapshot).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="warning-box">
          <strong>⚠️ Warning</strong>
          <p>Execution is final and cannot be undone. This simulates real trade commitment.</p>
        </div>

        <div className="button-group">
          <button
            onClick={handleBackToRisk}
            disabled={executing}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleExecute}
            disabled={executing || hedgeSession.items.length === 0}
            className="btn-execute"
          >
            {executing ? 'Executing...' : 'Execute Hedge'}
          </button>
        </div>
      </div>
    </div>
  );
};
