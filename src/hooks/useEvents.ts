import { useEffect, useState } from 'react';
import type { EventsData } from '../types';

interface State {
  data: EventsData | null;
  loading: boolean;
  error: Error | null;
}

const EVENTS_URL = `${import.meta.env.BASE_URL}data/events.json`;

export function useEvents(): State {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    fetch(EVENTS_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<EventsData>;
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
