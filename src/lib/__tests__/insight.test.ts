import { describe, it, expect } from 'vitest';
import {
  generateInsight,
  classifyCorrelation,
  pickTopRelatedStock,
  pickTopRelatedStocks,
} from '../insight';
import type { CorrelationMap } from '../../types';

describe('classifyCorrelation', () => {
  it('labels by absolute value', () => {
    expect(classifyCorrelation(0.85)).toBe('强正相关');
    expect(classifyCorrelation(-0.85)).toBe('强负相关');
    expect(classifyCorrelation(0.5)).toBe('中等正相关');
    expect(classifyCorrelation(0.2)).toBe('弱相关');
    expect(classifyCorrelation(null)).toBe('数据不足');
  });
});

describe('pickTopRelatedStocks', () => {
  it('returns up to N stocks ranked by absolute correlation', () => {
    const corr: CorrelationMap = {
      'polysilicon-dense': { '600438': 0.5, '688303': 0.78, '603260': -0.6, '002129': 0.3 },
    };
    const top = pickTopRelatedStocks(
      'polysilicon-dense',
      ['600438', '688303', '603260', '002129'],
      corr,
      3,
    );
    expect(top.map((s) => s.id)).toEqual(['688303', '603260', '600438']);
    expect(top[0].corr).toBe(0.78);
    expect(top[1].corr).toBe(-0.6);
  });

  it('returns empty array when nothing has data', () => {
    const corr: CorrelationMap = { 'polysilicon-dense': {} };
    expect(pickTopRelatedStocks('polysilicon-dense', ['600438'], corr)).toEqual([]);
  });

  it('returns fewer than N when fewer candidates have data', () => {
    const corr: CorrelationMap = { 'polysilicon-dense': { '600438': 0.5 } };
    const top = pickTopRelatedStocks('polysilicon-dense', ['600438', '688303'], corr, 3);
    expect(top).toHaveLength(1);
    expect(top[0].id).toBe('600438');
  });
});

describe('pickTopRelatedStock', () => {
  it('picks the relatedStock with highest absolute correlation', () => {
    const corr: CorrelationMap = {
      'polysilicon-dense': { '600438': 0.5, '688303': 0.78, '603260': -0.6 },
    };
    expect(pickTopRelatedStock('polysilicon-dense', ['600438', '688303', '603260'], corr)).toBe(
      '688303',
    );
  });

  it('returns null when no candidates have correlation data', () => {
    const corr: CorrelationMap = { 'polysilicon-dense': {} };
    expect(pickTopRelatedStock('polysilicon-dense', ['600438'], corr)).toBeNull();
  });
});

describe('generateInsight', () => {
  it('describes upstream and Top-N stocks with named entities', () => {
    const text = generateInsight({
      nodeName: '多晶硅致密料',
      upstreamName: '多晶硅期货主力',
      upstreamCorr: 0.85,
      peers: [
        { name: '通威股份', corr: 0.78 },
        { name: '大全能源', corr: 0.62 },
        { name: '合盛硅业', corr: 0.45 },
      ],
      peerLabel: '关联股票',
    });
    expect(text).toContain('多晶硅致密料');
    expect(text).toContain('多晶硅期货主力');
    expect(text).toContain('强正相关');
    expect(text).toContain('通威股份 0.78');
    expect(text).toContain('大全能源 0.62');
    expect(text).toContain('合盛硅业 0.45');
    expect(text).toContain('Top3');
  });

  it('omits upstream clause when no upstream', () => {
    const text = generateInsight({
      nodeName: '工业硅期货主力',
      upstreamName: null,
      upstreamCorr: null,
      peers: [{ name: '合盛硅业', corr: 0.72 }],
      peerLabel: '关联股票',
    });
    expect(text).toContain('合盛硅业');
    expect(text).not.toContain('上游');
    expect(text).not.toContain('Top');
  });

  it('uses peerLabel for stock primary (reverse lookup case)', () => {
    const text = generateInsight({
      nodeName: '合盛硅业',
      upstreamName: null,
      upstreamCorr: null,
      peers: [
        { name: 'DMC', corr: 0.71 },
        { name: '工业硅期货主力', corr: 0.28 },
      ],
      peerLabel: '关联商品',
    });
    expect(text).toContain('合盛硅业');
    expect(text).toContain('关联商品 Top2');
    expect(text).toContain('DMC 0.71');
    expect(text).toContain('工业硅期货主力 0.28');
  });

  it('falls back to placeholder when nothing to say', () => {
    const text = generateInsight({
      nodeName: '高纯石英砂',
      upstreamName: null,
      upstreamCorr: null,
      peers: [],
      peerLabel: '关联股票',
    });
    expect(text).toContain('高纯石英砂');
    expect(text).toContain('暂无');
  });
});
