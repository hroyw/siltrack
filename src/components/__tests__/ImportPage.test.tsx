import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImportPage } from '../ImportPage';

const SAMPLE_ARTICLE = `
DMC：14700-15500元/吨；
107胶：15000-15500元/吨；
（价格统计时间：4月28日）
`.trim();

describe('ImportPage', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('shows empty hint before parsing', () => {
    render(<ImportPage onBack={() => {}} />);
    expect(screen.getByText(/粘贴文章正文后点击/)).toBeInTheDocument();
  });

  it('parses pasted article and shows price rows', () => {
    render(<ImportPage onBack={() => {}} />);
    const textarea = screen.getByPlaceholderText('粘贴文章正文…');
    fireEvent.change(textarea, { target: { value: SAMPLE_ARTICLE } });
    fireEvent.click(screen.getByRole('button', { name: '解析' }));
    expect(screen.getByText(/DMC: 14700-15500元\/吨/)).toBeInTheDocument();
    expect(screen.getByText(/107胶: 15000-15500元\/吨/)).toBeInTheDocument();
  });

  it('清空 button resets textarea and result', () => {
    render(<ImportPage onBack={() => {}} />);
    const textarea = screen.getByPlaceholderText(
      '粘贴文章正文…',
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: SAMPLE_ARTICLE } });
    fireEvent.click(screen.getByRole('button', { name: '解析' }));
    fireEvent.click(screen.getByRole('button', { name: '清空' }));
    expect(textarea.value).toBe('');
    expect(screen.getByText(/粘贴文章正文后点击/)).toBeInTheDocument();
  });

  it('复制 JSON triggers navigator.clipboard.writeText with the result JSON', async () => {
    render(<ImportPage onBack={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('粘贴文章正文…'), {
      target: { value: SAMPLE_ARTICLE },
    });
    fireEvent.click(screen.getByRole('button', { name: '解析' }));
    fireEvent.click(screen.getByRole('button', { name: '复制 JSON' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    const arg = (navigator.clipboard.writeText as unknown as { mock: { calls: string[][] } })
      .mock.calls[0][0];
    const parsed = JSON.parse(arg);
    expect(parsed.prices.length).toBeGreaterThan(0);
    expect(parsed.metadata).toBeDefined();
  });

  it('返回看板 button calls onBack', () => {
    const onBack = vi.fn();
    render(<ImportPage onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /返回看板/ }));
    expect(onBack).toHaveBeenCalled();
  });
});
