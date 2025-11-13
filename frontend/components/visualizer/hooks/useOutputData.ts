import { useCallback, useEffect, useRef, useState } from 'react';
import { POLLING_INTERVAL_MS } from '../constants';
import { OutputData } from '../types';

interface OutputState {
  data: OutputData | null;
  versionKey: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error?: string;
  lastUpdated?: number;
}

export function useOutputData(pollInterval: number = POLLING_INTERVAL_MS) {
  const [state, setState] = useState<OutputState>({
    data: null,
    versionKey: null,
    status: 'idle'
  });

  const pollTimer = useRef<number | null>(null);

  const runFetch = useCallback(
    async (force = false) => {
      setState(prev => ({
        ...prev,
        status: prev.data && !force ? prev.status : 'loading',
        error: undefined
      }));

      try {
        const response = await fetch(`/api/output?ts=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Failed to load output.json');
        }
        const payload: OutputData = await response.json();
        const meta = payload._meta;
        const nextVersion = meta?.version ?? `${meta?.lastModified ?? Date.now()}`;

        setState(prev => {
          if (!force && prev.versionKey === nextVersion && prev.data) {
            return { ...prev, status: 'ready', lastUpdated: Date.now() };
          }

          return {
            data: payload,
            versionKey: nextVersion,
            status: 'ready',
            error: undefined,
            lastUpdated: Date.now()
          };
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setState(prev => ({
          ...prev,
          status: prev.data ? 'ready' : 'error',
          error: message
        }));
      }
    },
    []
  );

  useEffect(() => {
    runFetch(true);
  }, [runFetch]);

  useEffect(() => {
    if (pollTimer.current) {
      window.clearInterval(pollTimer.current);
    }
    if (pollInterval <= 0) {
      return () => undefined;
    }

    pollTimer.current = window.setInterval(() => {
      runFetch(false);
    }, pollInterval);

    return () => {
      if (pollTimer.current) {
        window.clearInterval(pollTimer.current);
      }
    };
  }, [pollInterval, runFetch]);

  const manualRefresh = useCallback(() => runFetch(true), [runFetch]);

  return { ...state, refresh: manualRefresh };
}
