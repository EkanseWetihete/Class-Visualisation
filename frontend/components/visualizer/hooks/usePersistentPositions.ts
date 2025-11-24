import { useCallback, useEffect, useMemo, useState } from 'react';
import { STORAGE_KEY } from '../constants';
import { Position } from '../types';

export type PositionMap = Record<string, Position>;

export interface SavedLayoutRecord {
  id: string;
  name: string;
  dataFile: string;
  versionKey: string | null;
  createdAt: number;
  updatedAt: number;
  positions: PositionMap;
}

export interface SavedLayoutSummary {
  id: string;
  name: string;
  dataFile: string;
  versionKey: string | null;
  createdAt: number;
  updatedAt: number;
}

interface LayoutStore {
  drafts: Record<string, PositionMap>;
  layouts: Record<string, SavedLayoutRecord>;
}

const createEmptyStore = (): LayoutStore => ({ drafts: {}, layouts: {} });

const normalizeStore = (raw: unknown): LayoutStore => {
  if (!raw || typeof raw !== 'object') {
    return createEmptyStore();
  }

  const candidate = raw as Partial<LayoutStore>;
  return {
    drafts: { ...(candidate.drafts ?? {}) },
    layouts: { ...(candidate.layouts ?? {}) }
  };
};

const readStore = (): LayoutStore => {
  if (typeof window === 'undefined') {
    return createEmptyStore();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeStore(JSON.parse(raw)) : createEmptyStore();
  } catch (error) {
    console.warn('Failed to parse stored positions', error);
    return createEmptyStore();
  }
};

const writeStore = (store: LayoutStore) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    console.warn('Failed to persist positions', error);
  }
};

const toSummary = (record: SavedLayoutRecord): SavedLayoutSummary => {
  const { positions, ...rest } = record;
  return rest;
};

const sortSummaries = (records: SavedLayoutRecord[]): SavedLayoutSummary[] =>
  records
    .map(toSummary)
    .sort((a, b) => b.updatedAt - a.updatedAt);

const makeScopeKey = (dataFile: string, versionKey: string | null) =>
  `${dataFile || 'default'}::${versionKey ?? 'pending'}`;

const createId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `layout-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export function usePersistentPositions(versionKey: string | null, dataFile: string) {
  const scopeKey = useMemo(() => makeScopeKey(dataFile, versionKey), [dataFile, versionKey]);
  const [positions, setPositions] = useState<PositionMap>({});
  const [layouts, setLayouts] = useState<SavedLayoutSummary[]>([]);

  const refreshLayouts = useCallback(() => {
    const store = readStore();
    setLayouts(sortSummaries(Object.values(store.layouts ?? {})));
  }, []);

  useEffect(() => {
    const store = readStore();
    setPositions(store.drafts[scopeKey] ?? {});
    setLayouts(sortSummaries(Object.values(store.layouts ?? {})));
  }, [scopeKey]);

  const persistDraft = useCallback(
    (next: PositionMap) => {
      const store = readStore();
      store.drafts[scopeKey] = next;
      writeStore(store);
    },
    [scopeKey]
  );

  const updatePositions = useCallback(
    (updater: PositionMap | ((prev: PositionMap) => PositionMap)) => {
      setPositions(prev => {
        const next = typeof updater === 'function' ? (updater as (prev: PositionMap) => PositionMap)(prev) : updater;
        persistDraft(next);
        return next;
      });
    },
    [persistDraft]
  );

  const updatePositionsBatch = useCallback(
    (updates: PositionMap) => {
      updatePositions(prev => ({
        ...prev,
        ...updates
      }));
    },
    [updatePositions]
  );

  const updatePosition = useCallback(
    (filePath: string, position: Position) => {
      updatePositions(prev => ({
        ...prev,
        [filePath]: position
      }));
    },
    [updatePositions]
  );

  const applyPositions = useCallback(
    (next: PositionMap) => {
      setPositions(next);
      persistDraft(next);
    },
    [persistDraft]
  );

  const resetPositions = useCallback(() => {
    const store = readStore();
    delete store.drafts[scopeKey];
    writeStore(store);
    setPositions({});
  }, [scopeKey]);

  const saveLayout = useCallback(
    (name: string) => {
      const trimmedName = name.trim() || 'Untitled Layout';
      const store = readStore();
      const id = createId();
      const timestamp = Date.now();
      store.layouts[id] = {
        id,
        name: trimmedName,
        dataFile,
        versionKey,
        createdAt: timestamp,
        updatedAt: timestamp,
        positions
      };
      writeStore(store);
      setLayouts(sortSummaries(Object.values(store.layouts ?? {})));
      return id;
    },
    [dataFile, positions, versionKey]
  );

  const importLayout = useCallback(
    (payload: {
      id?: string;
      name: string;
      dataFile: string;
      versionKey: string | null;
      positions: PositionMap;
      createdAt?: number;
      updatedAt?: number;
    }) => {
      const store = readStore();
      const id = payload.id ?? createId();
      const createdAt = payload.createdAt ?? Date.now();
      const updatedAt = payload.updatedAt ?? Date.now();
      store.layouts[id] = {
        id,
        name: payload.name.trim() || 'Imported Layout',
        dataFile: payload.dataFile,
        versionKey: payload.versionKey,
        createdAt,
        updatedAt,
        positions: payload.positions
      };
      writeStore(store);
      setLayouts(sortSummaries(Object.values(store.layouts ?? {})));
      return id;
    },
    []
  );

  const deleteLayout = useCallback((layoutId: string) => {
    const store = readStore();
    if (!store.layouts[layoutId]) {
      return false;
    }
    delete store.layouts[layoutId];
    writeStore(store);
    setLayouts(sortSummaries(Object.values(store.layouts ?? {})));
    return true;
  }, []);

  const getLayoutById = useCallback((layoutId: string): SavedLayoutRecord | null => {
    const store = readStore();
    return store.layouts[layoutId] ?? null;
  }, []);

  return {
    positions,
    updatePosition,
    updatePositionsBatch,
    applyPositions,
    resetPositions,
    saveLayout,
    deleteLayout,
    getLayoutById,
    importLayout,
    layouts
  };
}
