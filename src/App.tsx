import { useEffect, useState } from 'react';
import { useAllData } from './hooks/useAllData';
import { useSelection } from './hooks/useSelection';
import { ChainOverview } from './components/ChainOverview';
import { TimelineChart } from './components/TimelineChart';
import { InsightPanel } from './components/InsightPanel';
import { TimeRangePicker } from './components/TimeRangePicker';
import { ImportPage } from './components/ImportPage';
import type { TimeRange } from './types';

const DEFAULT_NODE = 'SI';

function useHashRoute(): string {
  const [hash, setHash] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.hash : '',
  );
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return hash;
}

export default function App() {
  const route = useHashRoute();
  const { data, loading, error } = useAllData();
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_NODE);
  const [range, setRange] = useState<TimeRange>('1Y');
  const selection = useSelection(data, selectedId);

  if (route === '#/import') {
    return (
      <ImportPage
        onBack={() => {
          window.location.hash = '';
        }}
      />
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-gray-500">
        加载中…
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm">
        <p className="text-rose-600">数据加载失败：{error?.message ?? '未知错误'}</p>
        <button
          type="button"
          className="rounded-md border border-gray-300 bg-white px-3 py-1"
          onClick={() => location.reload()}
        >
          重试
        </button>
      </main>
    );
  }

  const lines = selection
    ? [
        selection.primary && { series: selection.primary, color: '#3b82f6' },
        selection.upstream && { series: selection.upstream, color: '#10b981', dashed: true },
        selection.topPeer && { series: selection.topPeer, color: '#a855f7' },
      ].filter((l): l is { series: NonNullable<typeof l>['series']; color: string; dashed?: boolean } => Boolean(l))
    : [];

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">siltrack · 硅产业链看板</h1>
          <p className="text-xs text-gray-500">
            数据更新时间 {new Date(data.generatedAt).toLocaleString('zh-CN')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              window.location.hash = '#/import';
            }}
            className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 hover:border-blue-400 hover:text-blue-600"
          >
            数据导入
          </button>
          <TimeRangePicker value={range} onChange={setRange} />
        </div>
      </header>

      <ChainOverview
        data={data}
        selectedId={selection?.primary?.id ?? null}
        upstreamId={selection?.upstream?.id ?? null}
        topStockId={selection?.topPeer?.id ?? null}
        onSelect={setSelectedId}
      />

      <section className="mt-2 rounded-md border border-gray-200 bg-white p-3">
        <TimelineChart lines={lines} range={range} />
        {selection && <InsightPanel selection={selection} />}
      </section>
    </main>
  );
}
