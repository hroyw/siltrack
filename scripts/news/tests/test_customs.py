from pathlib import Path

import pytest

from scripts.news import customs


@pytest.fixture
def csv_with_two_rows(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    csv = tmp_path / 'customs_manual.csv'
    csv.write_text(
        'year_month,hs_code,direction,country,quantity_tons,value_usd,note\n'
        '2026-03,28046190,import,合计,8420,178200000,样本\n'
        '2026-02,28046190,export,韩国,1200,30000000,\n',
        encoding='utf-8',
    )
    monkeypatch.setattr(customs, 'CSV_PATH', csv)
    return csv


def test_fetch_events_returns_one_event_per_row(csv_with_two_rows: Path) -> None:
    events = customs.fetch_events()
    assert len(events) == 2


def test_fetch_events_uses_month_end_date(csv_with_two_rows: Path) -> None:
    events = customs.fetch_events()
    march_event = next(e for e in events if '2026-03' in e['title'])
    # March has 31 days
    assert march_event['date'] == '2026-03-31'


def test_fetch_events_assigns_customs_source(csv_with_two_rows: Path) -> None:
    events = customs.fetch_events()
    assert all(e['source'] == 'customs' for e in events)
    assert all(e['source_label'] == '海关总署' for e in events)


def test_fetch_events_related_nodes_default(csv_with_two_rows: Path) -> None:
    events = customs.fetch_events()
    assert all(e['related_nodes'] == ['PS', 'polysilicon-dense'] for e in events)


def test_fetch_events_handles_missing_csv(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(customs, 'CSV_PATH', tmp_path / 'does_not_exist.csv')
    assert customs.fetch_events() == []


def test_fetch_events_skips_bad_year_month(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    csv = tmp_path / 'customs_manual.csv'
    csv.write_text(
        'year_month,hs_code,direction,country,quantity_tons,value_usd,note\n'
        'NOT_A_DATE,28046190,import,合计,1,1,\n'
        '2026-04,28046190,import,合计,100,1000000,\n',
        encoding='utf-8',
    )
    monkeypatch.setattr(customs, 'CSV_PATH', csv)
    events = customs.fetch_events()
    assert len(events) == 1
    assert '2026-04' in events[0]['title']


def test_lag_note_constant_is_set() -> None:
    assert '滞后' in customs.LAG_NOTE
