import { describe, it, expect } from 'vitest';
import {
  extractFromArticle,
  parsePriceTable,
  parsePriceDate,
  mapProductId,
  parsePriceEvents,
  parseCompanyNews,
} from '../extract';

const SAMPLE_PRICE_TABLE = `
DMC：14700-15500元/吨；
107胶：15000-15500元/吨；
普通生胶：15500-16500元/吨；
D4：14800-16000元/吨；
高分子生胶：16200-16800元/吨；
沉淀混炼胶：14500-14800元/吨；
气相混炼胶：21000-23000元/吨；
国产甲基硅油：16000-17000元/吨；
外资甲基硅油：20000-23000元/吨；
乙烯基硅油：16500-17500元/吨；
裂解料DMC：12000-12500元/吨；
裂解料硅油：13500-14000元/吨；
废硅胶（毛边）：3800-3900元/吨；
成交价有高有低，需自行与厂家询盘确认，以上报价仅供参考，不可做交易依据。（价格统计时间：4月28日）
`.trim();

describe('parsePriceTable', () => {
  it('extracts every "品种：低-高元/吨" line', () => {
    const out = parsePriceTable(SAMPLE_PRICE_TABLE);
    const dmc = out.find((p) => p.product === 'DMC');
    expect(dmc).toBeDefined();
    expect(dmc?.low).toBe(14700);
    expect(dmc?.high).toBe(15500);
    expect(dmc?.midpoint).toBe(15100);
    expect(dmc?.unit).toBe('元/吨');
  });

  it('handles single-value (no range) entries', () => {
    const single = 'DMC：15000元/吨；';
    const out = parsePriceTable(single);
    expect(out[0].low).toBe(15000);
    expect(out[0].high).toBe(15000);
    expect(out[0].midpoint).toBe(15000);
  });

  it('finds 13 distinct products in the sample', () => {
    const out = parsePriceTable(SAMPLE_PRICE_TABLE);
    expect(out).toHaveLength(13);
  });

  it('preserves Chinese product names with parentheses', () => {
    const out = parsePriceTable(SAMPLE_PRICE_TABLE);
    expect(out.find((p) => p.product === '废硅胶（毛边）')).toBeDefined();
  });

  it('returns empty array when no price lines present', () => {
    expect(parsePriceTable('this has no prices')).toEqual([]);
  });
});

describe('parsePriceDate', () => {
  it('extracts "价格统计时间：4月28日" with current year fallback', () => {
    const d = parsePriceDate('（价格统计时间：4月28日）', 2026);
    expect(d).toBe('2026-04-28');
  });

  it('handles full date "2026年4月28日"', () => {
    const d = parsePriceDate('数据更新于2026年4月28日', 2026);
    expect(d).toBe('2026-04-28');
  });

  it('returns null when no date in text', () => {
    expect(parsePriceDate('no date here', 2026)).toBeNull();
  });
});

describe('mapProductId', () => {
  it('maps known products to siltrack ids', () => {
    expect(mapProductId('DMC')).toBe('dmc');
    expect(mapProductId('107胶')).toBe('silicone-107');
    expect(mapProductId('国产甲基硅油')).toBe('silicone-oil');
    expect(mapProductId('外资甲基硅油')).toBe('silicone-oil');
    expect(mapProductId('气相白炭黑')).toBe('fumed-silica');
  });

  it('maps new product types added in this feature', () => {
    expect(mapProductId('D4')).toBe('d4');
    expect(mapProductId('普通生胶')).toBe('silicone-rubber');
    expect(mapProductId('高分子生胶')).toBe('silicone-rubber-hi');
    expect(mapProductId('沉淀混炼胶')).toBe('silicone-compound-precip');
    expect(mapProductId('气相混炼胶')).toBe('silicone-compound-fumed');
  });

  it('returns null for unknown products', () => {
    expect(mapProductId('裂解料DMC')).toBeNull();
    expect(mapProductId('废硅胶（毛边）')).toBeNull();
  });
});

