import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAllData } from '../useAllData';

const sample = {
  generatedAt: '2026-04-29T00:00:00Z',
  series: [{ id: 'SI', name: '工业硅', branch: 'photovoltaic', type: 'futures', unit: '¥/吨',
              upstream: null, relatedStocks: [], points: [] }],
  correlations: { '30': {}, '60': {} },
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

describe('useAllData', () => {
  it('fetches and returns data', async () => {
    const { result } = renderHook(() => useAllData());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.series.length).toBe(1);
    expect(result.current.error).toBeNull();
  });

  it('reports error on failed fetch', async () => {
    // @ts-expect-error
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 404 }));
    const { result } = renderHook(() => useAllData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeTruthy();
  });
});
