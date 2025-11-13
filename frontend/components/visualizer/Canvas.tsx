import React from 'react';
import styles from '../CodeVisualizer.module.css';
import { ConnectionLayer } from './ConnectionLayer';
import { FileCard } from './FileCard';
import { ConnectionRender, FileBox, Size, ViewBox } from './types';

interface CanvasProps {
  canvasBounds: Size;
  zoom: number;
  viewBox: ViewBox;
  svgRef: React.RefObject<SVGSVGElement>;
  fileBoxes: FileBox[];
  connections: ConnectionRender[];
  onWheel: (event: React.WheelEvent<HTMLDivElement>) => void;
  onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseMove: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseUp: () => void;
  onFileMouseDown: (event: React.MouseEvent<SVGGElement>, fileBox: FileBox) => void;
}

export const Canvas: React.FC<CanvasProps> = ({
  canvasBounds,
  zoom,
  viewBox,
  svgRef,
  fileBoxes,
  connections,
  onWheel,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onFileMouseDown
}) => {
  return (
    <div
      className={styles.canvasContainer}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <svg
        ref={svgRef}
        className={styles.canvas}
        width="100%"
        height="100%"
        viewBox={`${viewBox.x} ${viewBox.y} ${canvasBounds.width / zoom} ${canvasBounds.height / zoom}`}
      >
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="#64b5f6" />
          </marker>
        </defs>

        <ConnectionLayer connections={connections} />
        {fileBoxes.map(fileBox => (
          <FileCard key={fileBox.id} fileBox={fileBox} onMouseDown={onFileMouseDown} />
        ))}
      </svg>
    </div>
  );
};
