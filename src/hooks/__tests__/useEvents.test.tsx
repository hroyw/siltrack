import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useEvents } from '../useEvents';

const sample = {
  generated_at: '2026-04-29T00:00:00Z',
  sources: {
    cninfo: { ok: true, last_success_at: '2026-04-29T00:00:00Z', stale_days: 0, error: null, lag_note: null },
    gfex: { ok: true, last_success_at: '2026-04-29T00:00:00Z', stale_days: 0, error: null, lag_note: null },
    customs: { ok: true, last_success_at: '2026-04-15T00:00:00Z', stale_days: 14, error: null, lag_note: '海关数据滞后...' },
  },
  events: [
    { id: 'a', date: '2026-04-28', source: 'cninfo', source_label: '巨潮资讯',
      title: 't', url: '', event_type: 'other', related_nodes: ['SI'],
      summary: null, raw_text_excerpt: '' },
  ],
};

beforeEach(() => {
  // @ts-expect-error - test stub
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(sample) }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useEvents', () => {
  it('fetches events.json and returns events', async () => {
    const { result } = renderHook(() => useEvents());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.events).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('reports error on failed fetch but does not throw', async () => {
    // @ts-expect-error
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 404 }));
    const { result } = renderHook(() => useEvents());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeTruthy();
  });
});