describe('parsePriceEvents', () => {
  it('extracts "X 上涨 Y 至 Z" change events', () => {
    const text = '昨日山东个别单体厂D4上涨100至14800元/吨';
    const events = parsePriceEvents(text);
    expect(events).toHaveLength(1);
    expect(events[0].product).toBe('D4');
    expect(events[0].direction).toBe('up');
    expect(events[0].changeDelta).toBe(100);
    expect(events[0].newPrice).toBe(14800);
  });

  it('extracts "X 下跌 Y" without target price', () => {
    const text = '本周DMC下跌200元';
    const events = parsePriceEvents(text);
    expect(events[0].product).toBe('DMC');
    expect(events[0].direction).toBe('down');
    expect(events[0].changeDelta).toBe(200);
  });

  it('returns empty array when no events present', () => {
    expect(parsePriceEvents('无价格变动信息')).toEqual([]);
  });
});

describe('parseCompanyNews', () => {
  const sample = `
恒星科技：一季度净利润5664.93万元 同比增长899.11%

恒星科技披露一季报，公司2026年一季度实现营业收入12.33亿元，同比增长10.39%；归母净利润5664.93万元，同比增长899.11%。

兴发集团：一季度净利润约2.57亿元，同比下降17.37%

4月28日晚间，兴发集团发布一季度业绩公告。2026年第一季度，该集团营收约74.52亿元，同比增加3.09%；归属于上市公司股东的净利润约2.57亿元，同比下降17.37%；
`.trim();

  it('extracts at least one earnings entry per company section', () => {
    const news = parseCompanyNews(sample);
    expect(news.length).toBeGreaterThanOrEqual(2);
    const hengxing = news.find((n) => n.companyName === '恒星科技');
    expect(hengxing).toBeDefined();
    expect(hengxing?.netProfit).toBe('5664.93万');
    expect(hengxing?.netProfitYoY).toBe(899.11);
  });

  it('extracts revenue and yoy for 兴发集团', () => {
    const news = parseCompanyNews(sample);
    const xingfa = news.find((n) => n.companyName === '兴发集团');
    expect(xingfa).toBeDefined();
    expect(xingfa?.revenueYoY).toBeCloseTo(3.09);
    expect(xingfa?.netProfitYoY).toBeCloseTo(-17.37);
  });
});

describe('extractFromArticle (integration)', () => {
  const ARTICLE = `
图片
DMC：14700-15500元/吨；
107胶：15000-15500元/吨；
普通生胶：15500-16500元/吨；
D4：14800-16000元/吨；
气相白炭黑：13000-14000元/吨；
（价格统计时间：4月28日）

恒星科技：一季度净利润5664.93万元 同比增长899.11%
恒星科技披露一季报，公司2026年一季度实现营业收入12.33亿元，同比增长10.39%；归母净利润5664.93万元，同比增长899.11%。

昨日山东个别单体厂D4上涨100至14800元/吨
`.trim();

  it('returns structured result with all sections populated', () => {
    const result = extractFromArticle(ARTICLE, 2026);
    expect(result.metadata.priceDate).toBe('2026-04-28');
    expect(result.prices.length).toBeGreaterThanOrEqual(5);
    expect(result.events.length).toBeGreaterThanOrEqual(1);
    expect(result.news.length).toBeGreaterThanOrEqual(1);
  });

  it('maps mappable products and warns on unmappable', () => {
    const result = extractFromArticle(ARTICLE, 2026);
    const dmc = result.prices.find((p) => p.product === 'DMC');
    expect(dmc?.productId).toBe('dmc');
    const fumed = result.prices.find((p) => p.product === '气相白炭黑');
    expect(fumed?.productId).toBe('fumed-silica');
  });

  it('attaches priceDate to every extracted price', () => {
    const result = extractFromArticle(ARTICLE, 2026);
    for (const p of result.prices) {
      expect(p.date).toBe('2026-04-28');
    }
  });
});
