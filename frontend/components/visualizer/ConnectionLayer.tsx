import React from 'react';
import styles from '../CodeVisualizer.module.css';
import { ConnectionRender } from './types';
import { createConnectionPath, getMidPoint } from './utils/geometry';

interface ConnectionLayerProps {
  connections: ConnectionRender[];
}

export const ConnectionLayer: React.FC<ConnectionLayerProps> = ({ connections }) => (
  <>
    {connections.map((conn, index) => {
      const path = createConnectionPath(conn.fromPos, conn.toPos, conn.pathOffset);
      const midPoint = getMidPoint(conn.fromPos, conn.toPos);
      return (
        <g key={`connection-${index}`}>
          <path d={path} className={styles.connection} markerEnd="url(#arrowhead)" />
          <text x={midPoint.x} y={midPoint.y - 5} className={styles.connectionLabel} textAnchor="middle">
            {conn.label}
          </text>
        </g>
      );
    })}
  </>
);
