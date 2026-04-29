import { describe, it, expect } from 'vitest';
import { computeSelection } from '../useSelection';
import type { AllData } from '../../types';

const ALL: AllData = {
  generatedAt: 'x',
  series: [
    { id: 'SI', name: '工业硅期货', branch: 'photovoltaic', type: 'futures', unit: '¥/吨',
      upstream: null, relatedStocks: ['603260', '688303', '600438'],
      points: [{ date: '2024-01-01', value: 14000 }, { date: '2024-01-02', value: 14100 }] },
    { id: 'PS', name: '多晶硅期货', branch: 'photovoltaic', type: 'futures', unit: '¥/吨',
      upstream: 'SI', relatedStocks: ['688303', '600438'],
      points: [{ date: '2024-01-01', value: 50000 }, { date: '2024-01-02', value: 50500 }] },
    { id: '603260', name: '合盛硅业', branch: 'organosilicon', type: 'stock', unit: '¥/股',
      upstream: null, relatedStocks: [],
      points: [{ date: '2024-01-01', value: 40 }, { date: '2024-01-02', value: 41 }] },
    { id: '688303', name: '大全能源', branch: 'photovoltaic', type: 'stock', unit: '¥/股',
      upstream: null, relatedStocks: [],
      points: [{ date: '2024-01-01', value: 30 }, { date: '2024-01-02', value: 31 }] },
    { id: '600438', name: '通威股份', branch: 'photovoltaic', type: 'stock', unit: '¥/股',
      upstream: null, relatedStocks: [],
      points: [{ date: '2024-01-01', value: 20 }, { date: '2024-01-02', value: 21 }] },
  ],
  correlations: {
    '30': {},
    '60': {
      'PS': { 'SI': 0.85, '688303': 0.78, '600438': 0.65 },
      'SI': { '603260': 0.62, '688303': 0.41, '600438': 0.30 },
    },
  },
};

describe('computeSelection', () => {
  it('returns primary + upstream + topStock for an inner node', () => {
    const sel = computeSelection(ALL, 'PS');
    expect(sel.primary?.id).toBe('PS');
    expect(sel.upstream?.id).toBe('SI');
    expect(sel.topStock?.id).toBe('688303');
    expect(sel.upstreamCorr).toBe(0.85);
    expect(sel.topStockCorr).toBe(0.78);
  });

  it('returns top stocks ranked by absolute correlation', () => {
    const sel = computeSelection(ALL, 'SI');
    expect(sel.topStocks.map((s) => s.series.id)).toEqual(['603260', '688303', '600438']);
    expect(sel.topStocks[0].corr).toBe(0.62);
    expect(sel.topStocks[1].corr).toBe(0.41);
    expect(sel.topStocks[2].corr).toBe(0.30);
  });

  it('returns null upstream for chain origin', () => {
    const sel = computeSelection(ALL, 'SI');
    expect(sel.primary?.id).toBe('SI');
    expect(sel.upstream).toBeNull();
  });

  it('returns empty topStocks when no candidates have data', () => {
    const empty: AllData = {
      ...ALL,
      correlations: { '30': {}, '60': {} },
    };
    const sel = computeSelection(empty, 'SI');
    expect(sel.topStocks).toEqual([]);
    expect(sel.topStock).toBeNull();
  });

  it('returns null primary for unknown id', () => {
    const sel = computeSelection(ALL, 'unknown');
    expect(sel.primary).toBeNull();
  });
});
