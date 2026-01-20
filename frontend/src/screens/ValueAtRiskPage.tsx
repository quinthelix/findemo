/**
 * Value at Risk (Analysis) Page
 * Large VaR chart + 3 supporting charts + futures sidebar
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getVaRTimeline, getFuturesContracts, getCurrentHedgeSession, createHedgeSession, addHedgeItem, previewVarImpact } from '../api/endpoints';
import { VaRTimelineChart } from '../components/VaRTimelineChart';
import { MarketPriceChart } from '../components/MarketPriceChart';
import type { VaRTimelineResponse, FuturesContract, HedgeSessionWithItems, Commodity } from '../types/api';
import './ValueAtRiskPage.css';

export const ValueAtRiskPage = () => {
  const [varData, setVarData] = useState<VaRTimelineResponse | null>(null);
  const [futures, setFutures] = useState<FuturesContract[]>([]);
  const [hedgeSession, setHedgeSession] = useState<HedgeSessionWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFuture, setSelectedFuture] = useState<FuturesContract | null>(null);
  const [selectedCommodity, setSelectedCommodity] = useState<Commodity | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [evaluating, setEvaluating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Calculate 1 year history + 1 year future dates
      const today = new Date();
      const oneYearAgo = new Date(today);
      oneYearAgo.setFullYear(today.getFullYear() - 1);
      const oneYearFuture = new Date(today);
      oneYearFuture.setFullYear(today.getFullYear() + 1);
      
      const startDate = oneYearAgo.toISOString().split('T')[0];
      const endDate = oneYearFuture.toISOString().split('T')[0];
      
      const [varResponse, futuresResponse] = await Promise.all([
        getVaRTimeline({
          confidence_level: 0.95,
          start_date: startDate,
          end_date: endDate,
        }),
        getFuturesContracts(),
      ]);

      setVarData(varResponse);
      setFutures(futuresResponse);
      if (futuresResponse.length > 0) {
        setSelectedFuture(futuresResponse[0]);
        // Don't select a commodity by default - wait for user to click
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
      const qty = quantities[`${future.commodity}-${future.contract_month}`] || 0;
      
      // Use preview endpoint (non-mutating per AGENTS.md 10.9)
      const preview = await previewVarImpact({
        commodity: future.commodity,
        contract_month: future.contract_month,
        quantity: qty
      });
      
      // Show preview results
      const deltaPortfolio = preview.delta_var.portfolio;
      const deltaPercent = ((deltaPortfolio / preview.preview_var.portfolio) * 100).toFixed(1);
      alert(
        `VaR Impact Preview:\n\n` +
        `Delta Portfolio VaR: $${deltaPortfolio.toLocaleString()} (${deltaPercent}%)\n` +
        `New Portfolio VaR: $${preview.preview_var.portfolio.toLocaleString()}\n\n` +
        `This is a preview only. Click "Add" to commit.`
      );
      
    } catch (err) {
      console.error('Failed to preview:', err);
      alert('Failed to preview VaR impact');
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
  // const varReduction = currentVaR - hedgedVaR;
  // const varReductionPercent = currentVaR > 0 ? (varReduction / currentVaR) * 100 : 0;

  // Generate market price data (mock data - would come from API in production)
  // CRITICAL: Generate data points for FULL range (including future dates with null prices)
  // This ensures the chart axis spans the same range as VaR chart
  const generateMarketPriceData = (commodity: Commodity) => {
    const today = new Date();
    const data = [];
    
    // Generate data for FULL range: 1 year history + 1 year future
    // Use monthly intervals to match VaR chart backend data
    for (let monthOffset = -12; monthOffset <= 12; monthOffset++) {
      const date = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
      
      // Only generate actual prices for historical data (past and current month)
      if (monthOffset <= 0) {
        // Base prices with some variation
        const basePrice = commodity === 'sugar' ? 0.52 : 0.40;
        const variation = Math.sin(monthOffset * 30 / 30) * 0.05 + (Math.random() * 0.02 - 0.01);
        const price = basePrice + variation;
        
        data.push({
          date: date.toISOString().split('T')[0],
          price: Math.max(0.1, price),
          isFuture: false
        });
      } else {
        // Add placeholder points for future months (price will be null/undefined)
        data.push({
          date: date.toISOString().split('T')[0],
          price: null as any,  // null price for future dates
          isFuture: true
        });
      }
    }
    
    return data;
  };

  const marketPriceData = selectedCommodity ? generateMarketPriceData(selectedCommodity) : [];
  
  // Store the date range for chart alignment
  const today = new Date();
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(today.getFullYear() - 1);
  const oneYearFuture = new Date(today);
  oneYearFuture.setFullYear(today.getFullYear() + 1);
  const chartStartDate = oneYearAgo.toISOString().split('T')[0];
  const chartEndDate = oneYearFuture.toISOString().split('T')[0];

  const handleCommodityClick = (commodity: Commodity) => {
    setSelectedCommodity(commodity);
  };

  const handleChartHover = (date: string | null) => {
    setHoverDate(date);
  };

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
            {varData && (
              <VaRTimelineChart 
                data={varData} 
                onCommoditySelect={handleCommodityClick}
                hoverDate={hoverDate}
                onHoverChange={handleChartHover}
              />
            )}
          </section>

          {selectedCommodity ? (
            <section className="market-price-section">
              <MarketPriceChart 
                commodity={selectedCommodity} 
                data={marketPriceData}
                startDate={chartStartDate}
                endDate={chartEndDate}
                hoverDate={hoverDate}
                onHoverChange={handleChartHover}
              />
            </section>
          ) : (
            <section className="market-price-section">
              <div style={{
                padding: '2rem',
                textAlign: 'center',
                color: 'rgba(255,255,255,0.5)',
                fontSize: '0.9375rem'
              }}>
                Click on a commodity line in the VaR chart above or a VaR box below to view market prices
              </div>
            </section>
          )}

          <section className="supporting-charts">
            <div className="chart-card" style={{gridColumn: '1 / -1'}}>
              <h3>Commodity VaR Breakdown</h3>
              <div style={{display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem'}}>
                <div 
                  style={{
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '1rem', 
                    background: selectedCommodity === 'sugar' ? 'rgba(102, 126, 234, 0.2)' : 'rgba(102, 126, 234, 0.1)', 
                    borderRadius: '8px', 
                    border: selectedCommodity === 'sugar' ? '2px solid rgba(102, 126, 234, 0.6)' : '1px solid rgba(102, 126, 234, 0.3)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => handleCommodityClick('sugar')}
                >
                  <span style={{fontSize: '0.9375rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600}}>
                    Sugar VaR {selectedCommodity === 'sugar' && '◀'}
                  </span>
                  <span style={{fontSize: '1.25rem', color: '#ffffff', fontWeight: 700}}>
                    ${((varData?.timeline[0]?.var.sugar || 0) / 1000).toFixed(0)}K
                  </span>
                </div>
                <div 
                  style={{
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '1rem', 
                    background: selectedCommodity === 'flour' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.1)', 
                    borderRadius: '8px', 
                    border: selectedCommodity === 'flour' ? '2px solid rgba(139, 92, 246, 0.6)' : '1px solid rgba(139, 92, 246, 0.3)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => handleCommodityClick('flour')}
                >
                  <span style={{fontSize: '0.9375rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600}}>
                    Flour VaR {selectedCommodity === 'flour' && '◀'}
                  </span>
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
                    ${future.price.toFixed(2)}/{future.contract_unit_label}
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
