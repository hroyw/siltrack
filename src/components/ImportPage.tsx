import { useMemo, useState } from 'react';
import { extractFromArticle, type ExtractionResult } from '../lib/extract';

function formatPriceRow(p: ExtractionResult['prices'][number]): string {
  const range = p.low === p.high ? `${p.low}` : `${p.low}-${p.high}`;
  return `${p.product}: ${range}${p.unit}`;
}

function formatNewsMetrics(n: ExtractionResult['news'][number]): string {
  const parts: string[] = [];
  if (n.revenue) {
    parts.push(
      `营收 ${n.revenue}` +
        (typeof n.revenueYoY === 'number'
          ? ` 同比 ${n.revenueYoY > 0 ? '+' : ''}${n.revenueYoY}%`
          : ''),
    );
  }
  if (n.netProfit) {
    parts.push(
      `净利 ${n.netProfit}` +
        (typeof n.netProfitYoY === 'number'
          ? ` 同比 ${n.netProfitYoY > 0 ? '+' : ''}${n.netProfitYoY}%`
          : ''),
    );
  }
  return parts.join('，');
}

interface Props {
  onBack: () => void;
}

export function ImportPage({ onBack }: Props) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'err'>('idle');

  const mappedPriceCount = useMemo(() => {
    if (!result) return 0;
    return result.prices.filter((p) => p.productId !== null).length;
  }, [result]);

  const handleParse = () => {
    if (!text.trim()) return;
    setResult(extractFromArticle(text));
    setCopyState('idle');
  };

  const handleClear = () => {
    setText('');
    setResult(null);
    setCopyState('idle');
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      setCopyState('ok');
      setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      setCopyState('err');
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = result.metadata.priceDate ?? 'unknown-date';
    a.download = `${stamp}-extraction.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">siltrack · 数据导入</h1>
          <p className="text-xs text-gray-500">
            粘贴文章正文，自动提取价格、变动与公司财报
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 hover:border-blue-400 hover:text-blue-600"
        >
          ← 返回看板
        </button>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Left: input */}
        <section className="rounded-md border border-gray-200 bg-white p-3">
          <h2 className="mb-2 text-sm font-medium text-gray-700">文章正文</h2>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="粘贴文章正文…"
            className="h-96 w-full resize-y rounded-md border border-gray-300 p-2 font-mono text-xs leading-relaxed focus:border-blue-400 focus:outline-none"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={handleClear}
              className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 hover:border-rose-400 hover:text-rose-600"
            >
              清空
            </button>
            <button
              type="button"
              onClick={handleParse}
              disabled={!text.trim()}
              className="rounded-md border border-blue-600 bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              解析
            </button>
          </div>
        </section>

        {/* Right: output */}
        <section className="rounded-md border border-gray-200 bg-white p-3">
          <h2 className="mb-2 text-sm font-medium text-gray-700">解析结果</h2>
          {!result ? (
            <p className="py-12 text-center text-sm text-gray-400">
              粘贴文章正文后点击「解析」
            </p>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="text-xs text-gray-600">
                数据日期: {result.metadata.priceDate ?? '未识别'}
              </div>

              <div>
                <h3 className="mb-1 text-sm font-medium">
                  价格 ({result.prices.length} / {mappedPriceCount} 已匹配)
                </h3>
                {result.prices.length === 0 ? (
                  <p className="text-xs text-gray-400">未提取到价格</p>
                ) : (
                  <ul className="space-y-0.5 text-xs">
                    {result.prices.map((p, i) => (
                      <li
                        key={`${p.product}-${i}`}
                        className="flex items-start gap-1"
                      >
                        <span
                          className={
                            p.productId
                              ? 'text-emerald-600'
                              : 'text-amber-500'
                          }
                        >
                          {p.productId ? '✓' : '⚠'}
                        </span>
                        <span className="font-mono">
                          {formatPriceRow(p)}
                          {!p.productId && (
                            <span className="ml-1 text-amber-600">
                              (未映射)
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="mb-1 text-sm font-medium">
                  价格变动 ({result.events.length})
                </h3>
                {result.events.length === 0 ? (
                  <p className="text-xs text-gray-400">未检测到价格变动</p>
                ) : (
                  <ul className="space-y-0.5 text-xs">
                    {result.events.map((e, i) => (
                      <li key={`${e.product}-${i}`}>
                        <span className="mr-1">
                          {e.direction === 'up' ? '📈' : '📉'}
                        </span>
                        <span className="font-medium">{e.product}</span>{' '}
                        {e.direction === 'up' ? '上涨' : '下跌'}{' '}
                        {e.changeDelta}
                        {e.newPrice != null && <> → {e.newPrice}</>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="mb-1 text-sm font-medium">
                  公司财报 ({result.news.length})
                </h3>
                {result.news.length === 0 ? (
                  <p className="text-xs text-gray-400">未检测到财报</p>
                ) : (
                  <ul className="space-y-0.5 text-xs">
                    {result.news.map((n, i) => (
                      <li key={`${n.companyName}-${i}`}>
                        🏢 <span className="font-semibold">{n.companyName}</span>
                        {n.stockCode && (
                          <span className="text-gray-400">
                            {' '}
                            ({n.stockCode})
                          </span>
                        )}
                        {formatNewsMetrics(n) && (
                          <span> · {formatNewsMetrics(n)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {result.warnings.length > 0 && (
                <div className="rounded-md bg-gray-50 p-2">
                  <h3 className="mb-1 text-xs font-medium text-gray-600">
                    ⚠ 警告 ({result.warnings.length})
                  </h3>
                  <ul className="space-y-0.5 text-xs text-gray-500">
                    {result.warnings.map((w, i) => (
                      <li key={i}>• {w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 hover:border-blue-400 hover:text-blue-600"
                >
                  复制 JSON
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 hover:border-blue-400 hover:text-blue-600"
                >
                  下载 JSON
                </button>
                {copyState === 'ok' && (
                  <span className="text-xs text-emerald-600">已复制</span>
                )}
                {copyState === 'err' && (
                  <span className="text-xs text-rose-600">复制失败</span>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
