/**
 * Price Projection Chart
 * Shows 3 lines per commodity:
 * - Baseline price
 * - High future scenario
 * - Low future scenario
 * With shaded uncertainty area between high and low
 */
import React from 'react';
import { Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, ReferenceLine } from 'recharts';
import type { PriceProjectionResponse, Commodity } from '../types/api';

interface PriceProjectionChartProps {
  data: PriceProjectionResponse;
  selectedCommodities?: Set<Commodity>;
}

export const PriceProjectionChart: React.FC<PriceProjectionChartProps> = ({ data, selectedCommodities }) => {
  if (!data || !data.projections || data.projections.length === 0) {
    return <div style={{ color: '#ccc', textAlign: 'center', padding: '40px' }}>No price data available</div>;
  }

  // Get today's date for the reference line
  const today = new Date().toISOString().split('T')[0];

  // Transform data for charting
  // Filter by selected commodities
  const relevantProjections = selectedCommodities && selectedCommodities.size > 0
    ? data.projections.filter(p => selectedCommodities.has(p.commodity as Commodity))
    : data.projections;

  if (relevantProjections.length === 0) {
    return <div style={{ color: '#ccc', textAlign: 'center', padding: '40px' }}>No data for selected commodity</div>;
  }

  // Build chart data
  // Merge all projections by date
  const dateMap: { [key: string]: any } = {};

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
    });
  });

  const chartData = Object.values(dateMap).sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

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
  const colors = {
    sugar: '#667eea',  // Indigo (same as market chart)
    flour: '#8b5cf6',  // Purple (same as market chart)
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div style={{ marginBottom: '10px', color: '#ccc', fontSize: '18px', fontWeight: 600 }}>
        Total Cost Projection with Uncertainty Bands
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
            contentStyle={{
              backgroundColor: '#1a1a1a',
              border: '1px solid #444',
              borderRadius: '4px',
              color: '#fff'
            }}
            labelStyle={{ color: '#fff' }}
          />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
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
                />
                <Area
                  type="monotone"
                  dataKey={`${commodity}_low`}
                  stroke="none"
                  fill="#000"
                  fillOpacity={0.3}
                  isAnimationActive={false}
                />

                {/* High future line */}
                <Line
                  type="monotone"
                  dataKey={`${commodity}_high`}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  name={`${commodity} (high)`}
                  strokeOpacity={0.7}
                  isAnimationActive={false}
                />

                {/* Baseline price line (only show for past) */}
                <Line
                  type="monotone"
                  dataKey={`${commodity}_price`}
                  stroke={color}
                  strokeWidth={3}
                  dot={false}
                  name={`${commodity} (price)`}
                  isAnimationActive={false}
                  connectNulls={false}
                />

                {/* Low future line */}
                <Line
                  type="monotone"
                  dataKey={`${commodity}_low`}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  name={`${commodity} (low)`}
                  strokeOpacity={0.7}
                  isAnimationActive={false}
                />
              </React.Fragment>
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};
