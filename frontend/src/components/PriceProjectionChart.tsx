/**
 * Price Projection Chart
 * Shows 3 lines per commodity:
 * - Baseline price
 * - High future scenario
 * - Low future scenario
 * With shaded uncertainty area between high and low
 */
import React from 'react';
import { Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, ReferenceLine, LabelList } from 'recharts';
import type { PriceProjectionResponse, Commodity } from '../types/api';

interface PriceProjectionChartProps {
  data: PriceProjectionResponse;
  evalData?: PriceProjectionResponse | null;
  selectedCommodities?: Set<Commodity>;
}

export const PriceProjectionChart: React.FC<PriceProjectionChartProps> = ({ data, evalData, selectedCommodities }) => {
  const [showPriceDots, setShowPriceDots] = React.useState(true);
  const [showFutureDots, setShowFutureDots] = React.useState(true);
  const [showEvalHighDots, setShowEvalHighDots] = React.useState(true);
  const [showEvalLowDots, setShowEvalLowDots] = React.useState(true);

  if (!data || !data.projections || data.projections.length === 0) {
    return <div style={{ color: '#ccc', textAlign: 'center', padding: '40px' }}>No price data available</div>;
  }

  // Get today's date for the reference line
  const today = new Date().toISOString().split('T')[0];

  // ALWAYS use normal data for solid lines
  // Evaluations are added separately from evalData
  
  // ALWAYS use normal data for solid lines
  // Evaluations are added separately from evalData

  // Transform data for charting
  // Filter by selected commodities - ALWAYS from normal data for solid lines
  const relevantProjections = selectedCommodities && selectedCommodities.size > 0
    ? data.projections.filter(p => selectedCommodities.has(p.commodity as Commodity))
    : data.projections;

  if (relevantProjections.length === 0) {
    return <div style={{ color: '#ccc', textAlign: 'center', padding: '40px' }}>No data for selected commodity</div>;
  }

  // Build chart data
  // Merge all projections by date
  const dateMap: { [key: string]: any } = {};

  // Build data from normal projections
  relevantProjections.forEach(proj => {
    proj.timeline.forEach(point => {
      if (!dateMap[point.date]) {
        dateMap[point.date] = { date: point.date, is_past: point.is_past };
      }
      
      const commodity = proj.commodity;
      // For future dates, backend returns 0 for price - convert to null for chart
      dateMap[point.date][`${commodity}_price`] = point.price === 0 && !point.is_past ? null : point.price;
      dateMap[point.date][`${commodity}_high`] = point.high_future;
      dateMap[point.date][`${commodity}_low`] = point.low_future;
      dateMap[point.date][`${commodity}_var`] = point.var;
      dateMap[point.date][`${commodity}_is_milestone`] = point.is_milestone;
      dateMap[point.date][`${commodity}_volume`] = point.volume;
      
      // Initialize eval lines for:
      // 1. Past dates (always show)
      // 2. Today (always show - to keep continuity)
      // 3. Future milestone dates (where futures exist: 1M, 3M, 6M, 9M, 12M)
      // Do NOT show for future non-milestone dates (no futures there)
      const isToday = point.date === today;
      
      // ALWAYS use backend-provided eval values when available
      if (point.eval_high !== null && point.eval_high !== undefined) {
        dateMap[point.date][`${commodity}_eval_high`] = point.eval_high;
      } else if (point.is_past || isToday || point.is_milestone) {
        // Fallback: use high_future if backend didn't provide eval value
        dateMap[point.date][`${commodity}_eval_high`] = point.high_future;
      }
      
      if (point.eval_low !== null && point.eval_low !== undefined) {
        dateMap[point.date][`${commodity}_eval_low`] = point.eval_low;
      } else if (point.is_past || isToday || point.is_milestone) {
        // Fallback: use low_future if backend didn't provide eval value
        dateMap[point.date][`${commodity}_eval_low`] = point.low_future;
      }
    });
  });
  
  // Override eval data where evaluations exist
  if (evalData) {
    const evalProjections = selectedCommodities && selectedCommodities.size > 0
      ? evalData.projections.filter(p => selectedCommodities.has(p.commodity as Commodity))
      : evalData.projections;
    
    evalProjections.forEach(proj => {
      proj.timeline.forEach(point => {
        if (dateMap[point.date]) {
          const commodity = proj.commodity;
          // Override with evaluation data where it exists
          if (point.eval_high !== null && point.eval_high !== undefined) {
            dateMap[point.date][`${commodity}_eval_high`] = point.eval_high;
          }
          if (point.eval_low !== null && point.eval_low !== undefined) {
            dateMap[point.date][`${commodity}_eval_low`] = point.eval_low;
          }
        }
      });
    });
  }

  const chartData = Object.values(dateMap).sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  // Debug: Check for misalignment between solid and dashed lines (when no evaluations)
  if (!evalData) {
    const misaligned = chartData.filter(p => {
      const hasSugar = p.sugar_high !== undefined && p.sugar_eval_high !== undefined;
      const hasFlour = p.flour_high !== undefined && p.flour_eval_high !== undefined;
      
      if (hasSugar && p.sugar_high !== p.sugar_eval_high) {
        console.warn(`Misalignment at ${p.date}: sugar_high=${p.sugar_high}, sugar_eval_high=${p.sugar_eval_high}`);
        return true;
      }
      if (hasFlour && p.flour_high !== p.flour_eval_high) {
        console.warn(`Misalignment at ${p.date}: flour_high=${p.flour_high}, flour_eval_high=${p.flour_eval_high}`);
        return true;
      }
      return false;
    });
    
    if (misaligned.length > 0) {
      console.warn(`Found ${misaligned.length} misaligned date(s)`);
    }
  }

  // Calculate Y-axis domain to center the lines
  // Find min and max across all high/low values
  let minValue = Infinity;
  let maxValue = -Infinity;

  chartData.forEach(point => {
    relevantProjections.forEach(proj => {
      const commodity = proj.commodity;
      const high = point[`${commodity}_high`];
      const low = point[`${commodity}_low`];
      
      if (high !== undefined && high !== null) {
        maxValue = Math.max(maxValue, high);
      }
      if (low !== undefined && low !== null) {
        minValue = Math.min(minValue, low);
      }
    });
  });

  // Add 10% padding for better visual centering
  const range = maxValue - minValue;
  const padding = range * 0.1;
  const yAxisDomain = [
    Math.max(0, minValue - padding),  // Don't go below 0
    maxValue + padding
  ];

  // Commodity colors - MATCH MarketPriceChart colors
  const colors: Record<string, string> = {
    sugar: '#667eea',  // Indigo (same as market chart)
    flour: '#8b5cf6',  // Purple (same as market chart)
  };

  // Custom dot shapes - only render if value exists
  const CircleDot = (props: any) => {
    const { cx, cy, fill, payload } = props;
    // Only render if this point has actual data (not null/undefined/0)
    if (!payload || payload[props.dataKey] === null || payload[props.dataKey] === undefined || payload[props.dataKey] === 0) {
      return null;
    }
    return <circle cx={cx} cy={cy} r={5} fill={fill} />;
  };

  const DiamondDot = (props: any) => {
    const { cx, cy, fill, payload } = props;
    if (!payload || payload[props.dataKey] === null || payload[props.dataKey] === undefined || payload[props.dataKey] === 0) {
      return null;
    }
    const size = 6;
    const points = `${cx},${cy - size} ${cx + size},${cy} ${cx},${cy + size} ${cx - size},${cy}`;
    return <polygon points={points} fill={fill} />;
  };

  const TriangleDot = (props: any) => {
    const { cx, cy, fill, payload } = props;
    if (!payload || payload[props.dataKey] === null || payload[props.dataKey] === undefined || payload[props.dataKey] === 0) {
      return null;
    }
    const size = 6;
    const points = `${cx},${cy - size} ${cx + size},${cy + size} ${cx - size},${cy + size}`;
    return <polygon points={points} fill={fill} />;
  };

  const SquareDot = (props: any) => {
    const { cx, cy, fill, payload } = props;
    if (!payload || payload[props.dataKey] === null || payload[props.dataKey] === undefined || payload[props.dataKey] === 0) {
      return null;
    }
    const size = 5;
    return <rect x={cx - size} y={cy - size} width={size * 2} height={size * 2} fill={fill} />;
  };

  // Custom legend - one item per commodity (half solid, half dashed)
  const renderCustomLegend = () => {
    const legendItems = selectedCommodities && selectedCommodities.size > 0 
      ? Array.from(selectedCommodities)
      : ['sugar', 'flour'];
    
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        gap: '2rem',
        padding: '0.5rem 0 1rem 0',
        fontSize: '0.875rem'
      }}>
        {legendItems.map((commodity: string) => {
          const color = colors[commodity];
          const label = commodity.charAt(0).toUpperCase() + commodity.slice(1);
          
          return (
            <div key={commodity} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="40" height="3" style={{ marginTop: '2px' }}>
                <line x1="0" y1="1.5" x2="20" y2="1.5" stroke={color} strokeWidth="2" />
                <line x1="20" y1="1.5" x2="40" y2="1.5" stroke={color} strokeWidth="2" strokeDasharray="4 2" />
              </svg>
              <span style={{ color: '#ccc' }}>{label}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // Custom label component for VaR at milestones
  const renderVarLabel = (props: any, commodity: string) => {
    const { x, y, index, value } = props;
    
    // Strict validation: only render if ALL conditions are met
    if (typeof x !== 'number' || typeof y !== 'number' || !index || index < 0 || index >= chartData.length) {
      return null;
    }
    
    if (value === undefined || value === null || value === 0) {
      return null;
    }
    
    const point = chartData[index];
    if (!point || !point[`${commodity}_is_milestone`]) {
      return null;
    }
    
    const varValue = point[`${commodity}_var`];
    if (varValue === undefined || varValue === null || varValue === 0) {
      return null;
    }
    
    // Format VaR value
    const formatted = varValue >= 1000 
      ? `$${(varValue / 1000).toFixed(1)}K`
      : `$${varValue.toFixed(0)}`;
    
    return (
      <text
        x={x}
        y={y - 15}
        fill={colors[commodity] || '#888'}
        fontSize={10}
        fontWeight={600}
        textAnchor="middle"
      >
        VaR: {formatted}
      </text>
    );
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {renderCustomLegend()}
      <div style={{ marginBottom: '10px', display: 'flex', gap: '10px', alignItems: 'center', fontSize: '12px' }}>
        <span style={{ color: '#999' }}>Data Labels:</span>
        <button
          onClick={() => setShowPriceDots(!showPriceDots)}
          style={{
            padding: '4px 12px',
            background: showPriceDots ? '#667eea' : '#1a1a1a',
            border: showPriceDots ? '2px solid #8b9eff' : '1px solid #444',
            borderRadius: '4px',
            color: showPriceDots ? '#fff' : '#888',
            cursor: 'pointer',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: showPriceDots ? 600 : 400
          }}
        >
          <svg width="12" height="12">
            <circle cx="6" cy="6" r="4" fill={showPriceDots ? '#fff' : '#667eea'} />
          </svg>
          Price
        </button>
        <button
          onClick={() => setShowFutureDots(!showFutureDots)}
          style={{
            padding: '4px 12px',
            background: showFutureDots ? '#667eea' : '#1a1a1a',
            border: showFutureDots ? '2px solid #8b9eff' : '1px solid #444',
            borderRadius: '4px',
            color: showFutureDots ? '#fff' : '#888',
            cursor: 'pointer',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: showFutureDots ? 600 : 400
          }}
        >
          <svg width="12" height="12">
            <polygon points="6,1 11,6 6,11 1,6" fill={showFutureDots ? '#fff' : '#667eea'} />
          </svg>
          Future
        </button>
        <button
          onClick={() => setShowEvalHighDots(!showEvalHighDots)}
          style={{
            padding: '4px 12px',
            background: showEvalHighDots ? '#667eea' : '#1a1a1a',
            border: showEvalHighDots ? '2px solid #8b9eff' : '1px solid #444',
            borderRadius: '4px',
            color: showEvalHighDots ? '#fff' : '#888',
            cursor: 'pointer',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: showEvalHighDots ? 600 : 400
          }}
        >
          <svg width="12" height="12">
            <polygon points="6,1 11,11 1,11" fill={showEvalHighDots ? '#fff' : '#667eea'} />
          </svg>
          Eval High
        </button>
        <button
          onClick={() => setShowEvalLowDots(!showEvalLowDots)}
          style={{
            padding: '4px 12px',
            background: showEvalLowDots ? '#667eea' : '#1a1a1a',
            border: showEvalLowDots ? '2px solid #8b9eff' : '1px solid #444',
            borderRadius: '4px',
            color: showEvalLowDots ? '#fff' : '#888',
            cursor: 'pointer',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: showEvalLowDots ? 600 : 400
          }}
        >
          <svg width="12" height="12">
            <rect x="2" y="2" width="8" height="8" fill={showEvalLowDots ? '#fff' : '#667eea'} />
          </svg>
          Eval Low
        </button>
      </div>
      <div style={{ marginBottom: '15px', color: '#999', fontSize: '14px' }}>
        Past: Actual costs (price × volume) | Future: Projected costs with growing uncertainty
      </div>
      
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 10, bottom: 30 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey="date"
            stroke="#888"
            tick={{ fill: '#888', fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
            tickFormatter={(value) => {
              const date = new Date(value);
              return `${date.getMonth() + 1}/${date.getFullYear()}`;
            }}
          />
          <YAxis
            stroke="#888"
            tick={{ fill: '#888', fontSize: 12 }}
            label={{ value: 'Total Cost ($)', angle: -90, position: 'insideLeft', fill: '#888' }}
            domain={yAxisDomain}
          />
          <Tooltip
            content={(props) => {
              if (!props.active || !props.payload || props.payload.length === 0) {
                return null;
              }

              const point = chartData[props.label as any] || props.payload[0]?.payload;
              if (!point) return null;

              const date = point.date;
              const isPast = point.is_past;

              return (
                <div style={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  padding: '10px',
                  color: '#fff'
                }}>
                  {relevantProjections.map((proj, index) => {
                    const commodity = proj.commodity;
                    const color = colors[commodity] || '#888';
                    const volume = point[`${commodity}_volume`];
                    
                    return (
                      <div key={commodity} style={{ marginTop: index === 0 ? 0 : '8px', paddingTop: index === 0 ? 0 : '8px', borderTop: index === 0 ? 'none' : '1px solid #333' }}>
                        {/* Title: Date and Volume */}
                        <div style={{ fontWeight: 600, marginBottom: '6px', fontSize: '14px' }}>
                          {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {volume !== undefined && (
                            <span style={{ color: '#999', fontWeight: 400, marginLeft: '8px', fontSize: '12px' }}>
                              {volume.toLocaleString(undefined, { maximumFractionDigits: 0 })} units
                            </span>
                          )}
                        </div>
                        
                        {/* Commodity Name */}
                        <div style={{ color, fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', marginBottom: '4px' }}>
                          {commodity}
                        </div>
                        
                        {isPast ? (
                          // HISTORY: Show price (total cost)
                          <div style={{ fontSize: '12px', color: '#ccc' }}>
                            Price: ${point[`${commodity}_price`]?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || 'N/A'}
                          </div>
                        ) : (
                          // FUTURE: Show high/low prices (total costs)
                          <>
                            <div style={{ fontSize: '12px', color: '#ccc' }}>
                              High: ${point[`${commodity}_high`]?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || 'N/A'}
                            </div>
                            <div style={{ fontSize: '12px', color: '#ccc' }}>
                              Low: ${point[`${commodity}_low`]?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || 'N/A'}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            }}
          />

          {/* Today reference line */}
          <ReferenceLine
            x={today}
            stroke="#fff"
            strokeDasharray="5 5"
            strokeWidth={2}
            label={{ value: 'Today', position: 'top', fill: '#fff' }}
          />

          {/* Render lines and areas for each commodity */}
          {relevantProjections.map(proj => {
            const commodity = proj.commodity;
            const color = colors[commodity] || '#888';

            return (
              <React.Fragment key={commodity}>
                {/* Shaded uncertainty area (between high and low) */}
                <Area
                  type="monotone"
                  dataKey={`${commodity}_high`}
                  stroke="none"
                  fill={color}
                  fillOpacity={0.1}
                  isAnimationActive={false}
                  legendType="none"
                />
                <Area
                  type="monotone"
                  dataKey={`${commodity}_low`}
                  stroke="none"
                  fill="#000"
                  fillOpacity={0.3}
                  isAnimationActive={false}
                  legendType="none"
                />

                {/* High future line */}
                <Line
                  type="monotone"
                  dataKey={`${commodity}_high`}
                  stroke={color}
                  strokeWidth={2}
                  dot={showFutureDots ? <DiamondDot fill={color} /> : false}
                  name={`${commodity} (high)`}
                  legendType="none"
                  strokeOpacity={0.7}
                  isAnimationActive={false}
                >
                  <LabelList
                    content={(props) => renderVarLabel(props, commodity)}
                  />
                </Line>

                {/* Baseline price line (only show for past) */}
                <Line
                  type="monotone"
                  dataKey={`${commodity}_price`}
                  stroke={color}
                  strokeWidth={3}
                  dot={showPriceDots ? <CircleDot fill={color} /> : false}
                  name={`${commodity} (price)`}
                  legendType="none"
                  isAnimationActive={false}
                  connectNulls={false}
                />

                {/* Low future line */}
                <Line
                  type="monotone"
                  dataKey={`${commodity}_low`}
                  stroke={color}
                  strokeWidth={2}
                  dot={showFutureDots ? <DiamondDot fill={color} /> : false}
                  name={`${commodity} (low)`}
                  legendType="none"
                  strokeOpacity={0.7}
                  isAnimationActive={false}
                />

                {/* Evaluation lines (dashed) - always present */}
                {/* Eval high future line (dashed) */}
                <Line
                  type="monotone"
                  dataKey={`${commodity}_eval_high`}
                  stroke={color}
                  strokeWidth={2}
                  strokeDasharray="8 4"
                  dot={showEvalHighDots ? <TriangleDot fill={color} /> : false}
                  name={`${commodity} (hedged high)`}
                  legendType="none"
                  strokeOpacity={0.9}
                  isAnimationActive={false}
                  connectNulls={true}
                />

                {/* Eval low future line (dashed) */}
                <Line
                  type="monotone"
                  dataKey={`${commodity}_eval_low`}
                  stroke={color}
                  strokeWidth={2}
                  strokeDasharray="8 4"
                  dot={showEvalLowDots ? <SquareDot fill={color} /> : false}
                  name={`${commodity} (hedged low)`}
                  legendType="none"
                  strokeOpacity={0.9}
                  isAnimationActive={false}
                  connectNulls={true}
                />
              </React.Fragment>
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};
