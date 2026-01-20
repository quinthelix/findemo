/**
 * Market Price Chart Component
 * Shows historical and forward market prices for selected commodity
 * Height: 25% of VaR chart (approx 100px vs 400px)
 */
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { Commodity } from '../types/api';

interface Props {
  commodity: Commodity;
  data: Array<{
    date: string;
    price: number | null;
    isFuture: boolean;
  }>;
  startDate: string;  // Full range start (1 year ago)
  endDate: string;    // Full range end (1 year future)
  hoverDate?: string | null;
  onHoverChange?: (date: string | null) => void;
}

export const MarketPriceChart = ({ commodity, data, startDate, endDate, hoverDate, onHoverChange }: Props) => {
  const formatPrice = (value: number | null) => {
    if (value === null) return 'N/A';
    return `$${value.toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  // Find today's date to draw reference line
  const today = new Date().toISOString().split('T')[0];
  
  // Find the closest date in data to today for the ReferenceLine
  const findClosestDate = () => {
    if (data.length === 0) return today;
    
    const todayDate = new Date(today);
    const allDates = data.map(d => d.date);
    
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

  // Get commodity color
  const commodityColor = commodity === 'sugar' ? '#667eea' : '#8b5cf6';

  // Generate quarterly ticks from the full date range (not just data)
  const generateQuarterlyTicks = () => {
    const ticks: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    let currentDate = new Date(start);
    // Round to start of quarter
    currentDate.setMonth(Math.floor(currentDate.getMonth() / 3) * 3);
    currentDate.setDate(1);
    
    while (currentDate <= end) {
      ticks.push(currentDate.toISOString().split('T')[0]);
      currentDate.setMonth(currentDate.getMonth() + 3);
    }
    
    return ticks;
  };

  const quarterlyTicks = generateQuarterlyTicks();

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
    <div className="market-price-chart">
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '0.5rem'
      }}>
        <h3 style={{ 
          margin: 0, 
          fontSize: '1rem', 
          color: '#ffffff',
          fontWeight: 600
        }}>
          {commodity.charAt(0).toUpperCase() + commodity.slice(1)} Market Price
          <span style={{ 
            marginLeft: '0.75rem', 
            fontSize: '0.875rem', 
            color: 'rgba(255,255,255,0.5)',
            fontWeight: 400
          }}>
            Historical + Forward Prices
          </span>
        </h3>
      </div>
      
      <ResponsiveContainer width="100%" height={100}>
        <LineChart 
          data={data} 
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            style={{ fontSize: '10px', fill: 'rgba(255,255,255,0.6)' }}
            stroke="rgba(255,255,255,0.2)"
            tick={{ fill: 'rgba(255,255,255,0.6)' }}
            ticks={quarterlyTicks}
          />
          <YAxis
            tickFormatter={formatPrice}
            style={{ fontSize: '10px', fill: 'rgba(255,255,255,0.6)' }}
            stroke="rgba(255,255,255,0.2)"
            tick={{ fill: 'rgba(255,255,255,0.6)' }}
            width={45}
          />
          <Tooltip
            formatter={(value: number) => [formatPrice(value), 'Price']}
            labelFormatter={formatDate}
            contentStyle={{
              background: '#1e293b',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '8px',
              padding: '8px',
              fontSize: '12px'
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
              fontSize: 10,
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
          
          {/* Market prices - single solid line (no hedging concept for market data) */}
          <Line
            type="monotone"
            dataKey="price"
            stroke={commodityColor}
            strokeWidth={2}
            dot={false}
            name="Market Price"
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>

      <style>{`
        .market-price-chart {
          width: 100%;
          background: rgba(15, 23, 42, 0.6);
          padding: 1rem;
          border-radius: 12px;
          border: 1px solid rgba(99, 102, 241, 0.2);
        }
      `}</style>
    </div>
  );
};
