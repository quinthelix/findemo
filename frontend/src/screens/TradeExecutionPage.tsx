/**
 * Trade Execution Page
 * Shows the hedge shopping cart with execute and abort buttons
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentHedgeSession, executeHedge, removeHedgeItem } from '../api/endpoints';
import type { HedgeSessionWithItems, HedgeSessionItem } from '../types/api';
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
    if (!hedgeSession || items.length === 0) {
      alert('Cart is empty');
      return;
    }

    if (!confirm(`Execute ${items.length} hedge ${items.length === 1 ? 'trade' : 'trades'}? This action is final and cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      const result = await executeHedge();
      
      alert(`Successfully executed ${items.length} trades!\n\nStatus: ${result.status}\nExecuted at: ${new Date(result.executed_at).toLocaleString()}`);
      
      // Clear cart and go back to analysis
      setHedgeSession(null);
      navigate('/dashboard/var');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to execute trades');
    } finally {
      setLoading(false);
    }
  };

  const handleAbort = async () => {
    if (!hedgeSession || items.length === 0) {
      navigate('/dashboard/var');
      return;
    }

    if (!confirm(`Abort trading session? This will remove all ${items.length} items from your cart.`)) {
      return;
    }

    try {
      setLoading(true);
      // Remove all items
      for (const item of items) {
        await removeHedgeItem(item.commodity, item.contract_month, item.future_type);
      }
      
      setHedgeSession(null);
      navigate('/dashboard/var');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to abort session');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveItem = async (item: HedgeSessionItem) => {
    if (!confirm(`Remove ${item.commodity.toUpperCase()} ${item.future_type.toUpperCase()} ${new Date(item.contract_month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} from cart?`)) {
      return;
    }

    try {
      await removeHedgeItem(item.commodity, item.contract_month, item.future_type);
      await loadCart(); // Reload cart
      
      // Note: The VaR page will sync when user navigates back to it
      console.log('Removed from cart - VaR page will sync on next visit');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to remove item');
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
                        {item.commodity} {item.future_type}
                      </span>
                      <button
                        onClick={() => handleRemoveItem(item)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.2)',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          borderRadius: '4px',
                          padding: '0.25rem 0.75rem',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                        }}
                      >
                        ✕ Remove
                      </button>
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
                      <div className="detail-row">
                        <span className="detail-label">Price Snapshot:</span>
                        <span className="detail-value">${item.price_snapshot.toFixed(2)}/unit</span>
                      </div>
                      <div className="detail-row" style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <span className="detail-label" style={{ fontWeight: 700 }}>Total Value:</span>
                        <span className="detail-value" style={{ fontWeight: 700, color: '#10b981' }}>
                          ${(item.quantity * item.price_snapshot).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Total Summary */}
              <div className="cart-summary" style={{
                marginTop: '2rem',
                padding: '1.5rem',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '2px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '8px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>Total Portfolio Value:</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>
                    ${items.reduce((sum, item) => sum + (item.quantity * item.price_snapshot), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
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
