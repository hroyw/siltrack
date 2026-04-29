"""Typed dicts for the news pipeline."""
from __future__ import annotations

from typing import Literal, Optional, TypedDict

EventType = Literal[
    'policy', 'delivery', 'inventory',
    'production_halt', 'production_start', 'capacity_change',
    'order_contract', 'financial_report', 'import_export', 'other',
]

SourceName = Literal['cninfo', 'gfex', 'customs']


class Event(TypedDict):
    id: str
    date: str          # YYYY-MM-DD, business date of the event
    source: SourceName
    source_label: str
    title: str
    url: str
    event_type: EventType
    related_nodes: list[str]
    summary: Optional[str]
    raw_text_excerpt: str


class SourceStatus(TypedDict):
    ok: bool
    last_success_at: str   # ISO8601 UTC, '' when never succeeded
    stale_days: int
    error: Optional[str]
    lag_note: Optional[str]
