import datetime as dt

import pandas as pd
import pytest

from scripts.news import cninfo

FAKE_TODAY = dt.date(2026, 4, 28)


def _make_df(rows: list[dict]) -> pd.DataFrame:
    # Mirrors real akshare.stock_notice_report column layout
    return pd.DataFrame(rows, columns=['代码', '名称', '公告标题', '公告类型', '公告日期', '网址'])


@pytest.fixture(autouse=True)
def freeze_today(monkeypatch: pytest.MonkeyPatch) -> None:
    """Freeze cninfo._today() so the date-iteration loop is deterministic."""
    monkeypatch.setattr(cninfo, '_today', lambda: FAKE_TODAY)


@pytest.fixture
def patched_ak(monkeypatch: pytest.MonkeyPatch) -> None:
    """Patch ak.stock_notice_report to return a single tracked-stock announcement on 2026-04-28."""
    def fake(symbol: str, date: str):
        if date == '20260428':
            return _make_df([
                {'代码': '603260', '名称': '合盛硅业', '公告标题': '关于鄯善基地工业硅装置临时检修的公告',
                 '公告类型': '其他', '公告日期': '2026-04-28',
                 '网址': 'https://data.eastmoney.com/notices/detail/603260/abc.html'},
                # Untracked stock — must be filtered out
                {'代码': '999999', '名称': '某无关公司', '公告标题': '日常公告',
                 '公告类型': '其他', '公告日期': '2026-04-28', '网址': ''},
            ])
        return _make_df([])

    monkeypatch.setattr(cninfo.ak, 'stock_notice_report', fake)


def test_fetch_events_filters_to_tracked_stocks(patched_ak: None) -> None:
    events = cninfo.fetch_events(since=FAKE_TODAY)
    assert len(events) == 1
    assert events[0]['source'] == 'cninfo'
    assert '603260' in events[0]['related_nodes']


def test_fetch_events_captures_url_from_网址_column(patched_ak: None) -> None:
    """Regression: real akshare uses '网址' (NOT '公告链接')."""
    events = cninfo.fetch_events(since=FAKE_TODAY)
    assert events[0]['url'] == 'https://data.eastmoney.com/notices/detail/603260/abc.html'


def test_fetch_events_id_is_stable(patched_ak: None) -> None:
    a = cninfo.fetch_events(since=FAKE_TODAY)
    b = cninfo.fetch_events(since=FAKE_TODAY)
    assert a[0]['id'] == b[0]['id']


def test_fetch_events_returns_empty_on_akshare_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(**kwargs):
        raise RuntimeError('akshare exploded')
    monkeypatch.setattr(cninfo.ak, 'stock_notice_report', boom)
    assert cninfo.fetch_events(since=FAKE_TODAY) == []


def test_fetch_events_returns_empty_when_since_after_today(patched_ak: None) -> None:
    future = FAKE_TODAY + dt.timedelta(days=3)
    assert cninfo.fetch_events(since=future) == []
