/**
 * Value at Risk (Analysis) Page
 * Large VaR chart + 3 supporting charts + futures sidebar
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPriceProjection, getPriceProjectionWithEvaluations, getFuturesList, getCurrentHedgeSession, createHedgeSession, addHedgeItem } from '../api/endpoints';
import { PriceProjectionChart } from '../components/PriceProjectionChart';
import { MarketPriceChart } from '../components/MarketPriceChart';
import type { PriceProjectionResponse, FutureContract, HedgeSessionWithItems, Commodity } from '../types/api';
import './ValueAtRiskPage.css';

export const ValueAtRiskPage = () => {
  const [priceData, setPriceData] = useState<PriceProjectionResponse | null>(null);
  const [evalPriceData, setEvalPriceData] = useState<PriceProjectionResponse | null>(null);
  const [futures, setFutures] = useState<FutureContract[]>([]);
  const [hedgeSession, setHedgeSession] = useState<HedgeSessionWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCommodities, setSelectedCommodities] = useState<Set<Commodity>>(new Set(['sugar', 'flour']));
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [groupBy, setGroupBy] = useState<'commodity' | 'date'>('commodity');
  const [evaluatedFutures, setEvaluatedFutures] = useState<Array<{
    commodity: string;
    contract_month: string;
    price: number;
    quantity: number;
  }>>([]);
  const [checkedFutures, setCheckedFutures] = useState<Set<string>>(new Set());
  const [cartFutures, setCartFutures] = useState<Set<string>>(new Set());
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
      
      const [priceResponse, futuresResponse] = await Promise.all([
        getPriceProjection({
          start_date: startDate,
          end_date: endDate,
        }),
        getFuturesList(),
      ]);

      setPriceData(priceResponse);
      setFutures(futuresResponse.futures);
      
      // Initialize quantities for each future using suggested_quantity from backend
      const initialQuantities: Record<string, number> = {};
      futuresResponse.futures.forEach(f => {
        initialQuantities[`${f.commodity}-${f.contract_month}-${f.future_type}`] = Math.round(f.suggested_quantity);
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

  const handleCheckboxChange = async (future: FutureContract, checked: boolean) => {
    const key = `${future.commodity}-${future.contract_month}-${future.future_type}`;
    
    const newChecked = new Set(checkedFutures);
    if (checked) {
      newChecked.add(key);
    } else {
      newChecked.delete(key);
    }
    setCheckedFutures(newChecked);
    
    // Rebuild evaluations based on checked futures
    const newEvaluations = futures
      .filter(f => {
        const fKey = `${f.commodity}-${f.contract_month}-${f.future_type}`;
        return newChecked.has(fKey);
      })
      .map(f => {
        const fKey = `${f.commodity}-${f.contract_month}-${f.future_type}`;
        return {
          commodity: f.commodity,
          contract_month: f.contract_month,
          price: f.price,
          quantity: quantities[fKey] || 0,
        };
      });
    
    setEvaluatedFutures(newEvaluations);
    
    // Update chart
    if (newEvaluations.length > 0) {
      const today = new Date();
      const oneYearAgo = new Date(today);
      oneYearAgo.setFullYear(today.getFullYear() - 1);
      const oneYearFuture = new Date(today);
      oneYearFuture.setFullYear(today.getFullYear() + 1);
      
      const startDate = oneYearAgo.toISOString().split('T')[0];
      const endDate = oneYearFuture.toISOString().split('T')[0];
      
      const evalResponse = await getPriceProjectionWithEvaluations({
        start_date: startDate,
        end_date: endDate,
        evaluations: newEvaluations,
      });
      
      setEvalPriceData(evalResponse);
    } else {
      setEvalPriceData(null);
    }
  };

  const handleAddToPortfolio = async (future: FutureContract) => {
    const key = `${future.commodity}-${future.contract_month}-${future.future_type}`;
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

  const handleDrop = async (future: FutureContract) => {
    const key = `${future.commodity}-${future.contract_month}-${future.future_type}`;
    
    // Remove from cart if it's there
    if (cartFutures.has(key)) {
      // TODO: Implement remove from hedge session API
      const newCart = new Set(cartFutures);
      newCart.delete(key);
      setCartFutures(newCart);
    }
    
    // Uncheck if checked
    if (checkedFutures.has(key)) {
      await handleCheckboxChange(future, false);
    }
    
    // Reset quantity to suggested
    const suggestedQty = Math.round(future.suggested_quantity);
    setQuantities({ ...quantities, [key]: suggestedQty });
  };

  const handleQuantityChange = (future: FutureContract, newQty: number) => {
    const key = `${future.commodity}-${future.contract_month}-${future.future_type}`;
    setQuantities({ ...quantities, [key]: Math.max(0, newQty) });
  };

  const renderFuturesTiles = () => {
    if (groupBy === 'commodity') {
      // Group by commodity
      const grouped: { [commodity: string]: FutureContract[] } = {};
      futures.forEach(f => {
        if (!grouped[f.commodity]) grouped[f.commodity] = [];
        grouped[f.commodity].push(f);
      });

      return Object.entries(grouped).map(([commodity, commodityFutures]) => (
        <div key={commodity} style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ 
            color: commodity === 'sugar' ? '#667eea' : '#8b5cf6', 
            fontSize: '1rem', 
            fontWeight: 600, 
            marginBottom: '0.75rem',
            textTransform: 'uppercase'
          }}>
            {commodity}
          </h3>
          {commodityFutures
            .sort((a, b) => new Date(a.contract_month).getTime() - new Date(b.contract_month).getTime())
            .map(future => renderFutureTile(future))}
        </div>
      ));
    } else {
      // Group by date
      const grouped: { [date: string]: FutureContract[] } = {};
      futures.forEach(f => {
        if (!grouped[f.contract_month]) grouped[f.contract_month] = [];
        grouped[f.contract_month].push(f);
      });

      return Object.entries(grouped)
        .sort(([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime())
        .map(([contractMonth, dateFutures]) => (
          <div key={contractMonth} style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ 
              color: '#888', 
              fontSize: '1rem', 
              fontWeight: 600, 
              marginBottom: '0.75rem'
            }}>
              {new Date(contractMonth).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </h3>
            {dateFutures
              .sort((a, b) => a.commodity.localeCompare(b.commodity))
              .map(future => renderFutureTile(future))}
          </div>
        ));
    }
  };

  const renderFutureTile = (future: FutureContract) => {
    const key = `${future.commodity}-${future.contract_month}-${future.future_type}`;
    const qty = quantities[key] || 0;
    const commodityColor = future.commodity === 'sugar' ? '#667eea' : '#8b5cf6';
    const typeColor = future.future_type === 'high' ? '#ef4444' : '#10b981';
    const typeLabel = future.future_type === 'high' ? 'High' : 'Low';

    return (
      <div 
        key={key} 
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${commodityColor}40`,
          borderRadius: '8px',
          padding: '0.75rem',
          marginBottom: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ 
              color: commodityColor, 
              fontWeight: 600, 
              fontSize: '0.875rem',
              textTransform: 'uppercase'
            }}>
              {future.commodity}
            </span>
            <span style={{
              background: typeColor + '20',
              color: typeColor,
              padding: '0.125rem 0.375rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}>
              {typeLabel}
            </span>
          </div>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.875rem' }}>
            ${future.price.toFixed(3)}/lb
          </span>
        </div>
        <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.5rem' }}>
          Due: {new Date(future.contract_month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
          <input
            type="number"
            value={qty}
            onChange={(e) => handleQuantityChange(future, parseInt(e.target.value) || 0)}
            style={{
              flex: 1,
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '4px',
              padding: '0.375rem',
              color: '#fff',
              fontSize: '0.875rem',
            }}
            placeholder="Qty"
            min="0"
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* Checkbox for evaluation */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', minWidth: '70px' }}>
            <input
              type="checkbox"
              checked={checkedFutures.has(key)}
              onChange={(e) => handleCheckboxChange(future, e.target.checked)}
              style={{
                width: '16px',
                height: '16px',
                cursor: 'pointer',
                accentColor: '#3b82f6',
              }}
            />
            <span style={{ fontSize: '0.75rem', color: '#ccc', fontWeight: 600 }}>
              Eval
            </span>
          </label>
          
          {/* Add and Drop buttons */}
          <div style={{ display: 'flex', gap: '0.25rem', flex: 1 }}>
            <button
              onClick={() => handleAddToPortfolio(future)}
              disabled={cartFutures.has(key)}
              style={{
                flex: 1,
                background: cartFutures.has(key) ? 'rgba(16, 185, 129, 0.4)' : 'rgba(16, 185, 129, 0.2)',
                border: `1px solid ${cartFutures.has(key) ? '#10b981' : 'rgba(16, 185, 129, 0.4)'}`,
                borderRadius: '4px',
                padding: '0.375rem',
                color: '#10b981',
                cursor: cartFutures.has(key) ? 'not-allowed' : 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600,
                opacity: cartFutures.has(key) ? 0.7 : 1,
              }}
            >
              {cartFutures.has(key) ? '✓ In Cart' : '+ Add'}
            </button>
            <button
              onClick={() => handleDrop(future)}
              style={{
                flex: 1,
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '4px',
                padding: '0.375rem',
                color: '#ef4444',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              ✕ Drop
            </button>
          </div>
        </div>
      </div>
    );
  };

  const currentVaR = 0; // Placeholder - not using VaR anymore
  const hedgedVaR = 0; // Placeholder - not using VaR anymore

  // Generate market price data (mock data - would come from API in production)
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

  // Removed - marketPriceData generated inline when needed
  
  // Store the date range for chart alignment
  const today = new Date();
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(today.getFullYear() - 1);
  const oneYearFuture = new Date(today);
  oneYearFuture.setFullYear(today.getFullYear() + 1);
  const chartStartDate = oneYearAgo.toISOString().split('T')[0];
  const chartEndDate = oneYearFuture.toISOString().split('T')[0];

  const handleCommodityToggle = (commodity: Commodity) => {
    const newSelected = new Set(selectedCommodities);
    if (newSelected.has(commodity)) {
      newSelected.delete(commodity);
    } else {
      newSelected.add(commodity);
    }
    setSelectedCommodities(newSelected);
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>Total Cost Projection with Uncertainty</h2>
              <div style={{ 
                display: 'flex', 
                gap: '0.5rem', 
                alignItems: 'center',
                background: 'rgba(255,255,255,0.03)',
                padding: '0.5rem',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
              }}>
                <span style={{ fontSize: '0.875rem', color: '#888', fontWeight: 600, marginRight: '0.5rem' }}>Show:</span>
                
                <button
                  onClick={() => handleCommodityToggle('sugar')}
                  style={{
                    background: selectedCommodities.has('sugar') ? 'rgba(102, 126, 234, 0.3)' : 'rgba(255,255,255,0.05)',
                    border: selectedCommodities.has('sugar') ? '2px solid #667eea' : '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '6px',
                    padding: '0.5rem 1rem',
                    color: selectedCommodities.has('sugar') ? '#667eea' : '#888',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    transition: 'all 0.2s ease',
                  }}
                >
                  Sugar
                </button>
                
                <button
                  onClick={() => handleCommodityToggle('flour')}
                  style={{
                    background: selectedCommodities.has('flour') ? 'rgba(139, 92, 246, 0.3)' : 'rgba(255,255,255,0.05)',
                    border: selectedCommodities.has('flour') ? '2px solid #8b5cf6' : '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '6px',
                    padding: '0.5rem 1rem',
                    color: selectedCommodities.has('flour') ? '#8b5cf6' : '#888',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    transition: 'all 0.2s ease',
                  }}
                >
                  Flour
                </button>
              </div>
            </div>
            {priceData && (
            <PriceProjectionChart 
              data={priceData}
              evalData={evalPriceData}
              selectedCommodities={selectedCommodities}
            />
            )}
          </section>

          {selectedCommodities.size > 0 && (
            <section className="market-price-section">
              <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem', fontWeight: 600 }}>Market Prices</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {Array.from(selectedCommodities).map(commodity => (
                  <MarketPriceChart 
                    key={commodity}
                    commodity={commodity} 
                    data={generateMarketPriceData(commodity)}
                    startDate={chartStartDate}
                    endDate={chartEndDate}
                    hoverDate={hoverDate}
                    onHoverChange={handleChartHover}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Commodity VaR Breakdown section removed */}
        </div>

        {/* Right Sidebar - Futures (30% width) */}
        <aside className="var-sidebar">
          <div className="sidebar-header">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h2 style={{ margin: 0 }}>Available Futures</h2>
              {evaluatedFutures.length > 0 && (
                <button
                  onClick={() => {
                    setEvaluatedFutures([]);
                    setEvalPriceData(null);
                  }}
                  style={{
                    padding: '0.375rem 0.75rem',
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: '4px',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  Clear ({evaluatedFutures.length})
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => setGroupBy('commodity')}
                style={{
                  padding: '0.5rem 1rem',
                  background: groupBy === 'commodity' ? 'rgba(102, 126, 234, 0.3)' : 'rgba(255,255,255,0.05)',
                  border: groupBy === 'commodity' ? '1px solid rgba(102, 126, 234, 0.6)' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: groupBy === 'commodity' ? 600 : 400,
                }}
              >
                By Commodity
              </button>
              <button
                onClick={() => setGroupBy('date')}
                style={{
                  padding: '0.5rem 1rem',
                  background: groupBy === 'date' ? 'rgba(102, 126, 234, 0.3)' : 'rgba(255,255,255,0.05)',
                  border: groupBy === 'date' ? '1px solid rgba(102, 126, 234, 0.6)' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: groupBy === 'date' ? 600 : 400,
                }}
              >
                By Date
              </button>
            </div>
          </div>

          <div className="futures-list">
            {renderFuturesTiles()}
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
