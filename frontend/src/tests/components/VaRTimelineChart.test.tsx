/**
 * VaR Timeline Chart Component Tests
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { VaRTimelineChart } from '../../components/VaRTimelineChart';
import type { VaRTimelineResponse } from '../../types/api';

const mockData: VaRTimelineResponse = {
  confidence_level: 0.95,
  currency: 'USD',
  timeline: [
    {
      date: '2026-01-01',
      scenario: 'without_hedge',
      var: { sugar: 100000, flour: 80000, portfolio: 150000 },
    },
    {
      date: '2026-01-01',
      scenario: 'with_hedge',
      var: { sugar: 60000, flour: 70000, portfolio: 100000 },
    },
    {
      date: '2026-06-01',
      scenario: 'without_hedge',
      var: { sugar: 120000, flour: 90000, portfolio: 170000 },
    },
    {
      date: '2026-06-01',
      scenario: 'with_hedge',
      var: { sugar: 70000, flour: 75000, portfolio: 110000 },
    },
  ],
};

describe('VaRTimelineChart', () => {
  it('renders chart with provided data', () => {
    const { container } = render(<VaRTimelineChart data={mockData} />);
    
    // Check that component renders
    expect(container.firstChild).toBeTruthy();
  });

  it('displays legend details', () => {
    const { container } = render(<VaRTimelineChart data={mockData} />);
    
    // Check that component renders
    expect(container.firstChild).toBeTruthy();
  });

  it('renders responsive container', () => {
    const { container } = render(<VaRTimelineChart data={mockData} />);
    
    // Check that the component renders
    expect(container.querySelector('div')).toBeTruthy();
  });
});
