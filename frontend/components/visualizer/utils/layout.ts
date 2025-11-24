import {
  BASE_MARGIN,
  FILE_PADDING,
  ITEM_MIN_HEIGHT,
  ITEM_PADDING,
  ITEM_WIDTH,
  MIN_FILE_SPACING,
  MIN_VERTICAL_SPACING
} from '../constants';
import {
  computeEdgeOffset,
  getOffsetForIndex,
  moduleKeyFromPath,
  sanitizeModulePath
} from './geometry';
import {
  ConnectionPlan,
  ConnectionRender,
  DataItem,
  FileBox,
  FileMeta,
  ItemBox,
  OutputData,
  Position,
  Size,
  UsedReference,
  VisualizerLayout
} from '../types';

const DEFAULT_BOUNDS: Size = { width: 2000, height: 1200 };

export function buildVisualizerLayout(data: OutputData | null): VisualizerLayout {
  if (!data) {
    return {
      fileBoxes: [],
      connections: [],
      canvasBounds: DEFAULT_BOUNDS
    };
  }

  const fileMetaMap = (data.file_meta ?? data.fileMeta ?? {}) as Record<string, FileMeta | undefined>;
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
    usedFunctions: Record<string, unknown> | undefined,
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
    const pathSegments = filePath.split(/[/\\]/);
    const displayName = pathSegments.slice(-2).join('/');
    const metaForFile = fileMetaMap[filePath];
    const isRouter = Boolean(metaForFile?.is_router ?? metaForFile?.isRouter);

    const items: ItemBox[] = [];
    let itemYOffset = FILE_PADDING + (isRouter ? 18 : 0);

    Object.entries(fileData).forEach(([itemName, itemData]) => {
      const itemId = `${fileId}-${itemName}`;
      const isClass = !!itemData.methods;
      const isApiEndpoint = Boolean((itemData as DataItem)['is_api_endpoint'] ?? itemData.isApiEndpoint);

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
        args: itemData.args ?? [],
        methods,
        isApiEndpoint,
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
      isRouter,
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

        for (const items of moduleMap.values()) {
          for (const candidate of items) {
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
          }
        }

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

  const connections: ConnectionPlan[] = [];
  const edgeUsage = new Map<string, number>();

  pendingConnections.forEach(({ source, target, usedRef }) => {
    const sourceFile = fileBoxById.get(source.fileId);
    const targetFile = fileBoxById.get(target.fileId);
    if (!sourceFile || !targetFile) {
      return;
    }

    const usageKey = `${source.id}->${target.id}`;
    const usageIndex = edgeUsage.get(usageKey) ?? 0;
    edgeUsage.set(usageKey, usageIndex + 1);
    const connectionId = `${source.id}->${target.id}#${usageIndex}`;

    const methodSuffix =
      usedRef.targetMethods && usedRef.targetMethods.length > 0
        ? `.${usedRef.targetMethods.join(', ')}`
        : '';

    connections.push({
      id: connectionId,
      from: {
        fileId: source.fileId,
        filePath: source.filePath,
        itemId: source.id,
        relativePosition: source.position,
        size: source.size
      },
      to: {
        fileId: target.fileId,
        filePath: target.filePath,
        itemId: target.id,
        relativePosition: target.position,
        size: target.size
      },
      label: `${usedRef.sourceLabel} -> ${target.name}${methodSuffix} (${targetFile.displayName})`,
      pathOffset: computeEdgeOffset(usageIndex)
    });
  });

  const canvasBounds = computeCanvasBounds(fileBoxes);

  return {
    fileBoxes,
    connections,
    canvasBounds
  };
}

export function applyCustomPositions(fileBoxes: FileBox[], customPositions: Record<string, Position>): FileBox[] {
  if (!fileBoxes.length) {
    return fileBoxes;
  }

  return fileBoxes.map(box => {
    const override = customPositions[box.path];
    if (!override) {
      return box;
    }
    return { ...box, position: override };
  });
}

export function computeConnectionPositions(
  plans: ConnectionPlan[],
  fileBoxes: FileBox[]
): ConnectionRender[] {
  if (!plans.length || !fileBoxes.length) {
    return [];
  }

  const fileMap = new Map(fileBoxes.map(box => [box.id, box]));

  return plans
    .map(plan => {
      const sourceFile = fileMap.get(plan.from.fileId);
      const targetFile = fileMap.get(plan.to.fileId);
      if (!sourceFile || !targetFile) {
        return null;
      }

      const sourceItemBase = {
        x: sourceFile.position.x + plan.from.relativePosition.x,
        y: sourceFile.position.y + plan.from.relativePosition.y
      };
      const targetItemBase = {
        x: targetFile.position.x + plan.to.relativePosition.x,
        y: targetFile.position.y + plan.to.relativePosition.y
      };

      const goingLeft = targetFile.position.x < sourceFile.position.x;

      const fromPos = {
        x: goingLeft ? sourceItemBase.x : sourceItemBase.x + plan.from.size.width,
        y: sourceItemBase.y + plan.from.size.height / 2
      };

      const toPos = {
        x: goingLeft ? targetItemBase.x + plan.to.size.width : targetItemBase.x,
        y: targetItemBase.y + plan.to.size.height / 2
      };

      return {
        id: plan.id,
        from: plan.from.itemId,
        to: plan.to.itemId,
        fromPos,
        toPos,
        label: plan.label,
        pathOffset: plan.pathOffset
      };
    })
    .filter((conn): conn is ConnectionRender => conn !== null);
}

export function computeCanvasBounds(fileBoxes: FileBox[]): Size {
  if (!fileBoxes.length) {
    return DEFAULT_BOUNDS;
  }

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

  return {
    width: Math.max(1200, maxX + BASE_MARGIN),
    height: Math.max(900, maxY + BASE_MARGIN)
  };
}
