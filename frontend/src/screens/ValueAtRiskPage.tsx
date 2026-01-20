/**
 * Value at Risk (Analysis) Page
 * Large VaR chart + 3 supporting charts + futures sidebar
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getVaRTimeline, getFuturesContracts, getCurrentHedgeSession, createHedgeSession, addHedgeItem } from '../api/endpoints';
import { VaRTimelineChart } from '../components/VaRTimelineChart';
import type { VaRTimelineResponse, FuturesContract, HedgeSessionWithItems, Commodity } from '../types/api';
import './ValueAtRiskPage.css';

export const ValueAtRiskPage = () => {
  const [varData, setVarData] = useState<VaRTimelineResponse | null>(null);
  const [futures, setFutures] = useState<FuturesContract[]>([]);
  const [hedgeSession, setHedgeSession] = useState<HedgeSessionWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFuture, setSelectedFuture] = useState<FuturesContract | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [evaluating, setEvaluating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [varResponse, futuresResponse] = await Promise.all([
        getVaRTimeline({
          confidence_level: 0.95,
          start_date: '2026-01-01',
          end_date: '2026-12-31',
        }),
        getFuturesContracts(),
      ]);

      setVarData(varResponse);
      setFutures(futuresResponse);
      if (futuresResponse.length > 0) {
        setSelectedFuture(futuresResponse[0]);
      }
      
      // Initialize quantities for each future
      const initialQuantities: Record<string, number> = {};
      futuresResponse.forEach(f => {
        initialQuantities[`${f.commodity}-${f.contract_month}`] = 1000;
      });
      setQuantities(initialQuantities);

      try {
        const session = await getCurrentHedgeSession();
        setHedgeSession(session);
      } catch {
        setHedgeSession(null);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluate = async (future: FuturesContract) => {
    setEvaluating(true);
    try {
      const varResponse = await getVaRTimeline({
        confidence_level: 0.95,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
      });
      setVarData(varResponse);
      alert(`Evaluated impact for ${future.commodity.toUpperCase()}`);
    } catch (err) {
      console.error('Failed to evaluate:', err);
    } finally {
      setEvaluating(false);
    }
  };

  const handleAddToPortfolio = async (future: FuturesContract) => {
    const key = `${future.commodity}-${future.contract_month}`;
    const qty = quantities[key] || 0;
    
    if (qty === 0) {
      alert('Quantity cannot be zero');
      return;
    }

    try {
      if (!hedgeSession) {
        await createHedgeSession();
      }

      await addHedgeItem({
        commodity: future.commodity as Commodity,
        contract_month: future.contract_month,
        quantity: qty,
      });

      const session = await getCurrentHedgeSession();
      setHedgeSession(session);
      
      alert(`Added ${qty} ${future.commodity.toUpperCase()} to portfolio!`);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to add to portfolio');
    }
  };

  const handleDrop = (future: FuturesContract) => {
    const key = `${future.commodity}-${future.contract_month}`;
    setQuantities({ ...quantities, [key]: 0 });
  };

  const handleQuantityChange = (future: FuturesContract, newQty: number) => {
    const key = `${future.commodity}-${future.contract_month}`;
    setQuantities({ ...quantities, [key]: Math.max(0, newQty) });
  };

  const currentVaR = varData?.timeline.find(t => t.scenario === 'without_hedge')?.var.portfolio || 0;
  const hedgedVaR = varData?.timeline.find(t => t.scenario === 'with_hedge')?.var.portfolio || 0;
  const varReduction = currentVaR - hedgedVaR;
  const varReductionPercent = currentVaR > 0 ? (varReduction / currentVaR) * 100 : 0;

  if (loading) {
    return (
      <div className="var-page">
        <div className="loading-state">Loading analysis...</div>
      </div>
    );
  }

  return (
    <div className="var-page">
      <header className="page-header">
        <div>
          <h1>Value at Risk Analysis</h1>
          <p>95% Confidence Level | 12-Month Horizon</p>
        </div>
        <div className="var-metrics">
          <div className="metric-card" style={{minWidth: '220px'}}>
            <span className="metric-label">Portfolio VaR</span>
            <span className="metric-value">${(currentVaR / 1000).toFixed(0)}K</span>
            <div style={{fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)', marginTop: '0.5rem'}}>
              With Hedge: ${(hedgedVaR / 1000).toFixed(0)}K
            </div>
          </div>
        </div>
      </header>

      <div className="var-content">
        <div className="charts-area">
          <section className="main-chart-section">
            <h2>Portfolio VaR Timeline</h2>
            {varData && <VaRTimelineChart data={varData} />}
          </section>

          <section className="supporting-charts">
            <div className="chart-card" style={{gridColumn: '1 / -1'}}>
              <h3>Commodity VaR Breakdown</h3>
              <div style={{display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(102, 126, 234, 0.1)', borderRadius: '8px', border: '1px solid rgba(102, 126, 234, 0.3)'}}>
                  <span style={{fontSize: '0.9375rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600}}>Sugar VaR</span>
                  <span style={{fontSize: '1.25rem', color: '#ffffff', fontWeight: 700}}>
                    ${((varData?.timeline[0]?.var.sugar || 0) / 1000).toFixed(0)}K
                  </span>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.3)'}}>
                  <span style={{fontSize: '0.9375rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600}}>Flour VaR</span>
                  <span style={{fontSize: '1.25rem', color: '#ffffff', fontWeight: 700}}>
                    ${((varData?.timeline[0]?.var.flour || 0) / 1000).toFixed(0)}K
                  </span>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px'}}>
                  <span style={{fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)'}}>Correlation (Sugar-Flour)</span>
                  <span style={{fontSize: '0.9375rem', color: '#ffffff', fontWeight: 600}}>0.65</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="futures-sidebar">
          <h2>Available Futures</h2>
          
          <div className="futures-list">
            {futures.map((future, idx) => {
              const key = `${future.commodity}-${future.contract_month}`;
              const qty = quantities[key] || 1000;
              
              return (
                <div
                  key={idx}
                  className={`future-item ${selectedFuture === future ? 'selected' : ''}`}
                >
                <div className="future-header">
                  <span className="future-commodity">{future.commodity.toUpperCase()}</span>
                  <span className="future-price">
                    ${future.price.toFixed(2)}/{future.commodity === 'sugar' ? '50k lbs' : '100k lbs'}
                  </span>
                </div>

                <div className="future-meta-row">
                  <div className="future-date">
                    <span className="meta-label">Expires:</span>
                    <span className="meta-value">
                      {new Date(future.contract_month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="future-quantity-inline">
                    <span className="meta-label">Qty:</span>
                    <input
                      type="number"
                      value={qty}
                      onChange={(e) => handleQuantityChange(future, Number(e.target.value))}
                      min="0"
                      step="100"
                      onClick={(e) => e.stopPropagation()}
                      className="quantity-input-inline"
                    />
                  </div>
                </div>

                <div className="future-notional">
                  Notional: ${(qty * future.price).toLocaleString()}
                </div>

                  <div className="future-item-buttons">
                    <button
                      className="future-btn future-btn-evaluate"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEvaluate(future);
                      }}
                      disabled={evaluating}
                    >
                      <span className="future-btn-icon">⚡</span>
                      {evaluating ? 'Eval...' : 'Eval'}
                    </button>
                    <button
                      className="future-btn future-btn-add"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToPortfolio(future);
                      }}
                    >
                      <span className="future-btn-icon">✓</span>
                      Add
                    </button>
                    <button
                      className="future-btn future-btn-drop"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDrop(future);
                      }}
                    >
                      <span className="future-btn-icon">✕</span>
                      Drop
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            className="go-to-trade-btn"
            onClick={() => navigate('/dashboard/execution')}
          >
            Go to Trade Execution
            {hedgeSession && hedgeSession.items.length > 0 && (
              <span style={{marginLeft: '0.5rem', fontSize: '0.875rem'}}>
                ({hedgeSession.items.length})
              </span>
            )}
          </button>
        </aside>
      </div>
    </div>
  );
};
