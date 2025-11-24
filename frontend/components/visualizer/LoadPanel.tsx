import React, { useRef } from 'react';
import styles from '../CodeVisualizer.module.css';
import { DataFileInfo } from './types';
import { SavedLayoutSummary } from './hooks/usePersistentPositions';

interface LoadPanelProps {
  isOpen: boolean;
  dataFiles: DataFileInfo[];
  savedLayouts: SavedLayoutSummary[];
  currentDataFile: string;
  onClose: () => void;
  onRefreshDataFiles: () => void;
  onSelectDataFile: (fileName: string) => void;
  onSelectLayout: (layoutId: string) => void;
  onDeleteLayout: (layoutId: string) => void;
  onDownloadLayout: (layoutId: string) => void;
  onUploadLayout: (file: File) => void;
}

const formatSize = (size: number) => {
  if (size >= 1_000_000) {
    return `${(size / 1_000_000).toFixed(1)} MB`;
  }
  if (size >= 1_000) {
    return `${(size / 1_000).toFixed(1)} KB`;
  }
  return `${size} B`;
};

const formatTimestamp = (value: number) => new Date(value).toLocaleString();

export const LoadPanel: React.FC<LoadPanelProps> = ({
  isOpen,
  dataFiles,
  savedLayouts,
  currentDataFile,
  onClose,
  onRefreshDataFiles,
  onSelectDataFile,
  onSelectLayout,
  onDeleteLayout,
  onDownloadLayout,
  onUploadLayout
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) {
    return null;
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onUploadLayout(file);
      event.target.value = '';
    }
  };

  return (
    <div className={styles.loadPanel}>
      <div className={styles.loadPanelHeader}>
        <span>Data & Layout Manager</span>
        <button className={styles.loadPanelClose} onClick={onClose}>
          Close
        </button>
      </div>

      <div className={styles.loadPanelSection}>
        <div className={styles.loadPanelSectionHeader}>
          <span>Raw Data Files</span>
          <button className={styles.loadPanelAction} onClick={onRefreshDataFiles}>
            Refresh
          </button>
        </div>
        <div className={styles.loadPanelList}>
          {dataFiles.length === 0 && <div className={styles.loadPanelEmpty}>No JSON files detected in /data</div>}
          {dataFiles.map(file => (
            <div key={file.name} className={styles.loadPanelRow}>
              <div>
                <div className={styles.loadPanelRowTitle}>{file.name}</div>
                <div className={styles.loadPanelRowMeta}>
                  {formatSize(file.size)} • {formatTimestamp(file.lastModified)}
                </div>
              </div>
              <button
                className={styles.loadPanelAction}
                onClick={() => onSelectDataFile(file.name)}
                disabled={currentDataFile === file.name}
              >
                {currentDataFile === file.name ? 'Active' : 'Load'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.loadPanelSection}>
        <div className={styles.loadPanelSectionHeader}>
          <span>Saved Layouts</span>
          <div className={styles.loadPanelRowActions}>
            <button className={styles.loadPanelAction} onClick={handleUploadClick}>
              Upload Layout
            </button>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <div className={styles.loadPanelList}>
          {savedLayouts.length === 0 && <div className={styles.loadPanelEmpty}>No saved layouts yet</div>}
          {savedLayouts.map(layout => (
            <div key={layout.id} className={styles.loadPanelRow}>
              <div>
                <div className={styles.loadPanelRowTitle}>{layout.name}</div>
                <div className={styles.loadPanelRowMeta}>
                  {layout.dataFile} • Updated {formatTimestamp(layout.updatedAt)}
                </div>
              </div>
              <div className={styles.loadPanelRowActions}>
                <button className={styles.loadPanelAction} onClick={() => onSelectLayout(layout.id)}>
                  Load
                </button>
                <button className={styles.loadPanelAction} onClick={() => onDownloadLayout(layout.id)}>
                  Download
                </button>
                <button className={styles.loadPanelDanger} onClick={() => onDeleteLayout(layout.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
