/**
 * Article extractor.
 *
 * Pure regex + heuristic parsing — no LLM. Designed for the WeChat-style
 * silicon-industry weekly market reports (有机硅商城 etc.) which have a
 * consistent "主流报价" table near the end and standard 财报 phrasing
 * for company earnings.
 *
 * Doesn't attempt to understand free-form analytical paragraphs.
 */

export interface ExtractedPrice {
  product: string;
  productId: string | null;
  low: number;
  high: number;
  midpoint: number;
  unit: string;
  date: string | null;
}

export interface ExtractedEvent {
  product: string;
  productId: string | null;
  direction: 'up' | 'down';
  changeDelta: number;
  newPrice: number | null;
  date: string | null;
  raw: string;
}

export interface ExtractedNews {
  companyName: string;
  stockCode?: string;
  type: 'earnings' | 'other';
  revenue?: string;
  revenueYoY?: number;
  netProfit?: string;
  netProfitYoY?: number;
  raw: string;
}

export interface ExtractionResult {
  metadata: {
    title?: string;
    source?: string;
    publishDate?: string;
    priceDate: string | null;
  };
  prices: ExtractedPrice[];
  events: ExtractedEvent[];
  news: ExtractedNews[];
  warnings: string[];
}

const PRODUCT_MAP: Record<string, string> = {
  DMC: 'dmc',
  '107胶': 'silicone-107',
  '107硅橡胶': 'silicone-107',
  甲基硅油: 'silicone-oil',
  国产甲基硅油: 'silicone-oil',
  外资甲基硅油: 'silicone-oil',
  气相白炭黑: 'fumed-silica',
  白炭黑: 'fumed-silica',
  D4: 'd4',
  普通生胶: 'silicone-rubber',
  生胶: 'silicone-rubber',
  高分子生胶: 'silicone-rubber-hi',
  沉淀混炼胶: 'silicone-compound-precip',
  气相混炼胶: 'silicone-compound-fumed',
};

const COMPANY_TO_STOCK: Record<string, string> = {
  合盛硅业: '603260',
  通威股份: '600438',
  大全能源: '688303',
  TCL中环: '002129',
  隆基绿能: '601012',
  新安股份: '600596',
  东岳硅材: '300821',
  三孚股份: '603938',
  长飞光纤: '601869',
  亨通光电: '600487',
  中天科技: '600522',
  恒星科技: '002132',
  兴发集团: '600141',
};

export function mapProductId(name: string): string | null {
  return PRODUCT_MAP[name] ?? null;
}

