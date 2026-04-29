"""Fetch listed-company announcements from cninfo via akshare."""
from __future__ import annotations

import datetime as dt
import hashlib
import logging
import sys
from pathlib import Path

import akshare as ak

_SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from chain_config import CHAIN_NODES  # noqa: E402

from .classify import classify
from .nodes import infer_for_cninfo
from .types import Event

log = logging.getLogger(__name__)

STOCK_CODES = {n['id'] for n in CHAIN_NODES if n['type'] == 'stock'}


def _today() -> dt.date:
    """Indirection so tests can freeze the date."""
    return dt.date.today()


def fetch_events(since: dt.date) -> list[Event]:
    today = _today()
    days = (today - since).days
    if days < 0:
        return []

    events: list[Event] = []
    for offset in range(days + 1):
        d = since + dt.timedelta(days=offset)
        date_str = d.strftime('%Y%m%d')
        try:
            df = ak.stock_notice_report(symbol='全部', date=date_str)
        except Exception as e:
            log.warning('cninfo fetch failed for %s: %s', date_str, e)
            continue
        if df is None or df.empty:
            continue

        for _, row in df.iterrows():
            code = str(row.get('代码', '')).strip()
            if code not in STOCK_CODES:
                continue
            title = str(row.get('公告标题', '')).strip()
            if not title:
                continue
            # akshare's stock_notice_report returns the URL under '网址'
            # (NOT '公告链接' which doesn't exist). Other columns are:
            # 代码 / 名称 / 公告标题 / 公告类型 / 公告日期 / 网址
            url = str(row.get('网址', '')).strip()
            ann_id = hashlib.md5(f'{code}{title}{date_str}'.encode('utf-8')).hexdigest()[:4]
            events.append({
                'id': f'cninfo-{code}-{date_str}-{ann_id}',
                'date': d.isoformat(),
                'source': 'cninfo',
                'source_label': '巨潮资讯',
                'title': title,
                'url': url,
                'event_type': classify(title),
                'related_nodes': infer_for_cninfo(code),
                'summary': None,
                'raw_text_excerpt': '',
            })
    return events
