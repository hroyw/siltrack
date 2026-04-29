import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventTimeline } from '../EventTimeline';
import type { NewsEvent } from '../../types';

function evt(over: Partial<NewsEvent> = {}): NewsEvent {
  return {
    id: 'x', date: '2026-04-28', source: 'cninfo', source_label: '巨潮资讯',
    title: '默认标题', url: '', event_type: 'other', related_nodes: ['SI'],
    summary: null, raw_text_excerpt: '',
    ...over,
  };
}

describe('EventTimeline', () => {
  it('filters events by selectedNodeId', () => {
    const events = [
      evt({ id: 'a', title: '关于 SI', related_nodes: ['SI'] }),
      evt({ id: 'b', title: '关于 PS', related_nodes: ['PS'] }),
    ];
    render(<EventTimeline events={events} selectedNodeId="SI" />);
    expect(screen.getByText('关于 SI')).toBeInTheDocument();
    expect(screen.queryByText('关于 PS')).not.toBeInTheDocument();
  });

  it('sorts events by date descending', () => {
    const events = [
      evt({ id: 'old', title: '旧', date: '2026-04-20', related_nodes: ['SI'] }),
      evt({ id: 'new', title: '新', date: '2026-04-28', related_nodes: ['SI'] }),
    ];
    render(<EventTimeline events={events} selectedNodeId="SI" />);
    const titles = screen.getAllByTestId('event-title').map((el) => el.textContent);
    expect(titles).toEqual(['新', '旧']);
  });

  it('renders only initial 30 by default and "load more" extends', () => {
    const events = Array.from({ length: 50 }, (_, i) =>
      evt({ id: `e${i}`, title: `事件${i}`, date: `2026-04-${String(28 - (i % 28)).padStart(2, '0')}`, related_nodes: ['SI'] }),
    );
    render(<EventTimeline events={events} selectedNodeId="SI" />);
    expect(screen.getAllByTestId('event-title')).toHaveLength(30);
    fireEvent.click(screen.getByRole('button', { name: /加载更多/ }));
    expect(screen.getAllByTestId('event-title')).toHaveLength(50);
  });

  it('shows empty state when nothing matches', () => {
    render(<EventTimeline events={[evt({ related_nodes: ['PS'] })]} selectedNodeId="SI" />);
    expect(screen.getByText(/暂无相关事件/)).toBeInTheDocument();
  });

  it('exposes a focus method via ref + scrolls + highlights', () => {
    const events = [
      evt({ id: 'a', title: 'A', related_nodes: ['SI'] }),
      evt({ id: 'b', title: 'B', related_nodes: ['SI'] }),
    ];
    const ref = { current: null as ((id: string) => void) | null };
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;
    render(<EventTimeline events={events} selectedNodeId="SI" focusRef={ref} />);
    expect(typeof ref.current).toBe('function');
    ref.current?.('b');
    expect(scrollSpy).toHaveBeenCalled();
  });
});
