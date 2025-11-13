import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './CodeVisualizer.module.css';
import { Controls } from './visualizer/Controls';
import { Canvas } from './visualizer/Canvas';
import { LoadPanel } from './visualizer/LoadPanel';
import { useOutputData } from './visualizer/hooks/useOutputData';
import { PositionMap, usePersistentPositions } from './visualizer/hooks/usePersistentPositions';
import {
  applyCustomPositions,
  buildVisualizerLayout,
  computeCanvasBounds,
  computeConnectionPositions
} from './visualizer/utils/layout';
import { DataFileInfo, FileBox, Position, ViewBox } from './visualizer/types';

const DEFAULT_VIEWBOX: ViewBox = { x: 0, y: 0 };

type HighlightState = {
  fileId: string;
  itemId?: string;
  outgoingItemIds: Set<string>;
  incomingItemIds: Set<string>;
  outgoingConnectionIds: Set<string>;
  incomingConnectionIds: Set<string>;
};

type AggregatedEntry = {
  items: Set<string>;
  connections: Set<string>;
};

export default function CodeVisualizer() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dataFile, setDataFile] = useState('output.json');
  const { data, versionKey, status, refresh, lastUpdated, error } = useOutputData(dataFile);
  const { positions, updatePosition, resetPositions, saveLayout, deleteLayout, getLayoutById, layouts, applyPositions } =
    usePersistentPositions(versionKey, dataFile);

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
  const [highlightState, setHighlightState] = useState<HighlightState | null>(null);
  const [showOutgoingHighlights, setShowOutgoingHighlights] = useState(true);
  const [showIncomingHighlights, setShowIncomingHighlights] = useState(true);
  const [isLoadPanelOpen, setIsLoadPanelOpen] = useState(false);
  const [dataFiles, setDataFiles] = useState<DataFileInfo[]>([]);
  const [pendingLayout, setPendingLayout] = useState<{ dataFile: string; positions: PositionMap } | null>(null);

  const connectionAggregates = useMemo(() => {
    const makeEntry = () => ({ items: new Set<string>(), connections: new Set<string>() });
    const outgoingByFile = new Map<string, AggregatedEntry>();
    const outgoingByItem = new Map<string, AggregatedEntry>();
    const incomingByFile = new Map<string, AggregatedEntry>();
    const incomingByItem = new Map<string, AggregatedEntry>();

    const addEntry = (map: Map<string, AggregatedEntry>, key: string, itemId: string, connectionId: string) => {
      const entry = map.get(key) ?? makeEntry();
      entry.items.add(itemId);
      entry.connections.add(connectionId);
      map.set(key, entry);
    };

    layout.connections.forEach(plan => {
      addEntry(outgoingByFile, plan.from.fileId, plan.to.itemId, plan.id);
      addEntry(outgoingByItem, plan.from.itemId, plan.to.itemId, plan.id);
      addEntry(incomingByFile, plan.to.fileId, plan.from.itemId, plan.id);
      addEntry(incomingByItem, plan.to.itemId, plan.from.itemId, plan.id);
    });

    return { outgoingByFile, outgoingByItem, incomingByFile, incomingByItem };
  }, [layout.connections]);

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

  useEffect(() => {
    const handleWindowUp = () => setDraggingFile(null);
    window.addEventListener('mouseup', handleWindowUp);
    return () => window.removeEventListener('mouseup', handleWindowUp);
  }, []);

  useEffect(() => {
    if (!draggingFile) {
      return;
    }
    const handleMove = (event: MouseEvent) => {
      const point = getWorldPoint(event.clientX, event.clientY);
      if (!point) {
        return;
      }
      updatePosition(draggingFile.filePath, {
        x: point.x - draggingFile.offsetX,
        y: point.y - draggingFile.offsetY
      });
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, [draggingFile, getWorldPoint, updatePosition]);

  useEffect(() => {
    setHighlightState(null);
    setDraggingFile(null);
  }, [versionKey]);

  const fetchDataFiles = useCallback(async () => {
    try {
      const response = await fetch('/api/data-files');
      if (!response.ok) {
        throw new Error('Failed to load data file list');
      }
      const payload = await response.json();
      setDataFiles(payload.files ?? []);
    } catch (err) {
      console.warn('Unable to load data files', err);
    }
  }, []);

  useEffect(() => {
    fetchDataFiles();
  }, [fetchDataFiles]);

  useEffect(() => {
    if (dataFiles.length === 0) {
      return;
    }
    if (!dataFiles.some(file => file.name === dataFile)) {
      setDataFile(dataFiles[0].name);
    }
  }, [dataFiles, dataFile]);

  useEffect(() => {
    if (!pendingLayout) {
      return;
    }
    if (pendingLayout.dataFile !== dataFile) {
      return;
    }
    applyPositions(pendingLayout.positions);
    setPendingLayout(null);
  }, [applyPositions, dataFile, pendingLayout]);

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
    [canvasBounds, isPanning, zoom]
  );

  const handleCanvasMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggingFile(null);
  }, []);

  const handleCanvasContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    setHighlightState(null);
  }, []);

  const handleFileMouseDown = useCallback(
    (event: React.MouseEvent<SVGGElement>, fileBox: FileBox) => {
      if (event.button !== 0) {
        return;
      }
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

  const handleFileContextMenu = useCallback(
    (_event: React.MouseEvent<SVGGElement>, fileBox: FileBox) => {
      const outgoing = connectionAggregates.outgoingByFile.get(fileBox.id);
      const incoming = connectionAggregates.incomingByFile.get(fileBox.id);
      setHighlightState({
        fileId: fileBox.id,
        outgoingItemIds: outgoing ? new Set(outgoing.items) : new Set<string>(),
        incomingItemIds: incoming ? new Set(incoming.items) : new Set<string>(),
        outgoingConnectionIds: outgoing ? new Set(outgoing.connections) : new Set<string>(),
        incomingConnectionIds: incoming ? new Set(incoming.connections) : new Set<string>()
      });
    },
    [connectionAggregates]
  );

  const handleItemContextMenu = useCallback(
    (
      _event: React.MouseEvent<SVGGElement>,
      payload: { fileBox: FileBox; itemId: string }
    ) => {
      const outgoing = connectionAggregates.outgoingByItem.get(payload.itemId);
      const incoming = connectionAggregates.incomingByItem.get(payload.itemId);
      setHighlightState({
        fileId: payload.fileBox.id,
        itemId: payload.itemId,
        outgoingItemIds: outgoing ? new Set(outgoing.items) : new Set<string>(),
        incomingItemIds: incoming ? new Set(incoming.items) : new Set<string>(),
        outgoingConnectionIds: outgoing ? new Set(outgoing.connections) : new Set<string>(),
        incomingConnectionIds: incoming ? new Set(incoming.connections) : new Set<string>()
      });
    },
    [connectionAggregates]
  );

  const handleResetView = useCallback(() => {
    setZoom(1);
    setViewBox(DEFAULT_VIEWBOX);
    setIsPanning(false);
  }, []);

  const handleRefreshData = useCallback(() => {
    setHighlightState(null);
    setDraggingFile(null);
    setIsPanning(false);
    setZoom(1);
    setViewBox(DEFAULT_VIEWBOX);
    resetPositions();
    return refresh();
  }, [refresh, resetPositions]);

  const handleSaveLayout = useCallback(() => {
    if (!versionKey) {
      return;
    }
    const defaultName = `${dataFile} @ ${new Date().toLocaleTimeString()}`;
    const customName = typeof window !== 'undefined' ? window.prompt('Save layout as:', defaultName) : defaultName;
    if (customName === null) {
      return;
    }
    saveLayout(customName);
    setIsLoadPanelOpen(true);
  }, [dataFile, saveLayout, versionKey]);

  const handleLoadSavedLayout = useCallback(
    (layoutId: string) => {
      const layoutRecord = getLayoutById(layoutId);
      if (!layoutRecord) {
        return;
      }
      setPendingLayout({ dataFile: layoutRecord.dataFile, positions: layoutRecord.positions });
      setDataFile(layoutRecord.dataFile);
      setIsLoadPanelOpen(false);
    },
    [getLayoutById]
  );

  const handleDeleteLayout = useCallback(
    (layoutId: string) => {
      deleteLayout(layoutId);
    },
    [deleteLayout]
  );

  const handleSelectDataFile = useCallback((fileName: string) => {
    setHighlightState(null);
    setDataFile(fileName);
    setIsLoadPanelOpen(false);
  }, []);

  const highlightedOutgoingTargets = highlightState?.outgoingItemIds ?? new Set<string>();
  const highlightedIncomingTargets = highlightState?.incomingItemIds ?? new Set<string>();
  const highlightedOutgoingConnectionIds = highlightState?.outgoingConnectionIds ?? new Set<string>();
  const highlightedIncomingConnectionIds = highlightState?.incomingConnectionIds ?? new Set<string>();
  const selectedFileId = highlightState?.fileId;
  const selectedItemId = highlightState?.itemId;
  const canPersistLayout = Boolean(versionKey);

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
        onRefresh={handleRefreshData}
        onSaveLayout={handleSaveLayout}
        onOpenLoadManager={() => setIsLoadPanelOpen(prev => !prev)}
        canPersistLayout={canPersistLayout}
        lastUpdated={lastUpdated}
        isLoading={status === 'loading'}
        dataFile={dataFile}
        showOutgoingHighlights={showOutgoingHighlights}
        showIncomingHighlights={showIncomingHighlights}
        onToggleOutgoing={() => setShowOutgoingHighlights(prev => !prev)}
        onToggleIncoming={() => setShowIncomingHighlights(prev => !prev)}
      />
      {error && <div className={styles.errorBanner}>{error}</div>}
      <Canvas
        canvasBounds={canvasBounds}
        zoom={zoom}
        viewBox={viewBox}
        svgRef={svgRef}
        fileBoxes={fileBoxes}
        connections={connections}
        selectedFileId={selectedFileId}
        selectedItemId={selectedItemId}
        highlightedOutgoingTargets={highlightedOutgoingTargets}
        highlightedIncomingTargets={highlightedIncomingTargets}
        highlightedOutgoingConnectionIds={highlightedOutgoingConnectionIds}
        highlightedIncomingConnectionIds={highlightedIncomingConnectionIds}
        showOutgoingHighlights={showOutgoingHighlights}
        showIncomingHighlights={showIncomingHighlights}
        onWheel={handleWheel}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onContextMenu={handleCanvasContextMenu}
        onFileMouseDown={handleFileMouseDown}
        onFileContextMenu={handleFileContextMenu}
        onItemContextMenu={handleItemContextMenu}
      />
      <LoadPanel
        isOpen={isLoadPanelOpen}
        dataFiles={dataFiles}
        savedLayouts={layouts}
        currentDataFile={dataFile}
        onClose={() => setIsLoadPanelOpen(false)}
        onRefreshDataFiles={fetchDataFiles}
        onSelectDataFile={handleSelectDataFile}
        onSelectLayout={handleLoadSavedLayout}
        onDeleteLayout={handleDeleteLayout}
      />
    </div>
  );
}
