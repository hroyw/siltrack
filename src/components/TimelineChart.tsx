import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { Series, TimeRange } from '../types';
import { sliceByRange, normalizeFromBase } from '../lib/analytics';

interface Line {
  series: Series;
  color: string;
  dashed?: boolean;
}

interface Props {
  lines: Line[];
  range: TimeRange;
}

export function TimelineChart({ lines, range }: Props) {
  const option = useMemo(() => {
    const echartsSeries = lines
      .filter((l) => l.series.points.length > 0)
      .map((l) => {
        const sliced = sliceByRange(l.series.points, range);
        const normalized = normalizeFromBase(sliced);
        return {
          name: l.series.name,
          type: 'line' as const,
          smooth: true,
          symbol: 'none' as const,
          lineStyle: { color: l.color, width: 1.8, type: l.dashed ? 'dashed' : 'solid' },
          itemStyle: { color: l.color },
          data: normalized.map((p) => [p.date, +p.value.toFixed(2)]),
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
  }, [lines, range]);

  if (lines.every((l) => l.series.points.length === 0)) {
    return (
      <div className="flex h-72 items-center justify-center rounded-md border border-dashed border-gray-300 text-sm text-gray-400">
        当前选中的节点暂无数据
      </div>
    );
  }

  return <ReactECharts option={option} style={{ height: 320 }} notMerge lazyUpdate />;
}
