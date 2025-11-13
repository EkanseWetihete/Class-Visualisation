import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEY } from '../constants';
import { Position } from '../types';

type PositionMap = Record<string, Position>;

interface StoredLayouts {
  versions: Record<string, PositionMap>;
  snapshots: Record<string, PositionMap>;
}

const createEmptyStore = (): StoredLayouts => ({ versions: {}, snapshots: {} });

const normalizeStore = (raw: unknown): StoredLayouts => {
  if (!raw || typeof raw !== 'object') {
    return createEmptyStore();
  }

  const candidate = raw as Partial<StoredLayouts> & Record<string, PositionMap>;
  if ('versions' in candidate || 'snapshots' in candidate) {
    return {
      versions: { ...(candidate.versions ?? {}) },
      snapshots: { ...(candidate.snapshots ?? {}) }
    };
  }

  return {
    versions: { ...(raw as Record<string, PositionMap>) },
    snapshots: {}
  };
};

const readStore = (): StoredLayouts => {
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

const writeStore = (store: StoredLayouts) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    console.warn('Failed to persist positions', error);
  }
};

export function usePersistentPositions(versionKey: string | null) {
  const [positions, setPositions] = useState<PositionMap>({});
  const [hasSnapshot, setHasSnapshot] = useState(false);

  useEffect(() => {
    if (!versionKey) {
      setPositions({});
      setHasSnapshot(false);
      return;
    }

    const store = readStore();
    setPositions(store.versions[versionKey] ?? {});
    setHasSnapshot(Boolean(store.snapshots[versionKey]));
  }, [versionKey]);

  const updatePositions = useCallback(
    (updater: PositionMap | ((prev: PositionMap) => PositionMap)) => {
      setPositions(prev => {
        const base = typeof updater === 'function' ? (updater as (prev: PositionMap) => PositionMap)(prev) : updater;
        if (!versionKey) {
          return base;
        }
        const store = readStore();
        store.versions[versionKey] = base;
        writeStore(store);
        return base;
      });
    },
    [versionKey]
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

  const resetPositions = useCallback(() => {
    if (!versionKey) {
      setPositions({});
      return;
    }

    const store = readStore();
    delete store.versions[versionKey];
    writeStore(store);
    setPositions({});
  }, [versionKey]);

  const saveSnapshot = useCallback(() => {
    if (!versionKey) {
      return false;
    }
    const store = readStore();
    store.snapshots[versionKey] = positions;
    writeStore(store);
    setHasSnapshot(true);
    return true;
  }, [positions, versionKey]);

  const loadSnapshot = useCallback(() => {
    if (!versionKey) {
      return false;
    }
    const store = readStore();
    const snapshot = store.snapshots[versionKey];
    if (!snapshot) {
      return false;
    }
    store.versions[versionKey] = snapshot;
    writeStore(store);
    setPositions(snapshot);
    setHasSnapshot(true);
    return true;
  }, [versionKey]);

  return { positions, updatePosition, resetPositions, saveSnapshot, loadSnapshot, hasSnapshot };
}
