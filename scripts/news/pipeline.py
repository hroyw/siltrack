"""Run all news scrapers and merge with previous payload → data/events.json."""
from __future__ import annotations

import datetime as dt
import json
import logging
from pathlib import Path
from typing import Any, Callable

from . import cninfo, customs, gfex
from .types import Event, SourceStatus

log = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / 'data' / 'events.json'

RETENTION_DAYS = 730   # 2 years
LOOKBACK_DAYS = 7      # daily scrapers re-fetch last week to absorb weekend gaps


def _now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def _run_source(name: str, fn: Callable[[], list[Event]]) -> tuple[list[Event], SourceStatus]:
    try:
        events = fn()
        return events, {'ok': True, 'last_success_at': _now_iso(), 'stale_days': 0,
                        'error': None, 'lag_note': None}
    except Exception as e:
        log.exception('%s scraper raised', name)
        return [], {'ok': False, 'last_success_at': '', 'stale_days': 0,
                    'error': str(e), 'lag_note': None}


def _merge_status(prev: SourceStatus | None, fresh: SourceStatus, today: dt.date) -> SourceStatus:
    if fresh['ok']:
        return fresh
    out = dict(fresh)
    if prev and prev.get('last_success_at'):
        out['last_success_at'] = prev['last_success_at']
        try:
            last_date = dt.datetime.fromisoformat(prev['last_success_at']).date()
            out['stale_days'] = max(0, (today - last_date).days)
        except ValueError:
            out['stale_days'] = 0
    return out  # type: ignore[return-value]


def _load_previous_payload() -> dict[str, Any] | None:
    if not OUTPUT.exists():
        return None
    try:
        return json.loads(OUTPUT.read_text(encoding='utf-8'))
    except Exception:
        log.warning('previous events.json unreadable, starting fresh')
        return None


def run_news_pipeline() -> dict[str, Any]:
    today = dt.date.today()
    since = today - dt.timedelta(days=LOOKBACK_DAYS)
    prev = _load_previous_payload()

    cninfo_events, cninfo_status = _run_source('cninfo', lambda: cninfo.fetch_events(since=since))
    gfex_events, gfex_status     = _run_source('gfex',   lambda: gfex.fetch_events(since=since))
    customs_events, customs_status = _run_source('customs', customs.fetch_events)
    customs_status['lag_note'] = customs.LAG_NOTE

    prev_sources: dict[str, SourceStatus] = (prev or {}).get('sources', {})
    sources: dict[str, SourceStatus] = {
        'cninfo':  _merge_status(prev_sources.get('cninfo'),  cninfo_status,  today),
        'gfex':    _merge_status(prev_sources.get('gfex'),    gfex_status,    today),
        'customs': _merge_status(prev_sources.get('customs'), customs_status, today),
    }
    sources['customs']['lag_note'] = customs.LAG_NOTE

    cutoff = (today - dt.timedelta(days=RETENTION_DAYS)).isoformat()
    by_id: dict[str, Event] = {}
    if prev:
        for e in prev.get('events', []):
            if e.get('date', '') >= cutoff and e.get('related_nodes'):
                by_id[e['id']] = e
    for e in cninfo_events + gfex_events + customs_events:
        if e['date'] >= cutoff and e['related_nodes']:
            by_id[e['id']] = e

    merged = sorted(by_id.values(), key=lambda e: e['date'], reverse=True)

    return {
        'generated_at': _now_iso(),
        'sources': sources,
        'events': merged,
    }


def write_events_json(payload: dict[str, Any]) -> Path:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    return OUTPUT
