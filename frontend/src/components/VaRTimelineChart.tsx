/**
 * VaR Timeline Chart Component
 * Shows historic and forward VaR with/without hedge scenarios
 * Each commodity has its own color, dashed=with hedge, solid=without hedge
 * Lines are clickable to select commodity for market price chart
 */
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { VaRTimelineResponse } from '../types/api';
import type { Commodity } from '../types/api';

interface Props {
  data: VaRTimelineResponse;
  onCommoditySelect?: (commodity: Commodity) => void;
  hoverDate?: string | null;
  onHoverChange?: (date: string | null) => void;
}

export const VaRTimelineChart = ({ data, onCommoditySelect, hoverDate, onHoverChange }: Props) => {
  const handleLineClick = (commodity: Commodity) => {
    if (onCommoditySelect) {
      onCommoditySelect(commodity);
    }
  };
  // Transform data for Recharts - now with commodity-specific lines
  const chartData = data.timeline.reduce((acc, point) => {
    const existing = acc.find((item) => item.date === point.date);
    
    if (existing) {
      if (point.scenario === 'without_hedge') {
        existing.portfolioWithout = point.var.portfolio;
        existing.sugarWithout = point.var.sugar;
        existing.flourWithout = point.var.flour;
      } else {
        existing.portfolioWith = point.var.portfolio;
        existing.sugarWith = point.var.sugar;
        existing.flourWith = point.var.flour;
      }
    } else {
      const newPoint: any = { date: point.date };
      if (point.scenario === 'without_hedge') {
        newPoint.portfolioWithout = point.var.portfolio;
        newPoint.sugarWithout = point.var.sugar;
        newPoint.flourWithout = point.var.flour;
      } else {
        newPoint.portfolioWith = point.var.portfolio;
        newPoint.sugarWith = point.var.sugar;
        newPoint.flourWith = point.var.flour;
      }
      acc.push(newPoint);
    }
    
    return acc;
  }, [] as Array<any>);

  // Sort by date
  chartData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const formatValue = (value: number) => {
    return `$${(value / 1000).toFixed(0)}K`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  // Get today's date for reference line
  const today = new Date().toISOString().split('T')[0];
  
  // Find the closest date in chartData to today for the ReferenceLine
  const findClosestDate = () => {
    if (chartData.length === 0) return today;
    
    const todayDate = new Date(today);
    const allDates = chartData.map(d => d.date);
    
    // Find the date in data that's closest to today
    let closestDate = allDates[0];
    let minDiff = Math.abs(new Date(allDates[0]).getTime() - todayDate.getTime());
    
    for (const date of allDates) {
      const diff = Math.abs(new Date(date).getTime() - todayDate.getTime());
      if (diff < minDiff) {
        minDiff = diff;
        closestDate = date;
      }
    }
    
    return closestDate;
  };
  
  const todayInData = findClosestDate();
  
  // Generate quarterly ticks from actual data points
  const getQuarterlyTicks = () => {
    if (chartData.length === 0) return undefined;
    
    // Get all unique dates from data
    const allDates = chartData.map(d => d.date);
    
    // Filter to first day of each quarter (or closest available)
    const quarterlyDates = allDates.filter((date, index) => {
      const d = new Date(date);
      const month = d.getMonth();
      // Keep if it's a quarter start month (0=Jan, 3=Apr, 6=Jul, 9=Oct)
      return month % 3 === 0 || index === 0 || index === allDates.length - 1;
    });
    
    return quarterlyDates;
  };

  const quarterlyTicks = getQuarterlyTicks();

  const handleMouseMove = (state: any) => {
    if (state && state.activeLabel && onHoverChange) {
      onHoverChange(state.activeLabel);
    }
  };

  const handleMouseLeave = () => {
    if (onHoverChange) {
      onHoverChange(null);
    }
  };

  return (
    <div className="var-chart">
      <ResponsiveContainer width="100%" height={400}>
        <LineChart 
          data={chartData} 
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            style={{ fontSize: '12px', fill: 'rgba(255,255,255,0.8)' }}
            ticks={quarterlyTicks}
            interval="preserveStartEnd"
            stroke="rgba(255,255,255,0.2)"
            tick={{ fill: 'rgba(255,255,255,0.8)' }}
          />
          <YAxis
            tickFormatter={formatValue}
            style={{ fontSize: '12px', fill: 'rgba(255,255,255,0.8)' }}
            stroke="rgba(255,255,255,0.2)"
          />
          <Tooltip
            formatter={(value: number) => formatValue(value)}
            labelFormatter={formatDate}
            contentStyle={{
              background: '#1e293b',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '8px',
              color: '#ffffff'
            }}
          />
          
          {/* Vertical line for "today" - white dashed */}
          <ReferenceLine 
            x={todayInData} 
            stroke="rgba(255, 255, 255, 0.6)" 
            strokeDasharray="5 5"
            strokeWidth={2}
            label={{ 
              value: 'Today', 
              position: 'top',
              fill: 'rgba(255,255,255,0.8)',
              fontSize: 11,
              fontWeight: 600
            }}
          />
          
          {/* Synchronized hover line */}
          {hoverDate && (
            <ReferenceLine 
              x={hoverDate} 
              stroke="rgba(99, 102, 241, 0.8)" 
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}
          
          {/* Portfolio VaR - Red (without) / Green (with) */}
          <Line
            type="monotone"
            dataKey="portfolioWithout"
            stroke="#ff6b6b"
            strokeWidth={3}
            name="Portfolio (No Hedge)"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="portfolioWith"
            stroke="#51cf66"
            strokeWidth={3}
            strokeDasharray="5 5"
            name="Portfolio (Hedged)"
            dot={false}
          />
          
          {/* Sugar VaR - Blue - Clickable */}
          <Line
            type="monotone"
            dataKey="sugarWithout"
            stroke="#667eea"
            strokeWidth={2}
            name="Sugar (No Hedge)"
            dot={false}
            onClick={() => handleLineClick('sugar')}
            style={{ cursor: 'pointer' }}
          />
          <Line
            type="monotone"
            dataKey="sugarWith"
            stroke="#667eea"
            strokeWidth={2}
            strokeDasharray="5 5"
            name="Sugar (Hedged)"
            dot={false}
            onClick={() => handleLineClick('sugar')}
            style={{ cursor: 'pointer' }}
          />
          
          {/* Flour VaR - Purple - Clickable */}
          <Line
            type="monotone"
            dataKey="flourWithout"
            stroke="#8b5cf6"
            strokeWidth={2}
            name="Flour (No Hedge)"
            dot={false}
            onClick={() => handleLineClick('flour')}
            style={{ cursor: 'pointer' }}
          />
          <Line
            type="monotone"
            dataKey="flourWith"
            stroke="#8b5cf6"
            strokeWidth={2}
            strokeDasharray="5 5"
            name="Flour (Hedged)"
            dot={false}
            onClick={() => handleLineClick('flour')}
            style={{ cursor: 'pointer' }}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="var-legend-details">
        <div className="legend-item">
          <span className="legend-color portfolio"></span>
          <span>Portfolio VaR (Red/Green)</span>
        </div>
        <div className="legend-item">
          <span className="legend-color sugar"></span>
          <span>Sugar VaR (Blue)</span>
        </div>
        <div className="legend-item">
          <span className="legend-color flour"></span>
          <span>Flour VaR (Purple)</span>
        </div>
      </div>

      <style>{`
        .var-chart {
          width: 100%;
        }

        .var-legend-details {
          display: flex;
          gap: 2rem;
          margin-top: 1rem;
          padding: 1rem;
          background: rgba(30, 41, 59, 0.5);
          border-radius: 6px;
          border: 1px solid rgba(99, 102, 241, 0.2);
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.8);
        }

        .legend-color {
          width: 32px;
          height: 4px;
          border-radius: 2px;
          position: relative;
          display: flex;
        }

        .legend-color.portfolio {
          background: linear-gradient(to right, #ff6b6b 50%, #51cf66 50%);
        }

        .legend-color.sugar {
          background: #667eea;
        }

        .legend-color.sugar::after {
          content: '';
          position: absolute;
          right: 0;
          top: 0;
          width: 50%;
          height: 100%;
          background: repeating-linear-gradient(
            90deg,
            #0f172a 0px,
            #0f172a 2px,
            #667eea 2px,
            #667eea 4px
          );
        }

        .legend-color.flour {
          background: #8b5cf6;
        }

        .legend-color.flour::after {
          content: '';
          position: absolute;
          right: 0;
          top: 0;
          width: 50%;
          height: 100%;
          background: repeating-linear-gradient(
            90deg,
            #0f172a 0px,
            #0f172a 2px,
            #8b5cf6 2px,
            #8b5cf6 4px
          );
        }
      `}</style>
    </div>
  );
};
