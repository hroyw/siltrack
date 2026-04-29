import { describe, it, expect } from 'vitest';
import { generateInsight, classifyCorrelation, pickTopRelatedStock } from '../insight';
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

describe('pickTopRelatedStock', () => {
  it('picks the relatedStock with highest absolute correlation', () => {
    const corr: CorrelationMap = { 'polysilicon-dense': { '600438': 0.5, '688303': 0.78, '603260': -0.6 } };
    expect(pickTopRelatedStock('polysilicon-dense', ['600438', '688303', '603260'], corr)).toBe('688303');
  });

  it('returns null when no candidates have correlation data', () => {
    const corr: CorrelationMap = { 'polysilicon-dense': {} };
    expect(pickTopRelatedStock('polysilicon-dense', ['600438'], corr)).toBeNull();
  });
});

describe('generateInsight', () => {
  it('describes upstream and related stock with named entities', () => {
    const text = generateInsight({
      nodeName: '多晶硅致密料',
      upstreamName: '多晶硅期货主力',
      upstreamCorr: 0.85,
      stockName: '通威股份',
      stockCorr: 0.55,
    });
    expect(text).toContain('多晶硅致密料');
    expect(text).toContain('多晶硅期货主力');
    expect(text).toContain('强正相关');
    expect(text).toContain('通威股份');
    expect(text).toContain('0.55');
  });

  it('omits upstream clause when no upstream', () => {
    const text = generateInsight({
      nodeName: '工业硅期货主力',
      upstreamName: null,
      upstreamCorr: null,
      stockName: '合盛硅业',
      stockCorr: 0.72,
    });
    expect(text).toContain('合盛硅业');
    expect(text).not.toContain('上游');
  });
});
