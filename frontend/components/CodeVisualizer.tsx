import React, { useEffect, useMemo, useState } from 'react';
import styles from './CodeVisualizer.module.css';

interface DataItem {
  args: string[];
  start_line: number;
  end_line: number;
  used_functions: {
    [key: string]: string | { file?: string; methods?: string[] };
  };
  methods?: { [key: string]: DataItem };
}

interface OutputData {
  files: { [key: string]: { [key: string]: DataItem } };
}

interface Position {
  x: number;
  y: number;
}

interface UsedReference {
  targetName: string;
  module: string;
  normalizedModule: string;
  sourceLabel: string;
  targetMethods?: string[];
}

interface ItemBox {
  id: string;
  name: string;
  type: 'class' | 'function';
  args: string[];
  methods?: string[];
  position: Position;
  size: { width: number; height: number };
  fileId: string;
  filePath: string;
  moduleKey: string;
  usedRefs: UsedReference[];
}

interface FileBox {
  id: string;
  path: string;
  moduleKey: string;
  displayName: string;
  position: Position;
  size: { width: number; height: number };
  items: ItemBox[];
}

interface Connection {
  from: string;
  to: string;
  fromPos: Position;
  toPos: Position;
  label: string;
  pathOffset: number;
}

const ITEM_WIDTH = 280;
const ITEM_MIN_HEIGHT = 60;
const ITEM_PADDING = 15;
const FILE_PADDING = 30;
const MIN_FILE_SPACING = 150;
const MIN_VERTICAL_SPACING = 100;
const BASE_MARGIN = 50;

const BASE_SLOT_DIRECTIONS: Array<{ x: number; y: number }> = [
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: 1, y: 1 }
];

function getOffsetForIndex(index: number): Position {
  const dir = BASE_SLOT_DIRECTIONS[index % BASE_SLOT_DIRECTIONS.length];
  const radius = Math.floor(index / BASE_SLOT_DIRECTIONS.length) + 1;
  return { x: dir.x * radius, y: dir.y * radius };
}

