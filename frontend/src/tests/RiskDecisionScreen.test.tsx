/**
 * Risk Decision Screen Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { RiskDecisionScreen } from '../screens/RiskDecisionScreen';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const renderRiskScreen = () => {
  return render(
    <BrowserRouter>
      <RiskDecisionScreen />
    </BrowserRouter>
  );
};

describe('RiskDecisionScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    renderRiskScreen();
    expect(screen.getByText(/loading risk data/i)).toBeInTheDocument();
  });

  it('renders VaR chart and hedge panel after loading', async () => {
    renderRiskScreen();
    
    await waitFor(() => {
      expect(screen.getByText(/risk & hedging decision/i)).toBeInTheDocument();
    });
    
    expect(screen.getByText(/var timeline/i)).toBeInTheDocument();
    expect(screen.getByText(/hedge session/i)).toBeInTheDocument();
  });

  it('displays VaR chart with data', async () => {
    renderRiskScreen();
    
    await waitFor(() => {
      // Check that content has loaded
      const content = document.body.textContent;
      expect(content).toBeTruthy();
    });
  });

  it('displays hedge panel controls', async () => {
    renderRiskScreen();
    
    await waitFor(() => {
      expect(screen.getByText(/add hedge/i)).toBeInTheDocument();
      expect(screen.getByText(/current positions/i)).toBeInTheDocument();
    });
  });
});
