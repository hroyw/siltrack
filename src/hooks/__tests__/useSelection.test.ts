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
    { id: 'dmc', name: 'DMC', branch: 'organosilicon', type: 'spot', unit: '¥/吨',
      upstream: 'SI', relatedStocks: ['603260', '600596'],
      points: [] },
    { id: '603260', name: '合盛硅业', branch: 'organosilicon', type: 'stock', unit: '¥/股',
      upstream: null, relatedStocks: [],
      points: [{ date: '2024-01-01', value: 40 }, { date: '2024-01-02', value: 41 }] },
    { id: '600596', name: '新安股份', branch: 'organosilicon', type: 'stock', unit: '¥/股',
      upstream: null, relatedStocks: [],
      points: [{ date: '2024-01-01', value: 12 }, { date: '2024-01-02', value: 12.5 }] },
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
      'SI': { '603260': 0.28, '688303': 0.52, '600438': 0.56 },
      'dmc': { '603260': 0.71, '600596': 0.40 },
    },
  },
};

describe('computeSelection', () => {
  it('commodity primary: returns upstream + Top peer stocks', () => {
    const sel = computeSelection(ALL, 'PS');
    expect(sel.primary?.id).toBe('PS');
    expect(sel.upstream?.id).toBe('SI');
    expect(sel.topPeer?.id).toBe('688303');
    expect(sel.upstreamCorr).toBe(0.85);
    expect(sel.topPeerCorr).toBe(0.78);
  });

  it('commodity primary: ranks Top-3 peer stocks by abs corr', () => {
    const sel = computeSelection(ALL, 'SI');
    expect(sel.topPeers.map((s) => s.series.id)).toEqual(['600438', '688303', '603260']);
    expect(sel.topPeers[0].corr).toBe(0.56);
  });

  it('stock primary: reverse-lookup finds commodities that listed it', () => {
    // 603260 (合盛) is listed in SI and dmc related_stocks
    const sel = computeSelection(ALL, '603260');
    expect(sel.primary?.id).toBe('603260');
    expect(sel.upstream).toBeNull();
    const peerIds = sel.topPeers.map((p) => p.series.id);
    expect(peerIds).toContain('SI');
    expect(peerIds).toContain('dmc');
    // ranked by |corr|: dmc (0.71) > SI (0.28)
    expect(sel.topPeers[0].series.id).toBe('dmc');
    expect(sel.topPeers[0].corr).toBe(0.71);
    expect(sel.topPeer?.id).toBe('dmc');
  });

  it('stock primary: empty topPeers when nothing references the stock', () => {
    // 600487 (亨通光电) is not in any non-stock related_stocks here
    const noRefAll: AllData = {
      ...ALL,
      series: [
        ...ALL.series,
        { id: '600487', name: '亨通光电', branch: 'fiber', type: 'stock', unit: '¥/股',
          upstream: null, relatedStocks: [], points: [] },
      ],
    };
    const sel = computeSelection(noRefAll, '600487');
    expect(sel.topPeers).toEqual([]);
    expect(sel.topPeer).toBeNull();
  });

  it('returns null upstream for chain origin', () => {
    const sel = computeSelection(ALL, 'SI');
    expect(sel.upstream).toBeNull();
  });

  it('returns null primary for unknown id', () => {
    const sel = computeSelection(ALL, 'unknown');
    expect(sel.primary).toBeNull();
  });
});
