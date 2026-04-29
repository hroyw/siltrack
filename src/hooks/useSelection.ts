import { useMemo } from 'react';
import type { AllData, CorrelationMap, Series } from '../types';
import { pickTopRelatedStocks } from '../lib/insight';

export interface RankedSeries {
  series: Series;
  corr: number;
}

export interface Selection {
  primary: Series | null;
  upstream: Series | null;
  topPeer: Series | null;
  upstreamCorr: number | null;
  topPeerCorr: number | null;
  topPeers: RankedSeries[];
}

const TOP_N = 3;

const empty: Selection = {
  primary: null,
  upstream: null,
  topPeer: null,
  upstreamCorr: null,
  topPeerCorr: null,
  topPeers: [],
};

function peersForCommodity(
  primary: Series,
  byId: Map<string, Series>,
  corr60: CorrelationMap,
): RankedSeries[] {
  return pickTopRelatedStocks(primary.id, primary.relatedStocks, corr60, TOP_N)
    .map((r) => {
      const s = byId.get(r.id);
      return s ? { series: s, corr: r.corr } : null;
    })
    .filter((x): x is RankedSeries => x !== null);
}

function peersForStock(
  primary: Series,
  allSeries: Series[],
  corr60: CorrelationMap,
): RankedSeries[] {
  const items: RankedSeries[] = [];
  for (const s of allSeries) {
    if (s.type === 'stock') continue;
    if (!s.relatedStocks.includes(primary.id)) continue;
    const c = corr60[s.id]?.[primary.id];
    if (c === null || c === undefined || Number.isNaN(c)) continue;
    items.push({ series: s, corr: c });
  }
  items.sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr));
  return items.slice(0, TOP_N);
}

export function computeSelection(all: AllData, nodeId: string): Selection {
  const byId = new Map(all.series.map((s) => [s.id, s]));
  const primary = byId.get(nodeId) ?? null;
  if (!primary) return empty;

  const upstream = primary.upstream ? byId.get(primary.upstream) ?? null : null;
  const corr60 = all.correlations['60'] ?? {};
  const upstreamCorr = upstream ? corr60[primary.id]?.[upstream.id] ?? null : null;

  const topPeers =
    primary.type === 'stock'
      ? peersForStock(primary, all.series, corr60)
      : peersForCommodity(primary, byId, corr60);

  const topPeer = topPeers[0]?.series ?? null;
  const topPeerCorr = topPeers[0]?.corr ?? null;

  return { primary, upstream, topPeer, upstreamCorr, topPeerCorr, topPeers };
}

export function useSelection(all: AllData | null, nodeId: string | null): Selection | null {
  return useMemo(() => {
    if (!all || !nodeId) return null;
    return computeSelection(all, nodeId);
  }, [all, nodeId]);
}
