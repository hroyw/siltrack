import type { CorrelationMap } from '../types';

export function classifyCorrelation(r: number | null): string {
  if (r === null || Number.isNaN(r)) return '数据不足';
  const a = Math.abs(r);
  const sign = r >= 0 ? '正' : '负';
  if (a >= 0.7) return `强${sign}相关`;
  if (a >= 0.4) return `中等${sign}相关`;
  return '弱相关';
}

export interface RankedStock {
  id: string;
  corr: number;
}

export function pickTopRelatedStocks(
  nodeId: string,
  candidates: string[],
  corr60: CorrelationMap,
  n: number = 3,
): RankedStock[] {
  const row = corr60[nodeId] ?? {};
  const ranked: RankedStock[] = [];
  for (const c of candidates) {
    const r = row[c];
    if (r === null || r === undefined || Number.isNaN(r)) continue;
    ranked.push({ id: c, corr: r });
  }
  ranked.sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr));
  return ranked.slice(0, n);
}

export function pickTopRelatedStock(
  nodeId: string,
  candidates: string[],
  corr60: CorrelationMap,
): string | null {
  const top = pickTopRelatedStocks(nodeId, candidates, corr60, 1);
  return top[0]?.id ?? null;
}

export interface InsightInput {
  nodeName: string;
  upstreamName: string | null;
  upstreamCorr: number | null;
  peers: { name: string; corr: number }[];
  peerLabel: string;
}

export function generateInsight(i: InsightInput): string {
  const parts: string[] = [];
  if (i.upstreamName && i.upstreamCorr !== null) {
    parts.push(
      `与上游 ${i.upstreamName} 60日相关性 ${i.upstreamCorr.toFixed(2)}（${classifyCorrelation(i.upstreamCorr)}）`,
    );
  }
  if (i.peers.length > 0) {
    const peerText = i.peers.map((p) => `${p.name} ${p.corr.toFixed(2)}`).join(' · ');
    const label = i.peers.length === 1 ? i.peerLabel : `${i.peerLabel} Top${i.peers.length}`;
    parts.push(`${label}：${peerText}`);
  }
  if (parts.length === 0) return `${i.nodeName} 暂无足够数据生成解读`;
  return `${i.nodeName} ${parts.join('；')}`;
}
