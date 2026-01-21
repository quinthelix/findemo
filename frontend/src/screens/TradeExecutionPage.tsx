/**
 * Trade Execution Page
 * Shows the hedge shopping cart with execute and abort buttons
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentHedgeSession } from '../api/endpoints';
import type { HedgeSessionWithItems } from '../types/api';
import './TradeExecutionPage.css';

export const TradeExecutionPage = () => {
  const [hedgeSession, setHedgeSession] = useState<HedgeSessionWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = async () => {
    try {
      setLoading(true);
      const session = await getCurrentHedgeSession();
      setHedgeSession(session);
    } catch (err) {
      console.error('Failed to load cart:', err);
      setHedgeSession(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    // TODO: Implement execute API
    alert('Execute trade functionality coming soon');
  };

  const handleAbort = () => {
    // TODO: Implement abort/cancel API
    if (confirm('Are you sure you want to abort this trading session?')) {
      setHedgeSession(null);
      navigate('/value-at-risk');
    }
  };

  if (loading) {
    return (
      <div className="trade-page">
        <div className="loading-state">Loading cart...</div>
      </div>
    );
  }

  const items = hedgeSession?.items || [];
  const totalItems = items.length;

  return (
    <div className="trade-page">
      <header className="page-header">
        <div>
          <h1>Trade Execution</h1>
          <p>Review and execute your hedge portfolio</p>
        </div>
        <div className="header-actions">
          <button onClick={() => navigate('/value-at-risk')} className="btn-secondary">
            ← Back to Analysis
          </button>
        </div>
      </header>

      <div className="trade-content">
        {totalItems === 0 ? (
          <div className="empty-cart">
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛒</div>
            <h2>Your cart is empty</h2>
            <p>Add futures from the Value at Risk page to build your hedge portfolio</p>
            <button onClick={() => navigate('/value-at-risk')} className="btn-primary" style={{ marginTop: '1.5rem' }}>
              Go to Analysis
            </button>
          </div>
        ) : (
          <>
            <div className="cart-section">
              <h2>Hedge Portfolio ({totalItems} {totalItems === 1 ? 'item' : 'items'})</h2>
              
              <div className="cart-items">
                {items.map((item, index) => (
                  <div key={index} className="cart-item">
                    <div className="item-header">
                      <span className="item-commodity" style={{
                        color: item.commodity === 'sugar' ? '#667eea' : '#8b5cf6',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        fontSize: '1.125rem',
                      }}>
                        {item.commodity}
                      </span>
                      <span className="item-quantity">
                        {item.quantity.toLocaleString()} units
                      </span>
                    </div>
                    <div className="item-details">
                      <div className="detail-row">
                        <span className="detail-label">Contract Month:</span>
                        <span className="detail-value">
                          {new Date(item.contract_month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Quantity:</span>
                        <span className="detail-value">{item.quantity.toLocaleString()} units</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="action-section">
              <button onClick={handleAbort} className="btn-abort">
                ✕ Abort Session
              </button>
              <button onClick={handleExecute} className="btn-execute">
                ✓ Execute Trades
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
