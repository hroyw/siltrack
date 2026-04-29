import type { DataPoint, TimeRange } from '../types';

export const RANGE_DAYS: Record<TimeRange, number> = {
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365,
  '3Y': 365 * 3,
  ALL: Infinity,
};

export function sliceByRange(points: DataPoint[], range: TimeRange): DataPoint[] {
  if (points.length === 0) return points;
  const days = RANGE_DAYS[range];
  if (!Number.isFinite(days)) return points;
  const cutoffMs = new Date(points[points.length - 1].date).getTime() - days * 86400_000;
  return points.filter((p) => new Date(p.date).getTime() >= cutoffMs);
}

export function normalizeFromBase(points: DataPoint[]): DataPoint[] {
  if (points.length === 0) return points;
  const base = points[0].value;
  if (base === 0) return points;
  return points.map((p) => ({ date: p.date, value: (p.value / base) * 100 }));
}

export function latestChange(points: DataPoint[]): { value: number; changePct: number } | null {
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const changePct = prev.value === 0 ? 0 : ((last.value - prev.value) / prev.value) * 100;
  return { value: last.value, changePct };
}
