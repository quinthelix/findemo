/**
 * Hedge Panel Component
 * Allows user to adjust hedge quantities (shopping cart for futures)
 */
import { useState, useEffect } from 'react';
import { createHedgeSession, addHedgeItem, updateHedgeItem, removeHedgeItem } from '../api/endpoints';
import type { HedgeSessionWithItems, FuturesContract } from '../types/api';
import './HedgePanel.css';

interface Props {
  futures: FuturesContract[];
  hedgeSession: HedgeSessionWithItems | null;
  onUpdate: () => void;
  onProceed: () => void;
}

export const HedgePanel = ({ futures, hedgeSession, onUpdate, onProceed }: Props) => {
  const [selectedCommodity, setSelectedCommodity] = useState<string>('sugar');
  const [selectedContract, setSelectedContract] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  // Get available contracts for selected commodity
  const availableContracts = futures.filter(f => f.commodity === selectedCommodity);

  useEffect(() => {
    if (availableContracts.length > 0 && !selectedContract) {
      setSelectedContract(availableContracts[0].contract_month);
    }
  }, [selectedCommodity, availableContracts, selectedContract]);

  const ensureSession = async (): Promise<boolean> => {
    if (hedgeSession && hedgeSession.status === 'active') {
      return true;
    }

    try {
      await createHedgeSession();
      onUpdate();
      return true;
    } catch (err) {
      console.error('Failed to create hedge session:', err);
      return false;
    }
  };

  const handleAddHedge = async () => {
    if (!selectedContract || quantity <= 0) return;

    setLoading(true);
    try {
      const hasSession = await ensureSession();
      if (!hasSession) return;

      await addHedgeItem({
        commodity: selectedCommodity as any,
        contract_month: selectedContract,
        quantity,
      });

      setQuantity(0);
      onUpdate();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to add hedge');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateQuantity = async (commodity: string, contractMonth: string, newQuantity: number) => {
    setLoading(true);
    try {
      await updateHedgeItem(commodity, contractMonth, newQuantity);
      onUpdate();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update hedge');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (commodity: string, contractMonth: string) => {
    setLoading(true);
    try {
      await removeHedgeItem(commodity, contractMonth);
      onUpdate();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to remove hedge');
    } finally {
      setLoading(false);
    }
  };

  const totalNotional = hedgeSession?.items.reduce(
    (sum, item) => sum + item.quantity * item.price_snapshot,
    0
  ) || 0;

  return (
    <div className="hedge-panel">
      <h2>Hedge Session</h2>
      <p className="panel-subtitle">Adjust quantities to see VaR impact</p>

      <div className="add-hedge-section">
        <h3>Add Hedge</h3>
        
        <div className="form-group">
          <label>Commodity</label>
          <select
            value={selectedCommodity}
            onChange={(e) => setSelectedCommodity(e.target.value)}
            disabled={loading}
          >
            <option value="sugar">Sugar</option>
            <option value="flour">Flour</option>
          </select>
        </div>

        <div className="form-group">
          <label>Contract Month</label>
          <select
            value={selectedContract}
            onChange={(e) => setSelectedContract(e.target.value)}
            disabled={loading}
          >
            {availableContracts.map((contract) => (
              <option key={contract.contract_month} value={contract.contract_month}>
                {new Date(contract.contract_month).toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })} - ${contract.price.toFixed(2)}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Quantity</label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            min="0"
            step="100"
            disabled={loading}
          />
        </div>

        <button
          onClick={handleAddHedge}
          disabled={loading || !selectedContract || quantity <= 0}
          className="btn-add"
        >
          Add to Hedge
        </button>
      </div>

      <div className="current-hedges">
        <h3>Current Positions</h3>
        
        {!hedgeSession || hedgeSession.items.length === 0 ? (
          <p className="no-hedges">No hedge positions</p>
        ) : (
          <>
            <div className="hedge-list">
              {hedgeSession.items.map((item, idx) => (
                <div key={idx} className="hedge-item">
                  <div className="hedge-header">
                    <span className="hedge-commodity">{item.commodity.toUpperCase()}</span>
                    <button
                      onClick={() => handleRemove(item.commodity, item.contract_month)}
                      disabled={loading}
                      className="btn-remove"
                    >
                      ×
                    </button>
                  </div>
                  <div className="hedge-details">
                    <span>{new Date(item.contract_month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                    <span>${item.price_snapshot.toFixed(2)}</span>
                  </div>
                  <div className="hedge-quantity">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleUpdateQuantity(item.commodity, item.contract_month, Number(e.target.value))}
                      min="0"
                      step="100"
                      disabled={loading}
                    />
                    <span className="notional">
                      ${(item.quantity * item.price_snapshot).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="hedge-summary">
              <div className="summary-row">
                <span>Total Positions:</span>
                <strong>{hedgeSession.items.length}</strong>
              </div>
              <div className="summary-row total">
                <span>Total Notional:</span>
                <strong>${totalNotional.toLocaleString()}</strong>
              </div>
            </div>
          </>
        )}
      </div>

      <button
        onClick={onProceed}
        disabled={!hedgeSession || hedgeSession.items.length === 0}
        className="btn-proceed"
      >
        Proceed to Execute
      </button>
    </div>
  );
};
