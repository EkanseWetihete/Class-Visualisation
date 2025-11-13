import React from 'react';
import styles from '../CodeVisualizer.module.css';
import { ConnectionRender } from './types';
import { createConnectionPath, getMidPoint } from './utils/geometry';

interface ConnectionLayerProps {
  connections: ConnectionRender[];
  highlightedConnectionIds?: Set<string>;
}

export const ConnectionLayer: React.FC<ConnectionLayerProps> = ({ connections, highlightedConnectionIds }) => (
  <>
    {connections.map((conn, index) => {
      const path = createConnectionPath(conn.fromPos, conn.toPos, conn.pathOffset);
      const midPoint = getMidPoint(conn.fromPos, conn.toPos);
      const isHighlighted = highlightedConnectionIds?.has(conn.id);
      return (
        <g key={`connection-${conn.id}-${index}`}>
          <path
            d={path}
            className={isHighlighted ? `${styles.connection} ${styles.connectionHighlighted}` : styles.connection}
            markerEnd="url(#arrowhead)"
          />
          <text
            x={midPoint.x}
            y={midPoint.y - 5}
            className={isHighlighted ? `${styles.connectionLabel} ${styles.connectionLabelHighlighted}` : styles.connectionLabel}
            textAnchor="middle"
          >
            {conn.label}
          </text>
        </g>
      );
    })}
  </>
);