const PRICE_LINE_RE =
  /^([^\s：:]+?)[：:]\s*(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s*(元\/吨|元\/公斤|元\/W|元\/片|¥\/吨)\s*[；;]?$/;

export function parsePriceTable(text: string): ExtractedPrice[] {
  const out: ExtractedPrice[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const m = line.match(PRICE_LINE_RE);
    if (!m) continue;
    const product = m[1];
    const low = parseFloat(m[2]);
    const high = m[3] ? parseFloat(m[3]) : low;
    const unit = m[4];
    out.push({
      product,
      productId: mapProductId(product),
      low,
      high,
      midpoint: (low + high) / 2,
      unit,
      date: null, // filled in by caller after date detection
    });
  }
  return out;
}

const ZH_DIGITS: Record<string, number> = {
  零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};

function zhNumberToInt(s: string): number | null {
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  if (s in ZH_DIGITS) return ZH_DIGITS[s];
  return null;
}

const FULL_DATE_RE = /(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/;
const SHORT_DATE_RE = /(\d{1,2})月\s*(\d{1,2})日/;
// Explicit "price-statistics-date" tag like "（价格统计时间：4月28日）"
const EXPLICIT_PRICE_DATE_RE =
  /价格(?:统计)?(?:时间|日期)[：:]\s*(?:(\d{4})年)?\s*(\d{1,2})月\s*(\d{1,2})日/;

export function parsePriceDate(text: string, currentYear: number): string | null {
  // 1. Prefer the explicit "价格统计时间" tag if present
  const explicit = text.match(EXPLICIT_PRICE_DATE_RE);
  if (explicit) {
    const year = explicit[1] ? explicit[1] : String(currentYear);
    return `${year}-${pad(explicit[2])}-${pad(explicit[3])}`;
  }
  // 2. Fall back to a full year-month-day occurrence
  const full = text.match(FULL_DATE_RE);
  if (full) {
    return `${full[1]}-${pad(full[2])}-${pad(full[3])}`;
  }
  // 3. Last resort: first month-day mention with current year
  const short = text.match(SHORT_DATE_RE);
  if (short) {
    return `${currentYear}-${pad(short[1])}-${pad(short[2])}`;
  }
  return null;
}

function pad(s: string): string {
  return s.padStart(2, '0');
}

const EVENT_RE =
  /([A-Za-z0-9]+|[一-鿿]{1,8}?)\s*(上涨|下跌|涨|跌)\s*(\d+(?:\.\d+)?)\s*(?:元)?(?:\s*(?:至|到)\s*(\d+(?:\.\d+)?))?/g;

export function parsePriceEvents(text: string, date: string | null = null): ExtractedEvent[] {
  const out: ExtractedEvent[] = [];
  // Reset regex lastIndex for safety
  EVENT_RE.lastIndex = 0;
  let match;
  while ((match = EVENT_RE.exec(text)) !== null) {
    const product = match[1].trim();
    const verb = match[2];
    const delta = parseFloat(match[3]);
    const target = match[4] ? parseFloat(match[4]) : null;
    out.push({
      product,
      productId: mapProductId(product),
      direction: verb.includes('涨') ? 'up' : 'down',
      changeDelta: delta,
      newPrice: target,
      date,
      raw: match[0],
    });
  }
  return out;
}

// Match patterns like "营业收入12.33亿元" or "营收约74.52亿元"
const REVENUE_RE = /(?:营业收入|营收)[约为]*(\d+(?:\.\d+)?)\s*(亿|万)/;
const NET_PROFIT_RE =
  /(?:归母?净利润?|净利润?)[约为]*(\d+(?:\.\d+)?)\s*(亿|万)/;
const YOY_REVENUE_RE =
  /(?:营业收入|营收)[\s\S]{0,40}?同比(?:增长|下降|增加|减少)\s*(?:约为)?\s*(\d+(?:\.\d+)?)%?/;
const YOY_NET_PROFIT_RE =
  /(?:归母?净利润?|净利润?)[\s\S]{0,40}?同比(?:增长|下降|增加|减少)\s*(?:约为)?\s*(\d+(?:\.\d+)?)%?/;

export function parseCompanyNews(text: string): ExtractedNews[] {
  const out: ExtractedNews[] = [];
  for (const company of Object.keys(COMPANY_TO_STOCK)) {
    // Match from the first occurrence of the company name through the next
    // "（来源" tag or up to ~1500 characters — this spans both the headline
    // line and the body paragraph that lives after a blank line.
    const blockRe = new RegExp(
      `${company}[\\s\\S]{0,1500}?(?=（来源|$)`,
      'g',
    );
    let m;
    while ((m = blockRe.exec(text)) !== null) {
      const block = m[0];
      const revM = block.match(REVENUE_RE);
      const npM = block.match(NET_PROFIT_RE);
      const revYoyM = block.match(YOY_REVENUE_RE);
      const npYoyM = block.match(YOY_NET_PROFIT_RE);
      if (!revM && !npM) continue;
      const downwardSignals = /(?:下降|减少|下滑)/;
      let revenueYoY: number | undefined;
      let netProfitYoY: number | undefined;
      if (revYoyM) {
        const v = parseFloat(revYoyM[1]);
        revenueYoY = downwardSignals.test(
          block.slice(Math.max(0, revYoyM.index! - 30), revYoyM.index! + revYoyM[0].length),
        )
          ? -v
          : v;
      }
      if (npYoyM) {
        const v = parseFloat(npYoyM[1]);
        netProfitYoY = downwardSignals.test(
          block.slice(Math.max(0, npYoyM.index! - 30), npYoyM.index! + npYoyM[0].length),
        )
          ? -v
          : v;
      }
      out.push({
        companyName: company,
        stockCode: COMPANY_TO_STOCK[company],
        type: 'earnings',
        revenue: revM ? `${revM[1]}${revM[2]}` : undefined,
        netProfit: npM ? `${npM[1]}${npM[2]}` : undefined,
        revenueYoY,
        netProfitYoY,
        raw: block.slice(0, 200),
      });
      // Only first match per company is enough — the article often repeats
      break;
    }
  }
  return out;
}

export function extractFromArticle(text: string, currentYear: number = new Date().getFullYear()): ExtractionResult {
  const priceDate = parsePriceDate(text, currentYear);
  const prices = parsePriceTable(text).map((p) => ({ ...p, date: priceDate }));
  const events = parsePriceEvents(text, priceDate);
  const news = parseCompanyNews(text);

  const warnings: string[] = [];
  for (const p of prices) {
    if (p.productId === null) {
      warnings.push(`未映射到 siltrack 节点：${p.product}`);
    }
  }

  return {
    metadata: {
      priceDate,
    },
    prices,
    events,
    news,
    warnings,
  };
}
