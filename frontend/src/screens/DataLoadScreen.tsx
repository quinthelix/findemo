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
    <div className="data-load-page">
      <div className="page-header">
        <h1>Data Upload</h1>
        <p>Upload your exposure data and inventory to begin risk analysis</p>
      </div>

      <div className="uploads-container">
        <div className="upload-section">
          <h2><span className="section-icon">▦</span> Historic Purchases</h2>
          <div className="upload-zone">
            <div className="upload-icon">⇪</div>
            <p className="primary-text">Drop file or click</p>
            <p>Excel (.xlsx, .xls)</p>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handlePurchasesUpload}
              disabled={loading}
              style={{ display: 'none' }}
              id="purchases-input"
            />
            <label htmlFor="purchases-input" style={{ display: 'block', cursor: 'pointer' }}>
              <span style={{ opacity: 0 }}>Click to upload</span>
            </label>
          </div>
          {purchasesFile && (
            <div className="file-info">
              <div>
                <div className="file-name"><span className="file-check">✓</span> {purchasesFile.name}</div>
                <div className="file-size">{(purchasesFile.size / 1024).toFixed(2)} KB</div>
              </div>
              <button className="btn-remove" onClick={() => setPurchasesFile(null)}>×</button>
            </div>
          )}
          {purchasesFile && (
            <button className="btn-upload" onClick={async () => {
              try {
                await uploadPurchases(purchasesFile);
                setSuccess('Purchases uploaded successfully!');
              } catch (err: any) {
                setError(err.response?.data?.detail || 'Upload failed');
              }
            }}>
              Upload Purchases
            </button>
          )}
        </div>

        <div className="upload-section">
          <h2><span className="section-icon">▥</span> Inventory Data</h2>
          <div className="upload-zone">
            <div className="upload-icon">⇪</div>
            <p className="primary-text">Drop file or click</p>
            <p>Excel (.xlsx, .xls)</p>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleInventoryUpload}
              disabled={loading}
              style={{ display: 'none' }}
              id="inventory-input"
            />
            <label htmlFor="inventory-input" style={{ display: 'block', cursor: 'pointer' }}>
              <span style={{ opacity: 0 }}>Click to upload</span>
            </label>
          </div>
          {inventoryFile && (
            <div className="file-info">
              <div>
                <div className="file-name"><span className="file-check">✓</span> {inventoryFile.name}</div>
                <div className="file-size">{(inventoryFile.size / 1024).toFixed(2)} KB</div>
              </div>
              <button className="btn-remove" onClick={() => setInventoryFile(null)}>×</button>
            </div>
          )}
          {inventoryFile && (
            <button className="btn-upload" onClick={async () => {
              try {
                await uploadInventory(inventoryFile);
                setSuccess('Inventory uploaded successfully!');
              } catch (err: any) {
                setError(err.response?.data?.detail || 'Upload failed');
              }
            }}>
              Upload Inventory
            </button>
          )}
        </div>
      </div>

      <div className="status-section">
        <h2><span className="section-icon">◆</span> Data Status</h2>
        <div className="status-item">
          <span className={`status-icon ${purchasesFile ? 'status-complete' : 'status-pending'}`}>
            {purchasesFile ? '●' : '○'}
          </span>
          <div className="status-text">
            <span className="status-label">Purchases Data</span>
            <span className="status-detail">
              {purchasesFile ? `${purchasesFile.name} ready` : 'Not uploaded'}
            </span>
          </div>
        </div>
        <div className="status-item">
          <span className={`status-icon ${inventoryFile ? 'status-complete' : 'status-pending'}`}>
            {inventoryFile ? '●' : '○'}
          </span>
          <div className="status-text">
            <span className="status-label">Inventory Data</span>
            <span className="status-detail">
              {inventoryFile ? `${inventoryFile.name} ready` : 'Not uploaded'}
            </span>
          </div>
        </div>
        <div className="status-item">
          <span className="status-icon status-sync">◎</span>
          <div className="status-text">
            <span className="status-label">Market Data</span>
            <span className="status-detail">Auto-refreshed from Yahoo Finance & Stooq</span>
          </div>
        </div>
      </div>

      {error && <div style={{ color: '#f87171', padding: '1rem', marginBottom: '1rem' }}>{error}</div>}
      {success && <div style={{ color: '#22d3ee', padding: '1rem', marginBottom: '1rem' }}>{success}</div>}

      <div className="actions-section">
        <button
          className="btn-secondary"
          onClick={async () => {
            try {
              await refreshMarketData();
              setSuccess('Market data refreshed!');
            } catch (err: any) {
              setError(err.response?.data?.detail || 'Refresh failed');
            }
          }}
        >
          <span className="btn-icon">↻</span> Refresh Market Data
        </button>
        <button
          className="btn-primary"
          onClick={() => navigate('/dashboard/var')}
          disabled={!purchasesFile && !inventoryFile}
        >
          Proceed to Analysis <span className="btn-icon">→</span>
        </button>
      </div>
    </div>
  );
};
