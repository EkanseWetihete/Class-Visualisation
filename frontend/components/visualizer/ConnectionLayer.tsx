import React from 'react';
import styles from '../CodeVisualizer.module.css';
import { ConnectionRender } from './types';
import { createConnectionPath, getMidPoint } from './utils/geometry';

interface ConnectionLayerProps {
  connections: ConnectionRender[];
  highlightedOutgoingConnectionIds?: Set<string>;
  highlightedIncomingConnectionIds?: Set<string>;
  showOutgoingHighlights: boolean;
  showIncomingHighlights: boolean;
}

export const ConnectionLayer: React.FC<ConnectionLayerProps> = ({
  connections,
  highlightedOutgoingConnectionIds,
  highlightedIncomingConnectionIds,
  showOutgoingHighlights,
  showIncomingHighlights
}) => (
  <>
    {connections.map((conn, index) => {
      const path = createConnectionPath(conn.fromPos, conn.toPos, conn.pathOffset);
      const midPoint = getMidPoint(conn.fromPos, conn.toPos);
      const isOutgoingHighlighted = showOutgoingHighlights && highlightedOutgoingConnectionIds?.has(conn.id);
      const isIncomingHighlighted = showIncomingHighlights && highlightedIncomingConnectionIds?.has(conn.id);

      let pathClass = styles.connection;
      let labelClass = styles.connectionLabel;
      let markerRef = 'url(#arrowheadDefault)';

      if (isOutgoingHighlighted) {
        pathClass = `${styles.connection} ${styles.connectionOutgoing}`;
        labelClass = `${styles.connectionLabel} ${styles.connectionLabelOutgoing}`;
        markerRef = 'url(#arrowheadOutgoing)';
      } else if (isIncomingHighlighted) {
        pathClass = `${styles.connection} ${styles.connectionIncoming}`;
        labelClass = `${styles.connectionLabel} ${styles.connectionLabelIncoming}`;
        markerRef = 'url(#arrowheadIncoming)';
      }

      return (
        <g key={`connection-${conn.id}-${index}`}>
          <path d={path} className={pathClass} markerEnd={markerRef} />
          <text x={midPoint.x} y={midPoint.y - 5} className={labelClass} textAnchor="middle">
            {conn.label}
          </text>
        </g>
      );
    })}
  </>
);
