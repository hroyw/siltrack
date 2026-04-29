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
