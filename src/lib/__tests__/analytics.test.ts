import { describe, it, expect } from 'vitest';
import { sliceByRange, normalizeFromBase, latestChange, RANGE_DAYS } from '../analytics';
import type { DataPoint } from '../../types';

const points: DataPoint[] = Array.from({ length: 400 }, (_, i) => {
  const d = new Date(2024, 0, 1);
  d.setDate(d.getDate() + i);
  return { date: d.toISOString().slice(0, 10), value: 100 + i };
});

describe('RANGE_DAYS', () => {
  it('maps to known day counts', () => {
    expect(RANGE_DAYS['1M']).toBe(30);
    expect(RANGE_DAYS['1Y']).toBe(365);
    expect(RANGE_DAYS.ALL).toBe(Infinity);
  });
});

describe('sliceByRange', () => {
  it('returns last N days when range is bounded', () => {
    const out = sliceByRange(points, '1M');
    expect(out.length).toBeLessThanOrEqual(31);
    expect(out[out.length - 1]).toEqual(points[points.length - 1]);
  });

  it('returns all points for ALL', () => {
    expect(sliceByRange(points, 'ALL').length).toBe(points.length);
  });

  it('returns empty when given empty', () => {
    expect(sliceByRange([], '1Y')).toEqual([]);
  });
});

describe('normalizeFromBase', () => {
  it('first point is 100', () => {
    const out = normalizeFromBase(points.slice(0, 5));
    expect(out[0].value).toBe(100);
  });

  it('preserves ratio', () => {
    const sample: DataPoint[] = [
      { date: '2024-01-01', value: 50 },
      { date: '2024-01-02', value: 75 },
      { date: '2024-01-03', value: 100 },
    ];
    const out = normalizeFromBase(sample);
    expect(out[1].value).toBeCloseTo(150, 6);
    expect(out[2].value).toBeCloseTo(200, 6);
  });

  it('returns empty when input empty', () => {
    expect(normalizeFromBase([])).toEqual([]);
  });

  it('handles zero base by returning unchanged values', () => {
    const sample: DataPoint[] = [
      { date: '2024-01-01', value: 0 },
      { date: '2024-01-02', value: 5 },
    ];
    const out = normalizeFromBase(sample);
    expect(out).toEqual(sample);
  });
});

describe('latestChange', () => {
  it('returns last value and day-over-day change percent', () => {
    const sample: DataPoint[] = [
      { date: '2024-01-01', value: 100 },
      { date: '2024-01-02', value: 110 },
    ];
    expect(latestChange(sample)).toEqual({ value: 110, changePct: 10 });
  });

  it('returns null when fewer than 2 points', () => {
    expect(latestChange([])).toBeNull();
    expect(latestChange([{ date: '2024-01-01', value: 1 }])).toBeNull();
  });
});
