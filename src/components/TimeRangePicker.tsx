import type { TimeRange } from '../types';

const ORDER: TimeRange[] = ['1M', '3M', '6M', '1Y', '3Y', 'ALL'];
const LABEL: Record<TimeRange, string> = {
  '1M': '1月', '3M': '3月', '6M': '6月', '1Y': '1年', '3Y': '3年', ALL: '全部',
};

interface Props {
  value: TimeRange;
  onChange: (r: TimeRange) => void;
}

export function TimeRangePicker({ value, onChange }: Props) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-gray-200 text-sm">
      {ORDER.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={`px-3 py-1 transition ${
            r === value ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          {LABEL[r]}
        </button>
      ))}
    </div>
  );
}
