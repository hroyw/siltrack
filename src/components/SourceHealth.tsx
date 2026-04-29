import { useState } from 'react';
import type { EventsData, SourceName, SourceStatus } from '../types';

const LABELS: Record<SourceName, string> = {
  cninfo: '巨潮资讯',
  gfex: '广期所',
  customs: '海关总署',
};

const ORDER: SourceName[] = ['cninfo', 'gfex', 'customs'];

function colorClass(stale: number, ok: boolean): string {
  if (!ok || stale > 7) return 'bg-rose-50 text-rose-700 border-rose-300';
  if (stale > 1) return 'bg-amber-50 text-amber-700 border-amber-300';
  return 'bg-emerald-50 text-emerald-700 border-emerald-300';
}

interface Props {
  sources: EventsData['sources'];
}

export function SourceHealth({ sources }: Props) {
  const [open, setOpen] = useState<SourceName | null>(null);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {ORDER.map((name) => {
          const s = sources[name];
          if (!s) return null;
          return (
            <button
              key={name}
              type="button"
              aria-label={LABELS[name]}
              onClick={() => setOpen(name)}
              className={`rounded-full border px-2 py-0.5 text-xs ${colorClass(s.stale_days, s.ok)}`}
            >
              {LABELS[name]} · {s.ok ? `${s.stale_days}d` : '失败'}
            </button>
          );
        })}
      </div>
      {open && (
        <SourceModal name={open} status={sources[open]} onClose={() => setOpen(null)} />
      )}
    </>
  );
}

function SourceModal({
  name,
  status,
  onClose,
}: {
  name: SourceName;
  status: SourceStatus;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="w-80 rounded-md border border-gray-200 bg-white p-4 text-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-2 font-medium">{LABELS[name]}</h3>
        <dl className="space-y-1 text-xs text-gray-700">
          <div><dt className="inline text-gray-500">状态：</dt><dd className="inline">{status.ok ? '正常' : '失败'}</dd></div>
          <div><dt className="inline text-gray-500">距上次成功：</dt><dd className="inline">{status.stale_days} 天</dd></div>
          <div><dt className="inline text-gray-500">最近成功时间：</dt><dd className="inline">{status.last_success_at || '—'}</dd></div>
          {status.error && (
            <div><dt className="inline text-gray-500">错误：</dt><dd className="inline text-rose-600">{status.error}</dd></div>
          )}
          {status.lag_note && (
            <div className="mt-2 rounded bg-amber-50 p-2 text-amber-800">{status.lag_note}</div>
          )}
        </dl>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs"
        >
          关闭
        </button>
      </div>
    </div>
  );
}
