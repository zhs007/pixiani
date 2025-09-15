import React, { useState, useEffect, useCallback } from 'react';

type AssetSelectionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (urls: string[]) => void;
  requiredCount: number;
};

export const AssetSelectionModal: React.FC<AssetSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  requiredCount,
}) => {
  const [assets, setAssets] = useState<string[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);

  const fetchAssets = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/assets');
      const data = await res.json();
      if (Array.isArray(data)) {
        setAssets(data);
      }
    } catch (e) {
      setError('Failed to fetch assets.');
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setSelectedAssets([]);
      setError(null);
      setFileToUpload(null);
      fetchAssets();
    }
  }, [isOpen, fetchAssets]);

  const handleToggleAsset = (assetName: string) => {
    setSelectedAssets((prev) => {
      const isSelected = prev.includes(assetName);
      if (isSelected) {
        return prev.filter((a) => a !== assetName);
      } else {
        if (prev.length < requiredCount) {
          return [...prev, assetName];
        }
        return prev;
      }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFileToUpload(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!fileToUpload) return;
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', fileToUpload);

    try {
      const res = await fetch('/api/upload-asset', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        throw new Error('Upload failed');
      }
      // Refresh assets list to show the new one
      await fetchAssets();
      setFileToUpload(null); // Clear the input
    } catch (e) {
      setError('Failed to upload file.');
      console.error(e);
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = () => {
    if (selectedAssets.length === requiredCount) {
      const urls = selectedAssets.map((name) => `/sprite/${name}`);
      onSelect(urls);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h2 style={styles.header}>
          Select Sprites ({selectedAssets.length} / {requiredCount} selected)
          <button onClick={onClose} style={styles.closeButton}>
            &times;
          </button>
        </h2>

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <div style={styles.assetGrid}>
          {assets.map((asset) => (
            <div
              key={asset}
              onClick={(e) => {
                handleToggleAsset(asset);
                (e.currentTarget as HTMLDivElement).blur();
                if (document.activeElement instanceof HTMLElement) {
                  document.activeElement.blur();
                }
              }}
              onMouseDown={(e) => e.preventDefault()}
              onFocus={(e) => (e.currentTarget as HTMLDivElement).blur()}
              tabIndex={-1}
              style={{
                ...styles.assetTile,
                ...(selectedAssets.includes(asset) ? styles.selectedTile : {}),
              }}
            >
              <img
                src={`/sprite/${asset}`}
                alt={asset}
                style={styles.assetImage}
                tabIndex={-1}
                draggable={false}
                onFocus={(e) => (e.currentTarget as HTMLImageElement).blur()}
              />
              <p style={styles.assetName}>{asset}</p>
            </div>
          ))}
        </div>

        <div style={styles.footer}>
          <div style={styles.uploadSection}>
            <input
              type="file"
              accept="image/png, image/jpeg, image/gif"
              onChange={handleFileChange}
            />
            <button onClick={handleUpload} disabled={uploading || !fileToUpload}>
              {uploading ? 'Uploading...' : 'Upload New'}
            </button>
          </div>
          <div style={styles.actions}>
            <button onClick={onClose}>Cancel</button>
            <button
              onClick={handleConfirm}
              disabled={selectedAssets.length !== requiredCount}
              style={selectedAssets.length !== requiredCount ? styles.disabledButton : {}}
            >
              Confirm Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Basic styling to keep component self-contained
const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1001,
  },
  modal: {
    background: 'white',
    padding: '20px',
    borderRadius: '8px',
    width: '90%',
    maxWidth: '800px',
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    maxHeight: '90vh',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    margin: 0,
    borderBottom: '1px solid #eee',
    paddingBottom: '10px',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
  },
  assetGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
    gap: '10px',
    overflowY: 'auto',
    padding: '10px',
    background: '#f9f9f9',
    border: '1px solid #ddd',
    borderRadius: '4px',
    minHeight: '200px',
  },
  assetTile: {
    border: 0,
    borderRadius: '4px',
    padding: '5px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'box-shadow 0.2s, background-color 0.2s',
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
    boxSizing: 'border-box',
    userSelect: 'none',
    backgroundColor: '#fff',
    // subtle inner ring for unselected
    boxShadow: 'inset 0 0 0 1px #e5e7eb',
  },
  selectedTile: {
    // stronger inner ring for selected
    boxShadow: 'inset 0 0 0 2px #007bff',
    backgroundColor: '#eaf4ff',
  },
  assetImage: {
    width: '100%',
    height: '80px',
    objectFit: 'contain',
    outline: 'none',
    border: 'none',
    display: 'block',
    pointerEvents: 'none',
  },
  assetName: {
    margin: '5px 0 0',
    fontSize: '12px',
    wordBreak: 'break-all',
    outline: 'none',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1px solid #eee',
    paddingTop: '15px',
    gap: '10px',
    flexWrap: 'wrap',
  },
  uploadSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  actions: {
    display: 'flex',
    gap: '10px',
  },
  disabledButton: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed',
  },
};