function sanitizeModulePath(raw: string): string {
  return raw
    .replace(/^from\s+/i, '')
    .replace(/\s+import.+$/i, '')
    .replace(/\.py$/i, '')
    .replace(/[\\/]+/g, '.')
    .replace(/\.+/g, '.')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function moduleKeyFromPath(filePath: string): string {
  return sanitizeModulePath(
    filePath
      .replace(/\.py$/i, '')
      .replace(/[\\/]+/g, '.')
  );
}

function computeEdgeOffset(index: number, step = 18): number {
  if (index === 0) {
    return 0;
  }
  const magnitude = Math.ceil(index / 2) * step;
  return index % 2 === 1 ? magnitude : -magnitude;
}

export default function CodeVisualizer() {
  const [data, setData] = useState<OutputData | null>(null);
  const [zoom, setZoom] = useState(1);
  const [viewBoxX, setViewBoxX] = useState(0);
  const [viewBoxY, setViewBoxY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, viewBoxX: 0, viewBoxY: 0 });

  useEffect(() => {
    fetch('/api/output')
      .then(response => response.json())
      .then(setData)
      .catch(console.error);
  }, []);

  const { fileBoxes, connections, canvasBounds } = useMemo(() => {
    if (!data) {
      return {
        fileBoxes: [],
        connections: [],
        canvasBounds: { width: 2000, height: 1200 }
      };
    }

    const fileBoxes: FileBox[] = [];
    const fileBoxById = new Map<string, FileBox>();
    const nameModuleIndex = new Map<string, Map<string, ItemBox[]>>();
    const nameOnlyIndex = new Map<string, ItemBox[]>();

    const registerItem = (item: ItemBox) => {
      const lowerName = item.name.toLowerCase();
      if (!nameModuleIndex.has(lowerName)) {
        nameModuleIndex.set(lowerName, new Map());
      }
      const moduleMap = nameModuleIndex.get(lowerName)!;
      if (!moduleMap.has(item.moduleKey)) {
        moduleMap.set(item.moduleKey, []);
      }
      moduleMap.get(item.moduleKey)!.push(item);

      if (!nameOnlyIndex.has(lowerName)) {
        nameOnlyIndex.set(lowerName, []);
      }
      nameOnlyIndex.get(lowerName)!.push(item);
    };

    const collectUsedRefs = (
      item: ItemBox,
      usedFunctions: { [key: string]: unknown } | undefined,
      sourceLabel: string
    ) => {
      if (!usedFunctions) {
        return;
      }

      Object.entries(usedFunctions).forEach(([usedName, usedValue]) => {
        let moduleSpecifier = '';
        let methodTargets: string[] | undefined;

        if (typeof usedValue === 'string') {
          moduleSpecifier = usedValue;
        } else if (usedValue && typeof usedValue === 'object') {
          const candidate = usedValue as { file?: string; methods?: string[] };
          if (candidate.file) {
            moduleSpecifier = candidate.file;
          }
          if (Array.isArray(candidate.methods) && candidate.methods.length > 0) {
            methodTargets = candidate.methods;
          }
        }

        moduleSpecifier = moduleSpecifier.trim();
        if (!moduleSpecifier) {
          return;
        }

        const normalizedModule = sanitizeModulePath(moduleSpecifier);

        item.usedRefs.push({
          targetName: usedName,
          module: moduleSpecifier,
          normalizedModule,
          sourceLabel,
          targetMethods: methodTargets
        });
      });
    };

    let fileIndex = 0;

    Object.entries(data.files).forEach(([filePath, fileData]) => {
      const fileId = `file-${fileIndex}`;
      const moduleKey = moduleKeyFromPath(filePath);
      const displayName = filePath.split(/[\\/]/).slice(-2).join('/');

      const items: ItemBox[] = [];
      let itemYOffset = FILE_PADDING;

      Object.entries(fileData).forEach(([itemName, itemData]) => {
        const itemId = `${fileId}-${itemName}`;
        const isClass = !!itemData.methods;

        let methods: string[] = [];
        let itemHeight = ITEM_MIN_HEIGHT;

        if (isClass && itemData.methods) {
          methods = Object.keys(itemData.methods);
          itemHeight = ITEM_MIN_HEIGHT + methods.length * 24;
        }

        const item: ItemBox = {
          id: itemId,
          name: itemName,
          type: isClass ? 'class' : 'function',
          args: itemData.args,
          methods,
          position: { x: FILE_PADDING, y: itemYOffset },
          size: { width: ITEM_WIDTH, height: itemHeight },
          fileId,
          filePath,
          moduleKey,
          usedRefs: []
        };

        collectUsedRefs(item, itemData.used_functions, itemName);

        if (isClass && itemData.methods) {
          Object.entries(itemData.methods).forEach(([methodName, methodData]) => {
            collectUsedRefs(item, methodData.used_functions, `${itemName}.${methodName}`);
          });
        }

        items.push(item);
        itemYOffset += itemHeight + ITEM_PADDING;

        registerItem(item);
      });

      const fileWidth = ITEM_WIDTH + FILE_PADDING * 2;
      const fileHeight = itemYOffset + FILE_PADDING;

      const fileBox: FileBox = {
        id: fileId,
        path: filePath,
        moduleKey,
        displayName,
        position: { x: 0, y: 0 },
        size: { width: fileWidth, height: fileHeight },
        items
      };

      fileBoxes.push(fileBox);
      fileBoxById.set(fileId, fileBox);

      fileIndex += 1;
    });

    const findTargetItem = (usedRef: UsedReference): ItemBox | null => {
      const lowerName = usedRef.targetName.toLowerCase();
      const moduleHint = usedRef.normalizedModule;
      const moduleMap = nameModuleIndex.get(lowerName);

      if (moduleMap) {
        if (moduleHint && moduleMap.has(moduleHint)) {
          return moduleMap.get(moduleHint)![0];
        }

        if (moduleHint) {
          let bestMatch: { item: ItemBox; score: number } | null = null;
          const hintPath = moduleHint.replace(/\./g, '/');

          moduleMap.forEach(items => {
            items.forEach(candidate => {
              const candidatePath = candidate.filePath
                .replace(/\.py$/i, '')
                .replace(/[\\]/g, '/')
                .toLowerCase();

              let score = 0;
              if (candidate.moduleKey === moduleHint) score += 30;
              if (candidate.moduleKey.endsWith(moduleHint)) score += 18;
              if (moduleHint.endsWith(candidate.moduleKey)) score += 16;
              if (candidate.moduleKey.includes(moduleHint)) score += 12;
              if (candidatePath.endsWith(hintPath)) score += 10;
              if (candidatePath.includes(hintPath)) score += 6;

              if (!bestMatch || score > bestMatch.score) {
                bestMatch = { item: candidate, score };
              }
            });
          });

          if (bestMatch) {
            return bestMatch.item;
          }
        }

        for (const items of moduleMap.values()) {
          if (items.length > 0) {
            return items[0];
          }
        }
      }

      const nameCandidates = nameOnlyIndex.get(lowerName);
      if (nameCandidates && nameCandidates.length > 0) {
        return nameCandidates[0];
      }

      return null;
    };

    type PendingConnection = {
      source: ItemBox;
      target: ItemBox;
      usedRef: UsedReference;
    };

    const pendingConnections: PendingConnection[] = [];
    const edgeWeights = new Map<string, number>();

    const recordConnectionWeight = (a: string, b: string) => {
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      edgeWeights.set(key, (edgeWeights.get(key) ?? 0) + 1);
    };

    fileBoxes.forEach(fileBox => {
      fileBox.items.forEach(item => {
        item.usedRefs.forEach(usedRef => {
          const target = findTargetItem(usedRef);
          if (!target || target.id === item.id) {
            return;
          }

          pendingConnections.push({ source: item, target, usedRef });
          recordConnectionWeight(item.fileId, target.fileId);
        });
      });
    });

    const adjacency = new Map<string, Array<{ id: string; weight: number }>>();
    fileBoxes.forEach(fileBox => {
      adjacency.set(fileBox.id, []);
    });

    edgeWeights.forEach((weight, key) => {
      const [a, b] = key.split('|');
      adjacency.get(a)!.push({ id: b, weight });
      adjacency.get(b)!.push({ id: a, weight });
    });

    const nodeWeights = new Map<string, number>();
    adjacency.forEach((neighbors, id) => {
      const total = neighbors.reduce((sum, neighbor) => sum + neighbor.weight, 0);
      nodeWeights.set(id, total);
    });

    const gridPositions = new Map<string, Position>();
    const occupied = new Set<string>();
    const gridKey = (x: number, y: number) => `${x},${y}`;

    const placeNode = (id: string, pos: Position) => {
      gridPositions.set(id, pos);
      occupied.add(gridKey(pos.x, pos.y));
    };

    let rootIndex = 0;
    const getNextRootPosition = (): Position => {
      while (true) {
        if (rootIndex === 0) {
          rootIndex += 1;
          if (!occupied.has(gridKey(0, 0))) {
            return { x: 0, y: 0 };
          }
        } else {
          const offset = getOffsetForIndex(rootIndex - 1);
          rootIndex += 1;
          if (!occupied.has(gridKey(offset.x, offset.y))) {
            return offset;
          }
        }
      }
    };

    const sortedNodes = fileBoxes
      .map(fb => fb.id)
      .sort((a, b) => {
        const diff = (nodeWeights.get(b) ?? 0) - (nodeWeights.get(a) ?? 0);
        if (diff !== 0) {
          return diff;
        }
        return a.localeCompare(b);
      });

    const queue: string[] = [];
    const enqueued = new Set<string>();

    const enqueue = (id: string) => {
      if (!enqueued.has(id)) {
        queue.push(id);
        enqueued.add(id);
      }
    };

    sortedNodes.forEach(nodeId => {
      if (!gridPositions.has(nodeId)) {
        placeNode(nodeId, getNextRootPosition());
        enqueue(nodeId);
      }

      while (queue.length > 0) {
        const currentId = queue.shift()!;
        const anchorPos = gridPositions.get(currentId);
        if (!anchorPos) {
          continue;
        }

        const neighbors = (adjacency.get(currentId) ?? [])
          .slice()
          .sort((a, b) => {
            const diff = b.weight - a.weight;
            if (diff !== 0) {
              return diff;
            }
            return a.id.localeCompare(b.id);
          });

        // Keep connected files grouped by filling free slots around the anchor.
        neighbors.forEach((neighbor, index) => {
          if (gridPositions.has(neighbor.id)) {
            return;
          }

          let slotIndex = index;
          let attempts = 0;
          const maxAttempts = 256;
          let placed = false;

          while (attempts < maxAttempts && !placed) {
            const offset = getOffsetForIndex(slotIndex);
            const candidate = {
              x: anchorPos.x + offset.x,
              y: anchorPos.y + offset.y
            };

            if (!occupied.has(gridKey(candidate.x, candidate.y))) {
              placeNode(neighbor.id, candidate);
              enqueue(neighbor.id);
              placed = true;
            } else {
              slotIndex += 1;
              attempts += 1;
            }
          }

          if (!placed) {
            placeNode(neighbor.id, getNextRootPosition());
            enqueue(neighbor.id);
          }
        });
      }
    });

    const baseWidth = ITEM_WIDTH + FILE_PADDING * 2;
    const baseHeight = ITEM_MIN_HEIGHT + FILE_PADDING * 2;
    const maxWidth = fileBoxes.length > 0 ? Math.max(...fileBoxes.map(fb => fb.size.width)) : baseWidth;
    const maxHeight = fileBoxes.length > 0 ? Math.max(...fileBoxes.map(fb => fb.size.height)) : baseHeight;
    const stepX = maxWidth + Math.max(FILE_PADDING * 2, MIN_FILE_SPACING);
    const stepY = maxHeight + Math.max(FILE_PADDING * 2, MIN_VERTICAL_SPACING);

    let minGridX = 0;
    let minGridY = 0;
    let hasGridValues = false;

    gridPositions.forEach(pos => {
      if (!hasGridValues) {
        minGridX = pos.x;
        minGridY = pos.y;
        hasGridValues = true;
      } else {
        if (pos.x < minGridX) {
          minGridX = pos.x;
        }
        if (pos.y < minGridY) {
          minGridY = pos.y;
        }
      }
    });

    const offsetGridX = hasGridValues ? -minGridX : 0;
    const offsetGridY = hasGridValues ? -minGridY : 0;

    fileBoxes.forEach(fileBox => {
      const gridPos = gridPositions.get(fileBox.id) ?? { x: 0, y: 0 };
      fileBox.position = {
        x: BASE_MARGIN + (gridPos.x + offsetGridX) * stepX,
        y: BASE_MARGIN + (gridPos.y + offsetGridY) * stepY
      };
    });

    let maxX = 0;
    let maxY = 0;

    fileBoxes.forEach(fileBox => {
      const right = fileBox.position.x + fileBox.size.width;
      const bottom = fileBox.position.y + fileBox.size.height;
      if (right > maxX) {
        maxX = right;
      }
      if (bottom > maxY) {
        maxY = bottom;
      }
    });

    const connections: Connection[] = [];
    const edgeUsage = new Map<string, number>();

    pendingConnections.forEach(({ source, target, usedRef }) => {
      const sourceFile = fileBoxById.get(source.fileId);
      const targetFile = fileBoxById.get(target.fileId);
      if (!sourceFile || !targetFile) {
        return;
      }

      const goingLeft = targetFile.position.x < sourceFile.position.x;

      const fromPos = {
        x: goingLeft
          ? sourceFile.position.x + source.position.x
          : sourceFile.position.x + source.position.x + source.size.width,
        y: sourceFile.position.y + source.position.y + source.size.height / 2
      };

      const toPos = {
        x: goingLeft
          ? targetFile.position.x + target.position.x + target.size.width
          : targetFile.position.x + target.position.x,
        y: targetFile.position.y + target.position.y + target.size.height / 2
      };

      const usageKey = `${source.id}->${target.id}`;
      const usageIndex = edgeUsage.get(usageKey) ?? 0;
      edgeUsage.set(usageKey, usageIndex + 1);

      const methodSuffix =
        usedRef.targetMethods && usedRef.targetMethods.length > 0
          ? `.${usedRef.targetMethods.join(', ')}`
          : '';

      connections.push({
        from: source.id,
        to: target.id,
        fromPos,
        toPos,
        label: `${usedRef.sourceLabel} -> ${target.name}${methodSuffix} (${targetFile.displayName})`,
        pathOffset: computeEdgeOffset(usageIndex)
      });
    });

    return {
      fileBoxes,
      connections,
      canvasBounds: {
        width: Math.max(1200, maxX + BASE_MARGIN),
        height: Math.max(900, maxY + BASE_MARGIN)
      }
    };
  }, [data]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const svg = e.currentTarget.querySelector('svg') as SVGSVGElement | null;
    if (!svg || !canvasBounds) {
      return;
    }

    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const svgWidth = rect.width;
    const svgHeight = rect.height;

    const currentWidth = canvasBounds.width / zoom;
    const currentHeight = canvasBounds.height / zoom;

    const mouseWorldX = viewBoxX + (mouseX / svgWidth) * currentWidth;
    const mouseWorldY = viewBoxY + (mouseY / svgHeight) * currentHeight;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, zoom * delta);

    const newWidth = canvasBounds.width / newZoom;
    const newHeight = canvasBounds.height / newZoom;

    setZoom(newZoom);
    setViewBoxX(mouseWorldX - (mouseX / svgWidth) * newWidth);
    setViewBoxY(mouseWorldY - (mouseY / svgHeight) * newHeight);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) {
      return;
    }
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY, viewBoxX, viewBoxY });
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !canvasBounds) {
      return;
    }

    const svg = e.currentTarget.querySelector('svg') as SVGSVGElement | null;
    if (!svg) {
      return;
    }

    const rect = svg.getBoundingClientRect();
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    const scaleX = (canvasBounds.width / zoom) / rect.width;
    const scaleY = (canvasBounds.height / zoom) / rect.height;

    setViewBoxX(dragStart.viewBoxX - deltaX * scaleX);
    setViewBoxY(dragStart.viewBoxY - deltaY * scaleY);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (!data) {
    return <div className={styles.loading}>Loading visualization...</div>;
  }

  return (
    <div className={styles.container} onWheel={handleWheel}>
      <div className={styles.controls}>
        <button
          onClick={() => {
            if (!canvasBounds) {
              return;
            }
            const centerX = viewBoxX + (canvasBounds.width / zoom) / 2;
            const centerY = viewBoxY + (canvasBounds.height / zoom) / 2;
            const newZoom = zoom * 1.2;
            const newWidth = canvasBounds.width / newZoom;
            const newHeight = canvasBounds.height / newZoom;
            setZoom(newZoom);
            setViewBoxX(centerX - newWidth / 2);
            setViewBoxY(centerY - newHeight / 2);
          }}
        >
          Zoom In
        </button>
        <button
          onClick={() => {
            if (!canvasBounds) {
              return;
            }
            const centerX = viewBoxX + (canvasBounds.width / zoom) / 2;
            const centerY = viewBoxY + (canvasBounds.height / zoom) / 2;
            const newZoom = Math.max(0.1, zoom * 0.8);
            const newWidth = canvasBounds.width / newZoom;
            const newHeight = canvasBounds.height / newZoom;
            setZoom(newZoom);
            setViewBoxX(centerX - newWidth / 2);
            setViewBoxY(centerY - newHeight / 2);
          }}
        >
          Zoom Out
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setViewBoxX(0);
            setViewBoxY(0);
          }}
        >
          Reset
        </button>
        <span className={styles.zoomLevel}>{Math.round(zoom * 100)}%</span>
      </div>

      <div
        className={styles.canvasContainer}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          className={styles.canvas}
          width="100%"
          height="100%"
          viewBox={
            canvasBounds
              ? `${viewBoxX} ${viewBoxY} ${canvasBounds.width / zoom} ${canvasBounds.height / zoom}`
              : '0 0 2000 1200'
          }
        >
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
              <polygon points="0 0, 10 3, 0 6" fill="#64b5f6" />
            </marker>
          </defs>

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

          {fileBoxes.map(fileBox => (
            <g key={fileBox.id}>
              <rect
                x={fileBox.position.x}
                y={fileBox.position.y}
                width={fileBox.size.width}
                height={fileBox.size.height}
                className={styles.fileBox}
              />
              <text
                x={fileBox.position.x + fileBox.size.width / 2}
                y={fileBox.position.y + 20}
                className={styles.fileTitle}
                textAnchor="middle"
              >
                {fileBox.displayName}
              </text>

              {fileBox.items.map(item => {
                const itemX = fileBox.position.x + item.position.x;
                const itemY = fileBox.position.y + item.position.y;

                return (
                  <g key={item.id}>
                    <rect
                      x={itemX}
                      y={itemY}
                      width={item.size.width}
                      height={item.size.height}
                      className={item.type === 'class' ? styles.classBox : styles.functionBox}
                    />
                    <text x={itemX + 10} y={itemY + 22} className={styles.itemName}>
                      {item.name}
                    </text>
                    {item.args.length > 0 && (
                      <text x={itemX + 10} y={itemY + 40} className={styles.itemArgs}>
                        ({item.args.join(', ')})
                      </text>
                    )}
                    {item.type === 'class' && item.methods && (
                      <>
                        <line
                          x1={itemX}
                          y1={itemY + 48}
                          x2={itemX + item.size.width}
                          y2={itemY + 48}
                          className={styles.separator}
                        />
                        {item.methods.map((method, idx) => (
                          <text key={method} x={itemX + 10} y={itemY + 68 + idx * 24} className={styles.methodName}>
                            + {method}()
                          </text>
                        ))}
                      </>
                    )}
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

function createConnectionPath(from: Position, to: Position, offset: number = 0): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const absDx = Math.abs(dx);

  const angle = Math.atan2(dy, dx);
  const perpendicularAngle = angle + Math.PI / 2;
  const offsetX = Math.cos(perpendicularAngle) * offset;
  const offsetY = Math.sin(perpendicularAngle) * offset;

  const startX = from.x + offsetX;
  const startY = from.y + offsetY;
  const endX = to.x + offsetX;
  const endY = to.y + offsetY;

  if (absDx < 50) {
    return `M ${startX} ${startY} L ${endX} ${endY}`;
  }

  const controlDistance = Math.min(absDx * 0.5, 240);
  const controlX1 = startX + (dx > 0 ? controlDistance : -controlDistance);
  const controlX2 = endX - (dx > 0 ? controlDistance : -controlDistance);

  return `M ${startX} ${startY} C ${controlX1} ${startY}, ${controlX2} ${endY}, ${endX} ${endY}`;
}

function getMidPoint(from: Position, to: Position): Position {
  return {
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2
  };
}
