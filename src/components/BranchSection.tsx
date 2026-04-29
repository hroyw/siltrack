import type { Series, Branch } from '../types';
import { ChainCard, type CardState } from './ChainCard';
import { BRANCH_LABELS } from '../lib/chain';

interface Props {
  branch: Branch;
  series: Series[];
  selectedId: string | null;
  upstreamId: string | null;
  topStockId: string | null;
  onSelect: (id: string) => void;
}

export function BranchSection({ branch, series, selectedId, upstreamId, topStockId, onSelect }: Props) {
  const ordered = [...series].sort((a, b) => {
    const order = { futures: 0, spot: 1, stock: 2 } as const;
    return order[a.type] - order[b.type];
  });

  function stateOf(id: string): CardState {
    if (id === selectedId) return 'selected';
    if (id === upstreamId || id === topStockId) return 'related';
    return 'default';
  }

  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-semibold text-gray-700">▎ {BRANCH_LABELS[branch]}</h2>
      <div className="flex flex-wrap gap-2">
        {ordered.map((s) => (
          <ChainCard key={s.id} series={s} state={stateOf(s.id)} onClick={onSelect} />
        ))}
      </div>
    </section>
  );
}
