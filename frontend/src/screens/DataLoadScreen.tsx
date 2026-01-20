/**
 * Screen 2: Data Load
 * Upload Excel files and trigger market data fetch
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadPurchases, uploadInventory, refreshMarketData, getDataStatus, resetData } from '../api/endpoints';
import './DataLoadScreen.css';

import type { DataStatusResponse } from '../types/api';

export const DataLoadScreen = () => {
  const [purchasesFile, setPurchasesFile] = useState<File | null>(null);
  const [inventoryFile, setInventoryFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [purchasesDragActive, setPurchasesDragActive] = useState(false);
  const [inventoryDragActive, setInventoryDragActive] = useState(false);
  const [dataStatus, setDataStatus] = useState<DataStatusResponse | null>(null);
  const [showClearWarning, setShowClearWarning] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<'purchases' | 'inventory' | null>(null);
  const navigate = useNavigate();
  
  const purchasesInputRef = useRef<HTMLInputElement>(null);
  const inventoryInputRef = useRef<HTMLInputElement>(null);

  // Load data status on mount
  useEffect(() => {
    loadDataStatus();
  }, []);

  const loadDataStatus = async () => {
    try {
      const status = await getDataStatus();
      setDataStatus(status);
    } catch (err) {
      console.error('Failed to load data status:', err);
    }
  };

  const handleClearPurchases = async () => {
    try {
      setLoading(true);
      await resetData('purchases');
      setSuccess('Purchases data cleared successfully');
      await loadDataStatus();
      setPurchasesFile(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to clear purchases');
    } finally {
      setLoading(false);
    }
  };

  const handleClearInventory = async () => {
    try {
      setLoading(true);
      await resetData('inventory');
      setSuccess('Inventory data cleared successfully');
      await loadDataStatus();
      setInventoryFile(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to clear inventory');
    } finally {
      setLoading(false);
    }
  };


  const handlePurchasesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Check if data already exists
      if (dataStatus?.purchases.uploaded) {
        setPurchasesFile(file);
        setPendingUpload('purchases');
        setShowClearWarning(true);
      } else {
        setPurchasesFile(file);
      }
    }
  };

  const handleInventoryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Check if data already exists
      if (dataStatus?.inventory.uploaded) {
        setInventoryFile(file);
        setPendingUpload('inventory');
        setShowClearWarning(true);
      } else {
        setInventoryFile(file);
      }
    }
  };

  const handleUploadWithClear = async (clearFirst: boolean) => {
    setShowClearWarning(false);
    
    if (clearFirst && pendingUpload) {
      // Clear only the specific data type
      if (pendingUpload === 'purchases') {
        await handleClearPurchases();
      } else if (pendingUpload === 'inventory') {
        await handleClearInventory();
      }
    }
    
    // Upload the pending file
    if (pendingUpload === 'purchases' && purchasesFile) {
      await performPurchasesUpload(purchasesFile);
    } else if (pendingUpload === 'inventory' && inventoryFile) {
      await performInventoryUpload(inventoryFile);
    }
    
    setPendingUpload(null);
  };

  const performPurchasesUpload = async (file: File) => {
    try {
      setLoading(true);
      await uploadPurchases(file);
      setSuccess('Purchases uploaded successfully!');
      await loadDataStatus();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const performInventoryUpload = async (file: File) => {
    try {
      setLoading(true);
      await uploadInventory(file);
      setSuccess('Inventory uploaded successfully!');
      await loadDataStatus();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  // Drag and drop handlers for purchases
  const handlePurchasesDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setPurchasesDragActive(true);
    } else if (e.type === "dragleave") {
      setPurchasesDragActive(false);
    }
  };

  const handlePurchasesDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPurchasesDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        setPurchasesFile(file);
      } else {
        setError('Please upload an Excel file (.xlsx or .xls)');
      }
    }
  };

  // Drag and drop handlers for inventory
  const handleInventoryDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setInventoryDragActive(true);
    } else if (e.type === "dragleave") {
      setInventoryDragActive(false);
    }
  };

  const handleInventoryDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setInventoryDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        setInventoryFile(file);
      } else {
        setError('Please upload an Excel file (.xlsx or .xls)');
      }
    }
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
          <div 
            className={`upload-zone ${purchasesDragActive ? 'active' : ''}`}
            onDragEnter={handlePurchasesDrag}
            onDragLeave={handlePurchasesDrag}
            onDragOver={handlePurchasesDrag}
            onDrop={handlePurchasesDrop}
            onClick={() => purchasesInputRef.current?.click()}
          >
            <div className="upload-icon">⇪</div>
            <p className="primary-text">Drop file or click</p>
            <p>Excel (.xlsx, .xls)</p>
            <input
              ref={purchasesInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handlePurchasesUpload}
              disabled={loading}
              style={{ display: 'none' }}
            />
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
          {dataStatus?.purchases.uploaded && !purchasesFile && (
            <div className="upload-status">
              <div className="status-badge">Data loaded</div>
              <div className="status-details">
                <div>{dataStatus.purchases.record_count} records</div>
                <div className="status-time">
                  {dataStatus.purchases.last_uploaded_at && 
                    new Date(dataStatus.purchases.last_uploaded_at).toLocaleString()}
                </div>
              </div>
              <button className="btn-clear" onClick={handleClearPurchases}>Clear</button>
            </div>
          )}
          {purchasesFile && !showClearWarning && (
            <button className="btn-upload" onClick={() => performPurchasesUpload(purchasesFile)}>
              Upload Purchases
            </button>
          )}
        </div>

        <div className="upload-section">
          <h2><span className="section-icon">▥</span> Inventory Data</h2>
          <div 
            className={`upload-zone ${inventoryDragActive ? 'active' : ''}`}
            onDragEnter={handleInventoryDrag}
            onDragLeave={handleInventoryDrag}
            onDragOver={handleInventoryDrag}
            onDrop={handleInventoryDrop}
            onClick={() => inventoryInputRef.current?.click()}
          >
            <div className="upload-icon">⇪</div>
            <p className="primary-text">Drop file or click</p>
            <p>Excel (.xlsx, .xls)</p>
            <input
              ref={inventoryInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleInventoryUpload}
              disabled={loading}
              style={{ display: 'none' }}
            />
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
          {dataStatus?.inventory.uploaded && !inventoryFile && (
            <div className="upload-status">
              <div className="status-badge">Data loaded</div>
              <div className="status-details">
                <div>{dataStatus.inventory.record_count} records</div>
                <div className="status-time">
                  {dataStatus.inventory.last_uploaded_at && 
                    new Date(dataStatus.inventory.last_uploaded_at).toLocaleString()}
                </div>
              </div>
              <button className="btn-clear" onClick={handleClearInventory}>Clear</button>
            </div>
          )}
          {inventoryFile && !showClearWarning && (
            <button className="btn-upload" onClick={() => performInventoryUpload(inventoryFile)}>
              Upload Inventory
            </button>
          )}
        </div>
      </div>

      {/* Optional: Add summary status if needed */}
      {dataStatus && (dataStatus.purchases.uploaded || dataStatus.inventory.uploaded) && (
        <div className="summary-section">
          <div className="summary-content">
            <div className="summary-item">
              <span className="summary-icon">✓</span>
              <span>Ready for analysis</span>
            </div>
            {dataStatus.market_data.available && (
              <div className="summary-item">
                <span className="summary-icon">◎</span>
                <span>Market data synced</span>
              </div>
            )}
          </div>
        </div>
      )}

      {error && <div style={{ color: '#f87171', padding: '1rem', marginBottom: '1rem' }}>{error}</div>}
      {success && <div style={{ color: '#22d3ee', padding: '1rem', marginBottom: '1rem' }}>{success}</div>}

      {/* Clear Warning Modal */}
      {showClearWarning && (
        <div className="modal-overlay" onClick={() => setShowClearWarning(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Data Already Exists</h2>
            <p>You already have {pendingUpload} data uploaded. What would you like to do?</p>
            <div className="modal-actions">
              <button 
                className="btn-modal-primary" 
                onClick={() => handleUploadWithClear(true)}
              >
                Clear Old Data & Upload New
              </button>
              <button 
                className="btn-modal-secondary" 
                onClick={() => handleUploadWithClear(false)}
              >
                Keep Both (Merge)
              </button>
              <button 
                className="btn-modal-cancel" 
                onClick={() => {
                  setShowClearWarning(false);
                  setPendingUpload(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
