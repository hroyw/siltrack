import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SourceHealth } from '../SourceHealth';
import type { EventsData } from '../../types';

const baseSources: EventsData['sources'] = {
  cninfo:  { ok: true,  last_success_at: '2026-04-29T00:00:00Z', stale_days: 0,  error: null, lag_note: null },
  gfex:    { ok: false, last_success_at: '2026-04-23T00:00:00Z', stale_days: 6,  error: 'timeout', lag_note: null },
  customs: { ok: true,  last_success_at: '2026-04-15T00:00:00Z', stale_days: 14, error: null, lag_note: '海关数据滞后 30-45 天' },
};

describe('SourceHealth', () => {
  it('renders three source badges', () => {
    render(<SourceHealth sources={baseSources} />);
    expect(screen.getByText(/巨潮资讯/)).toBeInTheDocument();
    expect(screen.getByText(/广期所/)).toBeInTheDocument();
    expect(screen.getByText(/海关总署/)).toBeInTheDocument();
  });

  it('uses green for stale_days <= 1', () => {
    render(<SourceHealth sources={baseSources} />);
    const badge = screen.getByRole('button', { name: /巨潮资讯/ });
    expect(badge.className).toMatch(/green|emerald/);
  });

  it('uses red for failed source even with low stale_days', () => {
    render(<SourceHealth sources={baseSources} />);
    const badge = screen.getByRole('button', { name: /广期所/ });
    expect(badge.className).toMatch(/red|rose/);
  });

  it('uses red for stale_days > 7', () => {
    render(<SourceHealth sources={baseSources} />);
    const badge = screen.getByRole('button', { name: /海关总署/ });
    expect(badge.className).toMatch(/red|rose/);
  });

  it('opens a modal with details when a badge is clicked', () => {
    render(<SourceHealth sources={baseSources} />);
    fireEvent.click(screen.getByRole('button', { name: /海关总署/ }));
    expect(screen.getByText(/海关数据滞后 30-45 天/)).toBeInTheDocument();
    expect(screen.getByText(/2026-04-15/)).toBeInTheDocument();
  });

  it('shows error in modal when source is not ok', () => {
    render(<SourceHealth sources={baseSources} />);
    fireEvent.click(screen.getByRole('button', { name: /广期所/ }));
    expect(screen.getByText(/timeout/)).toBeInTheDocument();
  });
});
