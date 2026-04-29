import { useEffect, useState } from 'react';
import type { AllData } from '../types';

interface State {
  data: AllData | null;
  loading: boolean;
  error: Error | null;
}

const DATA_URL = `${import.meta.env.BASE_URL}data/all.json`;

export function useAllData(): State {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    fetch(DATA_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<AllData>;
      })
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ data: null, loading: false, error: error as Error });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
