"""Read manually-maintained customs CSV → events.

The customs site is unreliable to scrape; monthly volumes change once a month
so a hand-maintained CSV is the pragmatic v1. Schema matches data/customs_manual.csv.
"""
from __future__ import annotations

import calendar
import csv
import datetime as dt
import logging
from pathlib import Path

from .classify import classify
from .nodes import infer_for_customs
from .types import Event

log = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parents[2]
CSV_PATH = ROOT / 'data' / 'customs_manual.csv'

LAG_NOTE = '海关数据为月度发布，最新月份通常滞后 30-45 天'


def fetch_events() -> list[Event]:
    if not CSV_PATH.exists():
        log.warning('customs CSV not found at %s', CSV_PATH)
        return []

    events: list[Event] = []
    with CSV_PATH.open(encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            year_month = (row.get('year_month') or '').strip()
            try:
                year_str, month_str = year_month.split('-')
                year, month = int(year_str), int(month_str)
                last_day = calendar.monthrange(year, month)[1]
                event_date = dt.date(year, month, last_day).isoformat()
            except (ValueError, KeyError):
                log.warning('skipping bad year_month: %r', year_month)
                continue

            direction = (row.get('direction') or '').strip()
            qty = (row.get('quantity_tons') or '').strip()
            country = (row.get('country') or '').strip()
            direction_zh = '进口' if direction == 'import' else '出口'
            title = f'{year}-{month:02d} 多晶硅{direction_zh}：{qty} 吨（{country or "合计"}）'

            events.append({
                'id': f'customs-{year_month}-{direction}-{i:03d}',
                'date': event_date,
                'source': 'customs',
                'source_label': '海关总署',
                'title': title,
                'url': '',
                'event_type': classify(title),
                'related_nodes': infer_for_customs(),
                'summary': None,
                'raw_text_excerpt': (row.get('note') or '')[:200],
            })
    return events
