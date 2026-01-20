/**
 * Screen 3: Risk & Decision (Main Screen)
 * Large VaR timeline chart + hedge session panel
 * Updates in real time as hedge quantities change
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { VaRTimelineChart } from '../components/VaRTimelineChart';
import { HedgePanel } from '../components/HedgePanel';
import { getVaRTimeline, getCurrentHedgeSession, getFuturesContracts } from '../api/endpoints';
import type { VaRTimelineResponse, HedgeSessionWithItems, FuturesContract } from '../types/api';
import './RiskDecisionScreen.css';

export const RiskDecisionScreen = () => {
  const [varData, setVarData] = useState<VaRTimelineResponse | null>(null);
  const [hedgeSession, setHedgeSession] = useState<HedgeSessionWithItems | null>(null);
  const [futures, setFutures] = useState<FuturesContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

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

      // Try to get current hedge session (may not exist)
      try {
        const sessionResponse = await getCurrentHedgeSession();
        setHedgeSession(sessionResponse);
      } catch {
        // No active session, that's ok
        setHedgeSession(null);
      }

      setError('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleHedgeUpdate = async () => {
    // Reload VaR data after hedge changes
    try {
      const varResponse = await getVaRTimeline({
        confidence_level: 0.95,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
      });
      setVarData(varResponse);

      const sessionResponse = await getCurrentHedgeSession();
      setHedgeSession(sessionResponse);
    } catch (err: any) {
      console.error('Failed to update VaR:', err);
    }
  };

  const handleProceedToExecute = () => {
    navigate('/execute');
  };

  if (loading) {
    return (
      <div className="risk-container">
        <div className="loading-state">Loading risk data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="risk-container">
        <div className="error-state">{error}</div>
      </div>
    );
  }

  return (
    <div className="risk-container">
      <header className="risk-header">
        <h1>Risk & Hedging Decision</h1>
        <p>95% Confidence VaR | Adjust hedge quantities to see impact</p>
      </header>

      <div className="risk-content">
        <section className="var-section">
          <h2>VaR Timeline</h2>
          {varData && <VaRTimelineChart data={varData} />}
        </section>

        <aside className="hedge-section">
          <HedgePanel
            futures={futures}
            hedgeSession={hedgeSession}
            onUpdate={handleHedgeUpdate}
            onProceed={handleProceedToExecute}
          />
        </aside>
      </div>
    </div>
  );
};
