import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { NewsEvent, Series, TimeRange } from '../types';
import { sliceByRange, normalizeFromBase } from '../lib/analytics';

interface Line {
  series: Series;
  color: string;
  dashed?: boolean;
}

interface Props {
  lines: Line[];
  range: TimeRange;
  events?: NewsEvent[];
  onEventClick?: (id: string) => void;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function TimelineChart({ lines, range, events, onEventClick }: Props) {
  const option = useMemo(() => {
    const echartsSeries = lines
      .filter((l) => l.series.points.length > 0)
      .map((l, idx) => {
        const sliced = sliceByRange(l.series.points, range);
        const normalized = normalizeFromBase(sliced);
        const base = {
          name: l.series.name,
          type: 'line' as const,
          smooth: true,
          symbol: 'none' as const,
          lineStyle: { color: l.color, width: 1.8, type: l.dashed ? 'dashed' : 'solid' },
          itemStyle: { color: l.color },
          data: normalized.map((p) => [p.date, +p.value.toFixed(2)]),
        };
        if (idx !== 0 || !events || events.length === 0) return base;

        const primaryId = l.series.id;
        const inRange = new Set(normalized.map((p) => p.date));
        const matched = events.filter(
          (e) => e.related_nodes.includes(primaryId) && inRange.has(e.date),
        );
        if (matched.length === 0) return base;

        return {
          ...base,
          markPoint: {
            symbol: 'circle' as const,
            symbolSize: 8,
            label: { show: false },
            tooltip: {
              formatter: (p: { name?: string; data?: { event?: NewsEvent } }) => {
                const e = p.data?.event;
                if (!e) return '';
                return `${e.date} · ${escapeHtml(e.source_label)}<br/>${escapeHtml(e.title)}`;
              },
            },
            data: matched.map((e) => ({
              name: e.id,
              xAxis: e.date,
              yAxis: 100,
              itemStyle: { color: l.color, opacity: 0.7 },
              event: e,
            })),
          },
        };
      });

    return {
      animation: false,
      grid: { left: 50, right: 16, top: 30, bottom: 30 },
      tooltip: { trigger: 'axis' as const },
      legend: { top: 0, textStyle: { fontSize: 11 } },
      xAxis: { type: 'time' as const, axisLine: { lineStyle: { color: '#cbd5e1' } } },
      yAxis: {
        type: 'value' as const,
        scale: true,
        name: '归一化（首日=100）',
        nameTextStyle: { fontSize: 10, color: '#64748b' },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
      },
      series: echartsSeries,
    };
  }, [lines, range, events]);

  if (lines.every((l) => l.series.points.length === 0)) {
    return (
      <div className="flex h-72 items-center justify-center rounded-md border border-dashed border-gray-300 text-sm text-gray-400">
        当前选中的节点暂无数据
      </div>
    );
  }

  const echartsEvents = onEventClick
    ? {
        click: (params: { componentType?: string; data?: { name?: string } }) => {
          if (params.componentType === 'markPoint' && params.data?.name) {
            onEventClick(params.data.name);
          }
        },
      }
    : undefined;

  return (
    <ReactECharts
      option={option}
      style={{ height: 320 }}
      notMerge
      lazyUpdate
      onEvents={echartsEvents}
    />
  );
}
