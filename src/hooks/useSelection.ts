import { useMemo } from 'react';
import type { AllData, Series } from '../types';
import { pickTopRelatedStocks } from '../lib/insight';

export interface RankedStockSeries {
  series: Series;
  corr: number;
}

export interface Selection {
  primary: Series | null;
  upstream: Series | null;
  topStock: Series | null;
  upstreamCorr: number | null;
  topStockCorr: number | null;
  topStocks: RankedStockSeries[];
}

const TOP_N = 3;

const empty: Selection = {
  primary: null,
  upstream: null,
  topStock: null,
  upstreamCorr: null,
  topStockCorr: null,
  topStocks: [],
};

export function computeSelection(all: AllData, nodeId: string): Selection {
  const byId = new Map(all.series.map((s) => [s.id, s]));
  const primary = byId.get(nodeId) ?? null;
  if (!primary) return empty;

  const upstream = primary.upstream ? byId.get(primary.upstream) ?? null : null;
  const corr60 = all.correlations['60'] ?? {};
  const upstreamCorr = upstream ? corr60[primary.id]?.[upstream.id] ?? null : null;

  const ranked = pickTopRelatedStocks(primary.id, primary.relatedStocks, corr60, TOP_N);
  const topStocks: RankedStockSeries[] = ranked
    .map((r) => {
      const series = byId.get(r.id);
      return series ? { series, corr: r.corr } : null;
    })
    .filter((x): x is RankedStockSeries => x !== null);

  const topStock = topStocks[0]?.series ?? null;
  const topStockCorr = topStocks[0]?.corr ?? null;

  return { primary, upstream, topStock, upstreamCorr, topStockCorr, topStocks };
}

export function useSelection(all: AllData | null, nodeId: string | null): Selection | null {
  return useMemo(() => {
    if (!all || !nodeId) return null;
    return computeSelection(all, nodeId);
  }, [all, nodeId]);
}
