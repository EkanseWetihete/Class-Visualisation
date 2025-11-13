import React from 'react';
import styles from '../CodeVisualizer.module.css';

interface ControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onRefresh: () => void;
  onSaveLayout: () => void;
  onOpenLoadManager: () => void;
  canPersistLayout: boolean;
  lastUpdated?: number;
  isLoading: boolean;
  dataFile: string;
  showOutgoingHighlights: boolean;
  showIncomingHighlights: boolean;
  onToggleOutgoing: () => void;
  onToggleIncoming: () => void;
}

export const Controls: React.FC<ControlsProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetView,
  onRefresh,
  onSaveLayout,
  onOpenLoadManager,
  canPersistLayout,
  lastUpdated,
  isLoading,
  dataFile,
  showOutgoingHighlights,
  showIncomingHighlights,
  onToggleOutgoing,
  onToggleIncoming
}) => {
  const formattedTimestamp = lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '—';

  return (
    <div className={styles.controls}>
      <button onClick={onZoomIn}>Zoom In</button>
      <button onClick={onZoomOut}>Zoom Out</button>
      <button onClick={onResetView}>Reset View</button>
      <button onClick={onRefresh} disabled={isLoading}>
        {isLoading ? 'Refreshing…' : 'Refresh Data'}
      </button>
      <button onClick={onSaveLayout} disabled={!canPersistLayout}>
        Save Layout
      </button>
      <button onClick={onOpenLoadManager}>Load / Manage</button>
      <div className={styles.toggleGroup}>
        <label className={styles.toggleLabel}>
          <input type="checkbox" checked={showOutgoingHighlights} onChange={onToggleOutgoing} /> Outgoing
        </label>
        <label className={styles.toggleLabel}>
          <input type="checkbox" checked={showIncomingHighlights} onChange={onToggleIncoming} /> Incoming
        </label>
      </div>
      <span className={styles.zoomLevel}>{Math.round(zoom * 100)}%</span>
      <span title="Last refresh time">{formattedTimestamp}</span>
      <span className={styles.dataFileBadge} title="Currently loaded data file">
        {dataFile}
      </span>
    </div>
  );
};
