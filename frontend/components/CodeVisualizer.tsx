import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './CodeVisualizer.module.css';
import { Controls } from './visualizer/Controls';
import { Canvas } from './visualizer/Canvas';
import { LoadPanel } from './visualizer/LoadPanel';
import { useOutputData } from './visualizer/hooks/useOutputData';
import { PositionMap, SavedLayoutRecord, usePersistentPositions } from './visualizer/hooks/usePersistentPositions';
import {
  applyCustomPositions,
  buildVisualizerLayout,
  computeCanvasBounds,
  computeConnectionPositions
} from './visualizer/utils/layout';
import { DataFileInfo, FileBox, Position, ViewBox } from './visualizer/types';
import { SearchBar, SearchResult } from './visualizer/SearchBar';

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

type SearchEntry = SearchResult & {
  fileId: string;
  itemId?: string;
};

export default function CodeVisualizer() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dataFile, setDataFile] = useState('output.json');
  const { data, versionKey, status, refresh, lastUpdated, error } = useOutputData(dataFile);
  const {
    positions,
    updatePosition,
    updatePositionsBatch,
    resetPositions,
    saveLayout,
    deleteLayout,
    getLayoutById,
    importLayout,
    layouts,
    applyPositions
  } = usePersistentPositions(versionKey, dataFile);

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
  const viewBoxRef = useRef<ViewBox>(DEFAULT_VIEWBOX);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, viewBoxX: 0, viewBoxY: 0, worldX: 0, worldY: 0 });
  const [dragState, setDragState] = useState<
    | null
    | {
        fileIds: string[];
        startWorld: Position;
        initialPositions: Record<string, Position>;
        filePaths: Record<string, string>;
      }
  >(null);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [highlightState, setHighlightState] = useState<HighlightState | null>(null);
  const [showOutgoingHighlights, setShowOutgoingHighlights] = useState(true);
  const [showIncomingHighlights, setShowIncomingHighlights] = useState(true);
  const [isLoadPanelOpen, setIsLoadPanelOpen] = useState(false);
  const [dataFiles, setDataFiles] = useState<DataFileInfo[]>([]);
  const [pendingLayout, setPendingLayout] = useState<{ dataFile: string; positions: PositionMap } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    viewBoxRef.current = viewBox;
  }, [viewBox]);

  useEffect(() => {
    svgRef.current?.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${canvasBounds.width / zoom} ${canvasBounds.height / zoom}`);
  }, [viewBox, canvasBounds, zoom]);

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

  const fileBoxMap = useMemo(() => new Map(fileBoxes.map(box => [box.id, box])), [fileBoxes]);

  const searchEntries = useMemo(() => {
    const entries: SearchEntry[] = [];
    fileBoxes.forEach(fileBox => {
      entries.push({
        id: `file:${fileBox.id}`,
        label: fileBox.displayName,
        detail: fileBox.path,
        type: 'file',
        fileId: fileBox.id
      });

      fileBox.items.forEach(item => {
        entries.push({
          id: `${fileBox.id}:${item.id}`,
          label: item.name,
          detail: fileBox.displayName,
          type: item.type,
          fileId: fileBox.id,
          itemId: item.id
        });
      });
    });
    return entries;
  }, [fileBoxes]);

  const searchResults = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) {
      return [] as SearchEntry[];
    }
    return searchEntries
      .filter(entry => entry.label.toLowerCase().includes(term) || entry.detail.toLowerCase().includes(term))
      .slice(0, 12);
  }, [searchEntries, searchQuery]);

  const searchEntryMap = useMemo(() => new Map(searchEntries.map(entry => [entry.id, entry])), [searchEntries]);

  const handleSearchSelect = useCallback(
    (resultId: string) => {
      const result = searchEntryMap.get(resultId);
      if (!result) {
        return;
      }
      const file = fileBoxMap.get(result.fileId);
      if (!file) {
        return;
      }

      let targetX = file.position.x + file.size.width / 2;
      let targetY = file.position.y + file.size.height / 2;
      let targetItemId: string | undefined;

      if (result.itemId) {
        const item = file.items.find(entry => entry.id === result.itemId);
        if (item) {
          targetX = file.position.x + item.position.x + item.size.width / 2;
          targetY = file.position.y + item.position.y + item.size.height / 2;
          targetItemId = item.id;
        }
      }

      const viewWidth = canvasBounds.width / zoom;
      const viewHeight = canvasBounds.height / zoom;

      setViewBox({
        x: targetX - viewWidth / 2,
        y: targetY - viewHeight / 2
      });
      setSelectedFileIds(new Set([file.id]));
      setHighlightState({
        fileId: file.id,
        itemId: targetItemId,
        outgoingItemIds: new Set(),
        incomingItemIds: new Set(),
        outgoingConnectionIds: new Set(),
        incomingConnectionIds: new Set()
      });
      setSearchQuery('');
    },
    [canvasBounds.height, canvasBounds.width, fileBoxMap, searchEntryMap, zoom]
  );

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
    const handleWindowUp = () => setDragState(null);
    window.addEventListener('mouseup', handleWindowUp);
    return () => window.removeEventListener('mouseup', handleWindowUp);
  }, []);

  useEffect(() => {
    if (!dragState) {
      return;
    }
    const handleMove = (event: MouseEvent) => {
      const point = getWorldPoint(event.clientX, event.clientY);
      if (!point) {
        return;
      }
      const deltaX = point.x - dragState.startWorld.x;
      const deltaY = point.y - dragState.startWorld.y;
      const updates: PositionMap = {};
      dragState.fileIds.forEach(id => {
        const path = dragState.filePaths[id];
        const base = path ? dragState.initialPositions[path] : undefined;
        if (!path || !base) {
          return;
        }
        updates[path] = {
          x: base.x + deltaX,
          y: base.y + deltaY
        };
      });
      if (Object.keys(updates).length > 0) {
        updatePositionsBatch(updates);
      }
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, [dragState, getWorldPoint, updatePositionsBatch]);

  useEffect(() => {
    setHighlightState(null);
    setDragState(null);
    setSelectedFileIds(new Set());
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
      if (e.button !== 0 || dragState) {
        return;
      }
      setIsPanning(true);
      const anchor = getWorldPoint(e.clientX, e.clientY);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        viewBoxX: viewBox.x,
        viewBoxY: viewBox.y,
        worldX: anchor?.x ?? viewBox.x,
        worldY: anchor?.y ?? viewBox.y
      };
      viewBoxRef.current = viewBox;
      e.preventDefault();
    },
    [dragState, getWorldPoint, viewBox]
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isPanning) {
        return;
      }

      const point = getWorldPoint(e.clientX, e.clientY);
      if (!point) {
        return;
      }

      const deltaX = point.x - panStartRef.current.worldX;
      const deltaY = point.y - panStartRef.current.worldY;

      const newX = panStartRef.current.viewBoxX - deltaX;
      const newY = panStartRef.current.viewBoxY - deltaY;

      viewBoxRef.current = { x: newX, y: newY };
      svgRef.current?.setAttribute('viewBox', `${newX} ${newY} ${canvasBounds.width / zoom} ${canvasBounds.height / zoom}`);
    },
    [getWorldPoint, isPanning, canvasBounds, zoom]
  );

  const handleCanvasMouseUp = useCallback(() => {
    setIsPanning(false);
    setDragState(null);
    setViewBox(viewBoxRef.current);
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

      if (event.ctrlKey || event.metaKey) {
        setSelectedFileIds(prev => {
          const next = new Set(prev);
          if (next.has(fileBox.id)) {
            next.delete(fileBox.id);
          } else {
            next.add(fileBox.id);
          }
          return next;
        });
        return;
      }

      const selectionHasFile = selectedFileIds.has(fileBox.id);
      if (!selectionHasFile) {
        setSelectedFileIds(new Set([fileBox.id]));
      }

      const activeIds = selectionHasFile && selectedFileIds.size > 0 ? Array.from(selectedFileIds) : [fileBox.id];
      const point = getWorldPoint(event.clientX, event.clientY);
      if (!point) {
        return;
      }

      const filePaths: Record<string, string> = {};
      const initialPositions: Record<string, Position> = {};
      activeIds.forEach(id => {
        const target = fileBoxMap.get(id);
        if (target) {
          filePaths[id] = target.path;
          initialPositions[target.path] = { ...target.position };
        }
      });

      if (Object.keys(initialPositions).length === 0) {
        return;
      }

      setDragState({
        fileIds: activeIds,
        startWorld: point,
        initialPositions,
        filePaths
      });
    },
    [fileBoxMap, getWorldPoint, selectedFileIds]
  );

  const handleFileContextMenu = useCallback(
    (_event: React.MouseEvent<SVGGElement>, fileBox: FileBox) => {
      const outgoing = connectionAggregates.outgoingByFile.get(fileBox.id);
      const incoming = connectionAggregates.incomingByFile.get(fileBox.id);
      setSelectedFileIds(new Set([fileBox.id]));
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
      setSelectedFileIds(new Set([payload.fileBox.id]));
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
    setDragState(null);
    setSelectedFileIds(new Set());
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
      setSelectedFileIds(new Set());
      setDragState(null);
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

  const handleDownloadLayout = useCallback(
    (layoutId: string) => {
      const layoutRecord = getLayoutById(layoutId);
      if (!layoutRecord) {
        window.alert('Unable to find that layout');
        return;
      }
      const payload = {
        version: 1,
        layout: layoutRecord
      } satisfies { version: number; layout: SavedLayoutRecord };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const safeName = `${layoutRecord.name.replace(/[^a-z0-9-_]+/gi, '_') || 'layout'}_${layoutRecord.id}.json`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = safeName;
      anchor.click();
      URL.revokeObjectURL(url);
    },
    [getLayoutById]
  );

  const handleUploadLayout = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const candidate: SavedLayoutRecord | undefined = parsed?.layout ?? parsed;
        if (!candidate || typeof candidate !== 'object' || !candidate.positions) {
          throw new Error('Invalid layout file. Missing positions.');
        }
        const newId = importLayout({
          name: candidate.name ?? file.name.replace(/\.json$/i, ''),
          dataFile: candidate.dataFile ?? dataFile,
          versionKey: candidate.versionKey ?? null,
          positions: candidate.positions,
          createdAt: typeof candidate.createdAt === 'number' ? candidate.createdAt : Date.now(),
          updatedAt: Date.now()
        });
        setIsLoadPanelOpen(true);
        if ((candidate.dataFile ?? dataFile) === dataFile) {
          const shouldApply = window.confirm('Layout imported for current data file. Apply it now?');
          if (shouldApply) {
            applyPositions(candidate.positions);
          }
        } else {
          window.alert('Layout imported. Switch to its data file via Load panel to apply it.');
        }
        return newId;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        window.alert(`Failed to upload layout: ${message}`);
        return null;
      }
    },
    [applyPositions, dataFile, importLayout]
  );

  const handleSelectDataFile = useCallback((fileName: string) => {
    setHighlightState(null);
    setSelectedFileIds(new Set());
    setDragState(null);
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
        <SearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          results={searchResults}
          onSelect={handleSearchSelect}
        />
      {error && <div className={styles.errorBanner}>{error}</div>}
      <Canvas
        canvasBounds={canvasBounds}
        zoom={zoom}
        svgRef={svgRef}
        fileBoxes={fileBoxes}
        connections={connections}
        selectedFileId={selectedFileId}
        selectedFileIds={selectedFileIds}
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
        onDownloadLayout={handleDownloadLayout}
        onUploadLayout={handleUploadLayout}
      />
    </div>
  );
}
