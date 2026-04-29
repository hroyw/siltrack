import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChainCard } from '../ChainCard';
import type { Series } from '../../types';

const SERIES: Series = {
  id: 'PS', name: '多晶硅期货主力', branch: 'photovoltaic', type: 'futures', unit: '¥/吨',
  upstream: 'SI', relatedStocks: [],
  points: [
    { date: '2024-01-01', value: 50000 },
    { date: '2024-01-02', value: 50500 },
  ],
};

describe('ChainCard', () => {
  it('renders name and latest value', () => {
    render(<ChainCard series={SERIES} state="default" onClick={() => {}} />);
    expect(screen.getByText('多晶硅期货主力')).toBeInTheDocument();
    expect(screen.getByText(/50,500/)).toBeInTheDocument();
    expect(screen.getByText(/\+1\.00%/)).toBeInTheDocument();
  });

  it('renders empty placeholder when no points', () => {
    const empty: Series = { ...SERIES, points: [] };
    render(<ChainCard series={empty} state="default" onClick={() => {}} />);
    expect(screen.getByText(/暂无数据/)).toBeInTheDocument();
  });

  it('fires onClick with id', () => {
    const onClick = vi.fn();
    render(<ChainCard series={SERIES} state="default" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith('PS');
  });
});
