/**
 * Screen 2: Data Load
 * Upload Excel files and trigger market data fetch
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadPurchases, uploadInventory, refreshMarketData } from '../api/endpoints';
import './DataLoadScreen.css';

export const DataLoadScreen = () => {
  const [purchasesFile, setPurchasesFile] = useState<File | null>(null);
  const [inventoryFile, setInventoryFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handlePurchasesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPurchasesFile(e.target.files[0]);
    }
  };

  const handleInventoryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setInventoryFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!purchasesFile || !inventoryFile) {
      setError('Please select both files');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Upload purchases
      await uploadPurchases(purchasesFile);
      
      // Upload inventory
      await uploadInventory(inventoryFile);
      
      // Refresh market data
      await refreshMarketData();

      setSuccess('Data loaded successfully! Proceeding to risk view...');
      setTimeout(() => navigate('/risk'), 1500);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    // Skip to risk view with demo data
    navigate('/risk');
  };

  return (
    <div className="data-load-container">
      <div className="data-load-card">
        <h1>Data Load</h1>
        <p className="subtitle">Upload your exposure data to begin</p>

        <div className="upload-section">
          <div className="upload-group">
            <label htmlFor="purchases">
              <strong>Purchases Excel</strong>
              <span className="file-hint">Historical procurement data</span>
            </label>
            <input
              id="purchases"
              type="file"
              accept=".xlsx,.xls"
              onChange={handlePurchasesUpload}
              disabled={loading}
            />
            {purchasesFile && (
              <div className="file-selected">✓ {purchasesFile.name}</div>
            )}
          </div>

          <div className="upload-group">
            <label htmlFor="inventory">
              <strong>Inventory Excel</strong>
              <span className="file-hint">Current inventory snapshots</span>
            </label>
            <input
              id="inventory"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleInventoryUpload}
              disabled={loading}
            />
            {inventoryFile && (
              <div className="file-selected">✓ {inventoryFile.name}</div>
            )}
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <div className="button-group">
          <button
            onClick={handleSubmit}
            disabled={loading || !purchasesFile || !inventoryFile}
            className="btn-primary"
          >
            {loading ? 'Uploading...' : 'Upload & Continue'}
          </button>
          
          <button
            onClick={handleSkip}
            disabled={loading}
            className="btn-secondary"
          >
            Skip (Use Demo Data)
          </button>
        </div>

        <div className="info-box">
          <h3>Required Format</h3>
          <ul>
            <li>Purchases: commodity, date, quantity, price</li>
            <li>Inventory: commodity, date, quantity</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
