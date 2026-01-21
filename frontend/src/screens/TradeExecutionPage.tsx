/**
 * Trade Execution Page
 * Shows the transaction with execute and abort buttons
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentHedgeSession, executeHedge, removeHedgeItem } from '../api/endpoints';
import type { HedgeSessionWithItems, HedgeSessionItem } from '../types/api';
import './TradeExecutionPage.css';

export const TradeExecutionPage = () => {
  const [hedgeSession, setHedgeSession] = useState<HedgeSessionWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadTransaction();
  }, []);

  const loadTransaction = async () => {
    try {
      setLoading(true);
      const session = await getCurrentHedgeSession();
      setHedgeSession(session);
    } catch (err) {
      console.error('Failed to load transaction:', err);
      setHedgeSession(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!hedgeSession || items.length === 0) {
      setNotification({ message: 'Transaction is empty', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    try {
      setLoading(true);
      const result = await executeHedge();
      
      setNotification({ 
        message: `Successfully executed ${items.length} ${items.length === 1 ? 'trade' : 'trades'}`, 
        type: 'success' 
      });
      
      // Clear transaction and go back to analysis after a short delay
      setTimeout(() => {
        setHedgeSession(null);
        navigate('/dashboard/var');
      }, 2000);
    } catch (err: any) {
      setNotification({ 
        message: err.response?.data?.detail || 'Failed to execute trades', 
        type: 'error' 
      });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleAbort = async () => {
    if (!hedgeSession || items.length === 0) {
      navigate('/dashboard/var');
      return;
    }

    try {
      setLoading(true);
      // Remove all items
      for (const item of items) {
        await removeHedgeItem(item.commodity, item.contract_month, item.future_type);
      }
      
      setNotification({ message: 'Transaction aborted', type: 'info' });
      
      setTimeout(() => {
        setHedgeSession(null);
        navigate('/dashboard/var');
      }, 1500);
    } catch (err: any) {
      setNotification({ 
        message: err.response?.data?.detail || 'Failed to abort transaction', 
        type: 'error' 
      });
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveItem = async (item: HedgeSessionItem) => {
    try {
      await removeHedgeItem(item.commodity, item.contract_month, item.future_type);
      await loadTransaction(); // Reload transaction
      
      setNotification({ 
        message: `Removed ${item.commodity.toUpperCase()} ${item.future_type.toUpperCase()}`, 
        type: 'info' 
      });
      setTimeout(() => setNotification(null), 2000);
      
      // Note: The VaR page will sync when user navigates back to it
      console.log('Removed from transaction - VaR page will sync on next visit');
    } catch (err: any) {
      setNotification({ 
        message: err.response?.data?.detail || 'Failed to remove item', 
        type: 'error' 
      });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className="trade-page">
        <div className="loading-state">Loading transaction...</div>
      </div>
    );
  }

  const items = hedgeSession?.items || [];
  const totalItems = items.length;

  return (
    <div className="trade-page">
      {notification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          padding: '1rem 1.5rem',
          borderRadius: '8px',
          background: notification.type === 'success' ? 'rgba(16, 185, 129, 0.9)' :
                     notification.type === 'error' ? 'rgba(239, 68, 68, 0.9)' :
                     'rgba(59, 130, 246, 0.9)',
          color: 'white',
          fontWeight: 600,
          fontSize: '0.875rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
          zIndex: 9999,
          maxWidth: '400px',
        }}>
          {notification.message}
        </div>
      )}
      <header className="page-header">
        <div>
          <h1>Trade Execution</h1>
          <p>Review and execute your hedge transaction</p>
        </div>
        <div className="header-actions">
          <button onClick={() => navigate('/dashboard/var')} className="btn-secondary">
            ← Back to Analysis
          </button>
        </div>
      </header>

      <div className="trade-content">
        {totalItems === 0 ? (
          <div className="empty-cart">
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
            <h2>No items in transaction</h2>
            <p>Add futures from the Value at Risk page to build your hedge transaction</p>
            <button onClick={() => navigate('/dashboard/var')} className="btn-primary" style={{ marginTop: '1.5rem' }}>
              Go to Analysis
            </button>
          </div>
        ) : (
          <>
            <div className="cart-section">
              <h2>Transaction ({totalItems} {totalItems === 1 ? 'item' : 'items'})</h2>
              
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
                        <span className="detail-label">Locks In Price:</span>
                        <span className="detail-value">${item.price_snapshot.toFixed(3)}/lb</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Quantity:</span>
                        <span className="detail-value">{item.quantity.toLocaleString()} lbs</span>
                      </div>
                      <div className="detail-row" style={{ marginTop: '0.25rem' }}>
                        <span className="detail-label" style={{ color: '#fbbf24' }}>Guaranteed Value:</span>
                        <span className="detail-value" style={{ color: '#fbbf24' }}>
                          ${(item.quantity * item.price_snapshot).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <span style={{ fontSize: '0.75rem', marginLeft: '0.5rem', opacity: 0.8 }}>
                            ({item.quantity.toLocaleString()} lbs @ ${item.price_snapshot.toFixed(3)}/lb)
                          </span>
                        </span>
                      </div>
                      <div className="detail-row" style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <span className="detail-label" style={{ fontWeight: 700, color: '#10b981' }}>Contract Cost:</span>
                        <span className="detail-value" style={{ fontWeight: 700, color: '#10b981' }}>
                          ${((item.future_cost || 0) / 100).toFixed(2)}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 600, color: '#fbbf24' }}>Total Guaranteed Value:</div>
                      <div style={{ fontSize: '0.75rem', color: '#fbbf24', opacity: 0.7, marginTop: '0.25rem' }}>
                        {items.reduce((sum, item) => sum + item.quantity, 0).toLocaleString()} lbs total
                      </div>
                    </div>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fbbf24' }}>
                      ${items.reduce((sum, item) => sum + (item.quantity * item.price_snapshot), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '1rem', borderTop: '2px solid rgba(16, 185, 129, 0.3)' }}>
                    <div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>Total Transaction Cost:</div>
                      <div style={{ fontSize: '0.75rem', color: '#10b981', opacity: 0.7, marginTop: '0.25rem' }}>
                        {items.length} {items.length === 1 ? 'contract' : 'contracts'} @ ${((items.reduce((sum, item) => sum + (item.future_cost || 0), 0)) / 100 / items.length).toFixed(2)} avg
                      </div>
                    </div>
                    <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>
                      ${((items.reduce((sum, item) => sum + (item.future_cost || 0), 0)) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
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
