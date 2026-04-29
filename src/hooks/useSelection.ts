import { useMemo } from 'react';
import type { AllData, Series } from '../types';
import { pickTopRelatedStock } from '../lib/insight';

export interface Selection {
  primary: Series | null;
  upstream: Series | null;
  topStock: Series | null;
  upstreamCorr: number | null;
  topStockCorr: number | null;
}

export function computeSelection(all: AllData, nodeId: string): Selection {
  const byId = new Map(all.series.map((s) => [s.id, s]));
  const primary = byId.get(nodeId) ?? null;
  if (!primary) return { primary: null, upstream: null, topStock: null, upstreamCorr: null, topStockCorr: null };

  const upstream = primary.upstream ? byId.get(primary.upstream) ?? null : null;
  const corr60 = all.correlations['60'] ?? {};
  const upstreamCorr = upstream ? corr60[primary.id]?.[upstream.id] ?? null : null;

  const topStockId = pickTopRelatedStock(primary.id, primary.relatedStocks, corr60);
  const topStock = topStockId ? byId.get(topStockId) ?? null : null;
  const topStockCorr = topStockId ? corr60[primary.id]?.[topStockId] ?? null : null;

  return { primary, upstream, topStock, upstreamCorr, topStockCorr };
}

export function useSelection(all: AllData | null, nodeId: string | null): Selection | null {
  return useMemo(() => {
    if (!all || !nodeId) return null;
    return computeSelection(all, nodeId);
  }, [all, nodeId]);
}
