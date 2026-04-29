import type { CorrelationMap } from '../types';

export function classifyCorrelation(r: number | null): string {
  if (r === null || Number.isNaN(r)) return '数据不足';
  const a = Math.abs(r);
  const sign = r >= 0 ? '正' : '负';
  if (a >= 0.7) return `强${sign}相关`;
  if (a >= 0.4) return `中等${sign}相关`;
  return '弱相关';
}

export function pickTopRelatedStock(
  nodeId: string,
  candidates: string[],
  corr60: CorrelationMap,
): string | null {
  const row = corr60[nodeId] ?? {};
  let best: string | null = null;
  let bestAbs = -1;
  for (const c of candidates) {
    const r = row[c];
    if (r === null || r === undefined) continue;
    const a = Math.abs(r);
    if (a > bestAbs) {
      bestAbs = a;
      best = c;
    }
  }
  return best;
}

export interface InsightInput {
  nodeName: string;
  upstreamName: string | null;
  upstreamCorr: number | null;
  stockName: string | null;
  stockCorr: number | null;
}

export function generateInsight(i: InsightInput): string {
  const parts: string[] = [];
  if (i.upstreamName && i.upstreamCorr !== null) {
    parts.push(
      `${i.nodeName} 与上游 ${i.upstreamName} 60日相关性 ${i.upstreamCorr.toFixed(2)}（${classifyCorrelation(i.upstreamCorr)}）`,
    );
  }
  if (i.stockName && i.stockCorr !== null) {
    parts.push(
      `关联股票 ${i.stockName} 相关性 ${i.stockCorr.toFixed(2)}（${classifyCorrelation(i.stockCorr)}）`,
    );
  }
  if (parts.length === 0) return `${i.nodeName} 暂无足够数据生成解读`;
  return parts.join('；');
}
