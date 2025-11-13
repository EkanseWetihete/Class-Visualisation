import React from 'react';
import styles from '../CodeVisualizer.module.css';

interface ControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onRefresh: () => void;
  lastUpdated?: number;
  isLoading: boolean;
}

export const Controls: React.FC<ControlsProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetView,
  onRefresh,
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
      <span className={styles.zoomLevel}>{Math.round(zoom * 100)}%</span>
      <span title="Last refresh time">{formattedTimestamp}</span>
    </div>
  );
};
