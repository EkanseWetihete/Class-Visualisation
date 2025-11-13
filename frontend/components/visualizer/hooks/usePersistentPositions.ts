import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEY } from '../constants';
import { Position } from '../types';

type PositionMap = Record<string, Position>;

const readStore = (): Record<string, PositionMap> => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, PositionMap>) : {};
  } catch (error) {
    console.warn('Failed to parse stored positions', error);
    return {};
  }
};

const writeStore = (store: Record<string, PositionMap>) => {
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

  useEffect(() => {
    if (!versionKey) {
      setPositions({});
      return;
    }

    const store = readStore();
    setPositions(store[versionKey] ?? {});
  }, [versionKey]);

  const updatePositions = useCallback(
    (updater: PositionMap | ((prev: PositionMap) => PositionMap)) => {
      if (!versionKey) {
        setPositions(typeof updater === 'function' ? (updater as (prev: PositionMap) => PositionMap)({}) : updater);
        return;
      }

      setPositions(prev => {
        const next = typeof updater === 'function' ? (updater as (prev: PositionMap) => PositionMap)(prev) : updater;
        const store = readStore();
        store[versionKey] = next;
        writeStore(store);
        return next;
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
    delete store[versionKey];
    writeStore(store);
    setPositions({});
  }, [versionKey]);

  return { positions, updatePosition, resetPositions };
}
