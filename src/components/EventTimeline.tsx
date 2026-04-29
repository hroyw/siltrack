import { useEffect, useMemo, useState } from 'react';
import type { EventType, NewsEvent } from '../types';

const PAGE = 30;

const SOURCE_BADGE: Record<NewsEvent['source'], string> = {
  cninfo: 'bg-blue-50 text-blue-700 border-blue-200',
  gfex: 'bg-purple-50 text-purple-700 border-purple-200',
  customs: 'bg-orange-50 text-orange-700 border-orange-200',
};

const TYPE_ICON: Record<EventType, string> = {
  policy: '📜',
  delivery: '📦',
  inventory: '📊',
  production_halt: '🛑',
  production_start: '🚀',
  capacity_change: '🏗️',
  order_contract: '📝',
  financial_report: '💰',
  import_export: '🌏',
  other: '•',
};

interface Props {
  events: NewsEvent[];
  selectedNodeId: string;
  focusRef?: { current: ((id: string) => void) | null };
}

export function EventTimeline({ events, selectedNodeId, focusRef }: Props) {
  const filtered = useMemo(
    () =>
      events
        .filter((e) => e.related_nodes.includes(selectedNodeId))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [events, selectedNodeId],
  );

  const [shown, setShown] = useState<number>(PAGE);
  useEffect(() => setShown(PAGE), [selectedNodeId]);

  const [highlighted, setHighlighted] = useState<string | null>(null);

  useEffect(() => {
    if (!focusRef) return;
    focusRef.current = (id: string) => {
      const el = document.getElementById(`event-card-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlighted(id);
        window.setTimeout(() => setHighlighted(null), 2000);
      }
    };
    return () => {
      focusRef.current = null;
    };
  }, [focusRef]);

  if (filtered.length === 0) {
    return (
      <div className="rounded-md border border-gray-200 bg-white p-3 text-xs text-gray-500">
        暂无相关事件
      </div>
    );
  }

  const visible = filtered.slice(0, shown);

  return (
    <div className="space-y-2">
      {visible.map((e) => (
        <article
          key={e.id}
          id={`event-card-${e.id}`}
          className={`rounded-md border p-3 text-sm transition-colors ${
            highlighted === e.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'
          }`}
        >
          <div className="mb-1 flex items-center gap-2 text-xs text-gray-500">
            <span>{e.date}</span>
            <span className={`rounded border px-1.5 py-0.5 ${SOURCE_BADGE[e.source]}`}>
              {e.source_label}
            </span>
            <span title={e.event_type}>{TYPE_ICON[e.event_type]}</span>
          </div>
          {e.url ? (
            <a
              data-testid="event-title"
              href={e.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-900 hover:text-blue-600"
            >
              {e.title}
            </a>
          ) : (
            <span data-testid="event-title" className="text-gray-900">
              {e.title}
            </span>
          )}
        </article>
      ))}
      {filtered.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="w-full rounded-md border border-gray-300 bg-white py-1 text-xs text-gray-700 hover:border-blue-400 hover:text-blue-600"
        >
          加载更多（剩余 {filtered.length - shown}）
        </button>
      )}
    </div>
  );
}
