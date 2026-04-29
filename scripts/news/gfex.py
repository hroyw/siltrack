"""Scrape Guangzhou Futures Exchange announcement list."""
from __future__ import annotations

import datetime as dt
import hashlib
import logging
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from .classify import classify
from .nodes import infer_for_gfex
from .types import Event

log = logging.getLogger(__name__)

LIST_URL = 'http://www.gfex.com.cn/gfex/zxgg/index.htm'
HEADERS = {'User-Agent': 'siltrack-bot/0.1 (+https://github.com/)'}
TIMEOUT = 20


def fetch_events(since: dt.date) -> list[Event]:
    try:
        resp = requests.get(LIST_URL, headers=HEADERS, timeout=TIMEOUT)
        resp.raise_for_status()
        resp.encoding = resp.apparent_encoding or 'utf-8'
    except Exception as e:
        log.warning('gfex list fetch failed: %s', e)
        return []
    return parse_list(resp.text, since=since, base_url=LIST_URL)


def parse_list(html: str, since: dt.date, base_url: str) -> list[Event]:
    soup = BeautifulSoup(html, 'html.parser')
    events: list[Event] = []
    seen_ids: set[str] = set()
    for li in soup.select('li'):
        a = li.find('a')
        date_span = li.find('span')
        if not a or not date_span:
            continue
        title = a.get_text(strip=True)
        if not title:
            continue
        date = parse_date(date_span.get_text(strip=True))
        if date is None or date < since:
            continue
        href = a.get('href', '')
        url = urljoin(base_url, href) if href else ''
        date_str = date.strftime('%Y%m%d')
        h = hashlib.md5(title.encode('utf-8')).hexdigest()[:4]
        event_id = f'gfex-{date_str}-{h}'
        if event_id in seen_ids:
            continue
        seen_ids.add(event_id)
        events.append({
            'id': event_id,
            'date': date.isoformat(),
            'source': 'gfex',
            'source_label': '广期所',
            'title': title,
            'url': url,
            'event_type': classify(title),
            'related_nodes': infer_for_gfex(title),
            'summary': None,
            'raw_text_excerpt': '',
        })
    return events


def parse_date(text: str) -> dt.date | None:
    """Parse 'YYYY-MM-DD', 'YYYY/MM/DD', or '[YYYY-MM-DD]'."""
    cleaned = text.strip().strip('[]').replace('/', '-').replace('.', '-')
    try:
        return dt.datetime.strptime(cleaned, '%Y-%m-%d').date()
    except ValueError:
        return None
