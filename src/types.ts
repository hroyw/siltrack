export type Branch = 'photovoltaic' | 'organosilicon' | 'fiber';
export type SeriesType = 'futures' | 'spot' | 'stock';

export interface DataPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface Series {
  id: string;
  name: string;
  branch: Branch;
  type: SeriesType;
  unit: string;
  upstream: string | null;
  relatedStocks: string[];
  points: DataPoint[];
}

export type CorrelationMap = Record<string, Record<string, number | null>>;

export interface AllData {
  generatedAt: string;
  series: Series[];
  correlations: Record<'30' | '60', CorrelationMap>;
}

export type TimeRange = '1M' | '3M' | '6M' | '1Y' | '3Y' | 'ALL';

export type EventType =
  | 'policy'
  | 'delivery'
  | 'inventory'
  | 'production_halt'
  | 'production_start'
  | 'capacity_change'
  | 'order_contract'
  | 'financial_report'
  | 'import_export'
  | 'other';

export type SourceName = 'cninfo' | 'gfex' | 'customs';

export interface NewsEvent {
  id: string;
  date: string;
  source: SourceName;
  source_label: string;
  title: string;
  url: string;
  event_type: EventType;
  related_nodes: string[];
  summary: string | null;
  raw_text_excerpt: string;
}

export interface SourceStatus {
  ok: boolean;
  last_success_at: string;
  stale_days: number;
  error: string | null;
  lag_note: string | null;
}

export interface EventsData {
  generated_at: string;
  sources: Record<SourceName, SourceStatus>;
  events: NewsEvent[];
}
