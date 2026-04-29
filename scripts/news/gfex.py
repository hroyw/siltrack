"""Scrape Guangzhou Futures Exchange announcement list.

Source: http://www.gfex.com.cn/gfex/bpzgg/list.shtml ("品种公告" — the
comprehensive product-announcements meta list, covering all GFEX listed
products including 工业硅 (SI) and 多晶硅 (PS)).

The page structure is:

    <li>
      <h4>
        <a href="/gfex/tzts/...shtml" title="..." target="_blank">标题</a>
        <span class="time">2026-04-23</span>
      </h4>
    </li>

We narrow `<li>` selection to those that contain the `<h4><a>` + `<span class="time">`
combo so we don't accidentally match navigation `<li>` elements.

Silicon-relevance filtering is delegated to nodes.infer_for_gfex (title-based).
"""
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

LIST_URL = 'http://www.gfex.com.cn/gfex/bpzgg/list.shtml'
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
    # Match the exact h4>a + span.time pattern; this rules out navigation lists.
    for li in soup.select('li'):
        h4 = li.find('h4')
        if not h4:
            continue
        a = h4.find('a')
        date_span = h4.find('span', class_='time')
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
