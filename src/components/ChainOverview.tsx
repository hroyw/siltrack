import type { AllData } from '../types';
import { BRANCH_ORDER } from '../lib/chain';
import { BranchSection } from './BranchSection';

interface Props {
  data: AllData;
  selectedId: string | null;
  upstreamId: string | null;
  topStockId: string | null;
  onSelect: (id: string) => void;
}

export function ChainOverview({ data, selectedId, upstreamId, topStockId, onSelect }: Props) {
  return (
    <div>
      {BRANCH_ORDER.map((b) => {
        const series = data.series.filter((s) => s.branch === b);
        if (series.length === 0) return null;
        return (
          <BranchSection
            key={b}
            branch={b}
            series={series}
            selectedId={selectedId}
            upstreamId={upstreamId}
            topStockId={topStockId}
            onSelect={onSelect}
          />
        );
      })}
    </div>
  );
}
