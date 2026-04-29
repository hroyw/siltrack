import type { Series } from '../types';
import { latestChange } from '../lib/analytics';

export type CardState = 'default' | 'selected' | 'related' | 'empty';

interface Props {
  series: Series;
  state: CardState;
  onClick: (id: string) => void;
}

const stateClass: Record<CardState, string> = {
  default: 'bg-white border-gray-200 hover:border-blue-400',
  selected: 'bg-blue-600 text-white border-blue-700',
  related: 'bg-emerald-50 border-emerald-400',
  empty: 'bg-gray-50 border-gray-200 text-gray-400',
};

const fmt = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 });

export function ChainCard({ series, state, onClick }: Props) {
  const change = latestChange(series.points);
  const isEmpty = series.points.length === 0;
  const effectiveState: CardState = isEmpty ? 'empty' : state;

  return (
    <button
      type="button"
      onClick={() => onClick(series.id)}
      className={`min-w-[120px] flex-1 rounded-md border p-2 text-left text-sm transition ${stateClass[effectiveState]}`}
    >
      <div className="text-xs opacity-70">{series.name}</div>
      {isEmpty ? (
        <div className="mt-1 text-xs">暂无数据</div>
      ) : change ? (
        <>
          <div className="mt-1 font-semibold">{fmt.format(change.value)}</div>
          <div
            className={`text-xs ${
              effectiveState === 'selected'
                ? 'text-white'
                : change.changePct >= 0
                ? 'text-emerald-600'
                : 'text-rose-600'
            }`}
          >
            {change.changePct >= 0 ? '+' : ''}
            {change.changePct.toFixed(2)}%
          </div>
        </>
      ) : null}
    </button>
  );
}
