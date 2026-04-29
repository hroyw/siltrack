import datetime as dt
from pathlib import Path

import pytest

from scripts.news import gfex

FIXTURE = Path(__file__).parent / 'fixtures' / 'gfex_list.html'


def test_parse_list_extracts_three_in_window() -> None:
    html = FIXTURE.read_text(encoding='utf-8')
    events = gfex.parse_list(html, since=dt.date(2026, 4, 1), base_url=gfex.LIST_URL)
    titles = [e['title'] for e in events]
    assert '关于工业硅期货持仓限额调整的公告' in titles
    assert '多晶硅期货标准仓单注册情况' in titles
    assert '风险控制管理办法修订通知' in titles


def test_parse_list_drops_pre_since_entries() -> None:
    html = FIXTURE.read_text(encoding='utf-8')
    events = gfex.parse_list(html, since=dt.date(2026, 4, 1), base_url=gfex.LIST_URL)
    assert all('旧公告' not in e['title'] for e in events)


def test_parse_list_drops_empty_titles() -> None:
    html = FIXTURE.read_text(encoding='utf-8')
    events = gfex.parse_list(html, since=dt.date(2026, 4, 1), base_url=gfex.LIST_URL)
    assert all(e['title'] for e in events)


def test_parse_list_resolves_relative_urls() -> None:
    html = FIXTURE.read_text(encoding='utf-8')
    events = gfex.parse_list(html, since=dt.date(2026, 4, 1), base_url='http://www.gfex.com.cn/gfex/zxgg/index.htm')
    si_event = next(e for e in events if '工业硅' in e['title'])
    assert si_event['url'].startswith('http://www.gfex.com.cn/')


def test_parse_list_assigns_related_nodes() -> None:
    html = FIXTURE.read_text(encoding='utf-8')
    events = gfex.parse_list(html, since=dt.date(2026, 4, 1), base_url=gfex.LIST_URL)
    si = next(e for e in events if '工业硅' in e['title'])
    ps = next(e for e in events if '多晶硅' in e['title'])
    risk = next(e for e in events if '风险控制' in e['title'])
    assert si['related_nodes'] == ['SI']
    assert ps['related_nodes'] == ['PS']
    assert risk['related_nodes'] == ['SI', 'PS']


def test_parse_list_skips_navigation_li_without_h4() -> None:
    """Regression: nav <li> with raw <a> + <span> (no <h4> wrapper) must not be picked up."""
    html = FIXTURE.read_text(encoding='utf-8')
    events = gfex.parse_list(html, since=dt.date(2026, 4, 1), base_url=gfex.LIST_URL)
    titles = [e['title'] for e in events]
    assert '首页' not in titles
    assert '品种' not in titles


def test_parse_list_id_is_stable_across_runs() -> None:
    html = FIXTURE.read_text(encoding='utf-8')
    a = gfex.parse_list(html, since=dt.date(2026, 4, 1), base_url=gfex.LIST_URL)
    b = gfex.parse_list(html, since=dt.date(2026, 4, 1), base_url=gfex.LIST_URL)
    assert {e['id'] for e in a} == {e['id'] for e in b}


@pytest.mark.parametrize('text, expected', [
    ('2026-04-28', dt.date(2026, 4, 28)),
    ('2026/04/28', dt.date(2026, 4, 28)),
    ('[2026-04-28]', dt.date(2026, 4, 28)),
    ('not a date', None),
    ('', None),
])
def test_parse_date(text: str, expected) -> None:
    assert gfex.parse_date(text) == expected


def test_fetch_events_returns_empty_on_network_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(*args, **kwargs):
        raise ConnectionError('network down')
    monkeypatch.setattr(gfex.requests, 'get', boom)
    assert gfex.fetch_events(since=dt.date(2026, 4, 1)) == []
