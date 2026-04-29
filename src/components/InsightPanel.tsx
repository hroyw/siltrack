import type { Selection } from '../hooks/useSelection';
import { generateInsight } from '../lib/insight';

interface Props {
  selection: Selection;
}

export function InsightPanel({ selection }: Props) {
  if (!selection.primary) return null;
  const text = generateInsight({
    nodeName: selection.primary.name,
    upstreamName: selection.upstream?.name ?? null,
    upstreamCorr: selection.upstreamCorr,
    stockName: selection.topStock?.name ?? null,
    stockCorr: selection.topStockCorr,
  });
  return (
    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      💡 {text}
    </div>
  );
}
