/**
 * VaR Timeline Chart Component
 * Shows historic and forward VaR with/without hedge scenarios
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
} from 'recharts';
import type { VaRTimelineResponse } from '../types/api';

interface Props {
  data: VaRTimelineResponse;
}

export const VaRTimelineChart = ({ data }: Props) => {
  // Transform data for Recharts
  const chartData = data.timeline.reduce((acc, point) => {
    const existing = acc.find((item) => item.date === point.date);
    
    if (existing) {
      if (point.scenario === 'without_hedge') {
        existing.withoutHedge = point.var.portfolio;
      } else {
        existing.withHedge = point.var.portfolio;
      }
    } else {
      acc.push({
        date: point.date,
        withoutHedge: point.scenario === 'without_hedge' ? point.var.portfolio : undefined,
        withHedge: point.scenario === 'with_hedge' ? point.var.portfolio : undefined,
      });
    }
    
    return acc;
  }, [] as Array<{ date: string; withoutHedge?: number; withHedge?: number }>);

  // Sort by date
  chartData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const formatValue = (value: number) => {
    return `$${(value / 1000).toFixed(0)}K`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  return (
    <div className="var-chart">
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            style={{ fontSize: '12px' }}
          />
          <YAxis
            tickFormatter={formatValue}
            style={{ fontSize: '12px' }}
          />
          <Tooltip
            formatter={(value: number) => formatValue(value)}
            labelFormatter={formatDate}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="withoutHedge"
            stroke="#ff6b6b"
            strokeWidth={2}
            name="Without Hedge"
            dot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="withHedge"
            stroke="#51cf66"
            strokeWidth={2}
            name="With Hedge"
            dot={{ r: 4 }}
            strokeDasharray="5 5"
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="var-legend-details">
        <div className="legend-item">
          <span className="legend-color without-hedge"></span>
          <span>Without Hedge - Current Exposure</span>
        </div>
        <div className="legend-item">
          <span className="legend-color with-hedge"></span>
          <span>With Hedge - Reduced Risk</span>
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
          background: #f5f7fa;
          border-radius: 6px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: #666;
        }

        .legend-color {
          width: 32px;
          height: 4px;
          border-radius: 2px;
        }

        .legend-color.without-hedge {
          background: #ff6b6b;
        }

        .legend-color.with-hedge {
          background: #51cf66;
        }
      `}</style>
    </div>
  );
};
