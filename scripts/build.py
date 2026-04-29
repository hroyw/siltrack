"""Orchestrate fetch -> transform -> correlate -> write data/all.json."""
from __future__ import annotations

import datetime as dt
import json
import logging
from pathlib import Path

import pandas as pd

from chain_config import CHAIN_NODES, get_node
from fetch import fetch_all
from transform import align_to_calendar, forward_fill_capped
from correlate import compute_correlations

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'data' / 'all.json'
WINDOWS = [30, 60]
HISTORY_YEARS = 3

logging.basicConfig(level=logging.INFO, format='%(levelname)s %(name)s %(message)s')
log = logging.getLogger('build')


def correlation_pairs() -> list[tuple[str, str]]:
    """For each non-stock node: (node, upstream) and (node, each related stock)."""
    pairs: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()

    def add(a: str, b: str) -> None:
        key = (a, b) if a < b else (b, a)
        if key not in seen and a != b:
            seen.add(key)
            pairs.append((a, b))

    for n in CHAIN_NODES:
        if n['upstream']:
            add(n['id'], n['upstream'])
        for s in n['related_stocks']:
            add(n['id'], s)
    return pairs


def to_points(s: pd.Series) -> list[dict]:
    out: list[dict] = []
    for ts, v in s.items():
        if pd.isna(v):
            continue
        out.append({'date': ts.strftime('%Y-%m-%d'), 'value': float(v)})
    return out


def main() -> int:
    start = dt.date.today() - dt.timedelta(days=365 * HISTORY_YEARS)
    log.info('fetching since %s', start)
    raw = fetch_all(start=start)

    log.info('aligning %d series', len(raw))
    wide = align_to_calendar(raw)
    filled = wide.apply(lambda col: forward_fill_capped(col, max_gap=5))

    log.info('computing correlations across windows %s', WINDOWS)
    pairs = correlation_pairs()
    corr = compute_correlations(filled, pairs, windows=WINDOWS)

    series_payload = []
    for node in CHAIN_NODES:
        col = filled[node['id']] if node['id'] in filled.columns else pd.Series(dtype='float64')
        series_payload.append({
            'id': node['id'],
            'name': node['name'],
            'branch': node['branch'],
            'type': node['type'],
            'unit': node['unit'],
            'upstream': node['upstream'],
            'relatedStocks': node['related_stocks'],
            'points': to_points(col),
        })

    payload = {
        'generatedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
        'series': series_payload,
        'correlations': {str(w): corr[w] for w in WINDOWS},
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    sizes = sum(len(s['points']) for s in series_payload)
    log.info('wrote %s (%d series, %d total points)', OUTPUT, len(series_payload), sizes)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
