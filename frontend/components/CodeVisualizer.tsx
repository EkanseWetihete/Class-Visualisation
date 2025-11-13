import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './CodeVisualizer.module.css';
import { Controls } from './visualizer/Controls';
import { Canvas } from './visualizer/Canvas';
import { useOutputData } from './visualizer/hooks/useOutputData';
import { usePersistentPositions } from './visualizer/hooks/usePersistentPositions';
import {
  applyCustomPositions,
  buildVisualizerLayout,
  computeCanvasBounds,
  computeConnectionPositions
} from './visualizer/utils/layout';
import { FileBox, Position, ViewBox } from './visualizer/types';

const DEFAULT_VIEWBOX: ViewBox = { x: 0, y: 0 };

export default function CodeVisualizer() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const { data, versionKey, status, refresh, lastUpdated, error } = useOutputData();
  const { positions, updatePosition } = usePersistentPositions(versionKey);

  const layout = useMemo(() => buildVisualizerLayout(data), [data]);
  const fileBoxes = useMemo(() => applyCustomPositions(layout.fileBoxes, positions), [layout.fileBoxes, positions]);
  const canvasBounds = useMemo(
    () => computeCanvasBounds(fileBoxes.length ? fileBoxes : layout.fileBoxes),
    [fileBoxes, layout.fileBoxes]
  );
  const connections = useMemo(
    () => computeConnectionPositions(layout.connections, fileBoxes),
    [layout.connections, fileBoxes]
  );

  const [zoom, setZoom] = useState(1);
  const [viewBox, setViewBox] = useState<ViewBox>(DEFAULT_VIEWBOX);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, viewBoxX: 0, viewBoxY: 0 });
  const [draggingFile, setDraggingFile] = useState<{ filePath: string; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    const handleWindowUp = () => setDraggingFile(null);
    window.addEventListener('mouseup', handleWindowUp);
    return () => window.removeEventListener('mouseup', handleWindowUp);
  }, []);

  const getWorldPoint = useCallback(
    (clientX: number, clientY: number): Position | null => {
      const svg = svgRef.current;
      if (!svg) {
        return null;
      }
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        return null;
      }

      const currentWidth = canvasBounds.width / zoom;
      const currentHeight = canvasBounds.height / zoom;
      const mouseX = clientX - rect.left;
      const mouseY = clientY - rect.top;

      return {
        x: viewBox.x + (mouseX / rect.width) * currentWidth,
        y: viewBox.y + (mouseY / rect.height) * currentHeight
      };
    },
    [canvasBounds, viewBox, zoom]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) {
        return;
      }

      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return;
      }

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const currentWidth = canvasBounds.width / zoom;
      const currentHeight = canvasBounds.height / zoom;

      const mouseWorldX = viewBox.x + (mouseX / rect.width) * currentWidth;
      const mouseWorldY = viewBox.y + (mouseY / rect.height) * currentHeight;

      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.1, zoom * delta);

      const newWidth = canvasBounds.width / newZoom;
      const newHeight = canvasBounds.height / newZoom;

      setZoom(newZoom);
      setViewBox({
        x: mouseWorldX - (mouseX / rect.width) * newWidth,
        y: mouseWorldY - (mouseY / rect.height) * newHeight
      });
    },
    [canvasBounds, viewBox, zoom]
  );

  const zoomAroundCenter = useCallback(
    (factor: number) => {
      const centerX = viewBox.x + (canvasBounds.width / zoom) / 2;
      const centerY = viewBox.y + (canvasBounds.height / zoom) / 2;
      const newZoom = Math.max(0.1, zoom * factor);
      const newWidth = canvasBounds.width / newZoom;
      const newHeight = canvasBounds.height / newZoom;

      setZoom(newZoom);
      setViewBox({
        x: centerX - newWidth / 2,
        y: centerY - newHeight / 2
      });
    },
    [canvasBounds, viewBox, zoom]
  );

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0 || draggingFile) {
        return;
      }
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY, viewBoxX: viewBox.x, viewBoxY: viewBox.y };
      e.preventDefault();
    },
    [draggingFile, viewBox]
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (draggingFile) {
        const point = getWorldPoint(e.clientX, e.clientY);
        if (!point) {
          return;
        }
        updatePosition(draggingFile.filePath, {
          x: point.x - draggingFile.offsetX,
          y: point.y - draggingFile.offsetY
        });
        return;
      }

      if (!isPanning) {
        return;
      }

      const svg = svgRef.current;
      if (!svg) {
        return;
      }

      const rect = svg.getBoundingClientRect();
      const deltaX = e.clientX - panStartRef.current.x;
      const deltaY = e.clientY - panStartRef.current.y;

      const scaleX = (canvasBounds.width / zoom) / rect.width;
      const scaleY = (canvasBounds.height / zoom) / rect.height;

      setViewBox({
        x: panStartRef.current.viewBoxX - deltaX * scaleX,
        y: panStartRef.current.viewBoxY - deltaY * scaleY
      });
    },
    [canvasBounds, draggingFile, getWorldPoint, isPanning, updatePosition, zoom]
  );

  const handleCanvasMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggingFile(null);
  }, []);

  const handleFileMouseDown = useCallback(
    (event: React.MouseEvent<SVGGElement>, fileBox: FileBox) => {
      if (event.button !== 0) {
        return;
      }
      event.stopPropagation();
      event.preventDefault();

      const point = getWorldPoint(event.clientX, event.clientY);
      if (!point) {
        return;
      }

      setDraggingFile({
        filePath: fileBox.path,
        offsetX: point.x - fileBox.position.x,
        offsetY: point.y - fileBox.position.y
      });
    },
    [getWorldPoint]
  );

  const handleResetView = useCallback(() => {
    setZoom(1);
    setViewBox(DEFAULT_VIEWBOX);
    setIsPanning(false);
  }, []);

  if (status === 'loading' && !layout.fileBoxes.length) {
    return <div className={styles.loading}>Loading visualization...</div>;
  }

  if (status === 'error' && !layout.fileBoxes.length) {
    return <div className={styles.loading}>Failed to load output.json</div>;
  }

  return (
    <div className={styles.container}>
      <Controls
        zoom={zoom}
        onZoomIn={() => zoomAroundCenter(1.2)}
        onZoomOut={() => zoomAroundCenter(0.8)}
        onResetView={handleResetView}
        onRefresh={refresh}
        lastUpdated={lastUpdated}
        isLoading={status === 'loading'}
      />
      {error && <div className={styles.errorBanner}>{error}</div>}
      <Canvas
        canvasBounds={canvasBounds}
        zoom={zoom}
        viewBox={viewBox}
        svgRef={svgRef}
        fileBoxes={fileBoxes}
        connections={connections}
        onWheel={handleWheel}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onFileMouseDown={handleFileMouseDown}
      />
    </div>
  );
}
