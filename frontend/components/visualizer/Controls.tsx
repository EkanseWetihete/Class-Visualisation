import React from 'react';
import styles from '../CodeVisualizer.module.css';

interface ControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onRefresh: () => void;
  onSaveLayout: () => void;
  onLoadLayout: () => void;
  canPersistLayout: boolean;
  canLoadLayout: boolean;
  lastUpdated?: number;
  isLoading: boolean;
}

export const Controls: React.FC<ControlsProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetView,
  onRefresh,
  onSaveLayout,
  onLoadLayout,
  canPersistLayout,
  canLoadLayout,
  lastUpdated,
  isLoading
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
      <button onClick={onLoadLayout} disabled={!canPersistLayout || !canLoadLayout}>
        Load Layout
      </button>
      <span className={styles.zoomLevel}>{Math.round(zoom * 100)}%</span>
      <span title="Last refresh time">{formattedTimestamp}</span>
    </div>
  );
};
