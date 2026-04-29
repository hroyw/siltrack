import datetime as dt
import json
from pathlib import Path

import pytest

from scripts.news import pipeline
from scripts.news.types import Event


def _make_event(eid: str, date: str, source: str = 'cninfo', nodes=None) -> Event:
    return {
        'id': eid, 'date': date, 'source': source, 'source_label': 'X',
        'title': 't', 'url': '', 'event_type': 'other',
        'related_nodes': nodes or ['SI'], 'summary': None, 'raw_text_excerpt': '',
    }


@pytest.fixture
def isolated_output(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    out = tmp_path / 'events.json'
    monkeypatch.setattr(pipeline, 'OUTPUT', out)
    return out


def test_pipeline_writes_payload_with_three_sources(isolated_output: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(pipeline.cninfo, 'fetch_events', lambda since: [_make_event('cninfo-1', '2026-04-28')])
    monkeypatch.setattr(pipeline.gfex, 'fetch_events', lambda since: [_make_event('gfex-1', '2026-04-27', source='gfex')])
    monkeypatch.setattr(pipeline.customs, 'fetch_events', lambda: [_make_event('customs-1', '2026-03-31', source='customs')])

    payload = pipeline.run_news_pipeline()
    assert set(payload['sources'].keys()) == {'cninfo', 'gfex', 'customs'}
    assert all(payload['sources'][s]['ok'] for s in ['cninfo', 'gfex', 'customs'])
    assert len(payload['events']) == 3


def test_pipeline_dedups_events_by_id(isolated_output: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    isolated_output.write_text(json.dumps({
        'generated_at': '2026-04-28T00:00:00Z',
        'sources': {'cninfo': {'ok': True, 'last_success_at': '2026-04-28T00:00:00Z',
                               'stale_days': 0, 'error': None, 'lag_note': None},
                    'gfex': {'ok': True, 'last_success_at': '2026-04-28T00:00:00Z',
                             'stale_days': 0, 'error': None, 'lag_note': None},
                    'customs': {'ok': True, 'last_success_at': '2026-04-15T00:00:00Z',
                                'stale_days': 14, 'error': None, 'lag_note': None}},
        'events': [_make_event('cninfo-dup', '2026-04-27')],
    }, ensure_ascii=False), encoding='utf-8')

    monkeypatch.setattr(pipeline.cninfo, 'fetch_events', lambda since: [_make_event('cninfo-dup', '2026-04-27')])
    monkeypatch.setattr(pipeline.gfex, 'fetch_events', lambda since: [])
    monkeypatch.setattr(pipeline.customs, 'fetch_events', lambda: [])

    payload = pipeline.run_news_pipeline()
    ids = [e['id'] for e in payload['events']]
    assert ids.count('cninfo-dup') == 1


def test_pipeline_drops_events_outside_retention(isolated_output: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    today = dt.date.today()
    too_old = (today - dt.timedelta(days=pipeline.RETENTION_DAYS + 5)).isoformat()
    isolated_output.write_text(json.dumps({
        'generated_at': 'x', 'sources': {}, 'events': [_make_event('old-1', too_old)],
    }, ensure_ascii=False), encoding='utf-8')

    monkeypatch.setattr(pipeline.cninfo, 'fetch_events', lambda since: [])
    monkeypatch.setattr(pipeline.gfex, 'fetch_events', lambda since: [])
    monkeypatch.setattr(pipeline.customs, 'fetch_events', lambda: [])

    payload = pipeline.run_news_pipeline()
    assert all(e['id'] != 'old-1' for e in payload['events'])


def test_pipeline_drops_events_with_no_related_nodes(isolated_output: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    bad = _make_event('cninfo-orphan', '2026-04-28')
    bad['related_nodes'] = []
    monkeypatch.setattr(pipeline.cninfo, 'fetch_events', lambda since: [bad])
    monkeypatch.setattr(pipeline.gfex, 'fetch_events', lambda since: [])
    monkeypatch.setattr(pipeline.customs, 'fetch_events', lambda: [])

    payload = pipeline.run_news_pipeline()
    assert all(e['id'] != 'cninfo-orphan' for e in payload['events'])


def test_pipeline_carries_forward_last_success_on_failure(isolated_output: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    isolated_output.write_text(json.dumps({
        'generated_at': 'x',
        'sources': {'cninfo': {'ok': True, 'last_success_at': '2026-04-20T00:00:00+00:00',
                               'stale_days': 0, 'error': None, 'lag_note': None},
                    'gfex': {'ok': True, 'last_success_at': '2026-04-20T00:00:00+00:00',
                             'stale_days': 0, 'error': None, 'lag_note': None},
                    'customs': {'ok': True, 'last_success_at': '2026-04-15T00:00:00+00:00',
                                'stale_days': 5, 'error': None, 'lag_note': None}},
        'events': [],
    }, ensure_ascii=False), encoding='utf-8')

    def boom(**kw):
        raise RuntimeError('down')
    monkeypatch.setattr(pipeline.cninfo, 'fetch_events', boom)
    monkeypatch.setattr(pipeline.gfex, 'fetch_events', lambda since: [])
    monkeypatch.setattr(pipeline.customs, 'fetch_events', lambda: [])

    payload = pipeline.run_news_pipeline()
    assert payload['sources']['cninfo']['ok'] is False
    assert payload['sources']['cninfo']['last_success_at'] == '2026-04-20T00:00:00+00:00'
    assert payload['sources']['cninfo']['stale_days'] >= 0
    assert 'down' in (payload['sources']['cninfo']['error'] or '')


def test_pipeline_attaches_customs_lag_note(isolated_output: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(pipeline.cninfo, 'fetch_events', lambda since: [])
    monkeypatch.setattr(pipeline.gfex, 'fetch_events', lambda since: [])
    monkeypatch.setattr(pipeline.customs, 'fetch_events', lambda: [])
    payload = pipeline.run_news_pipeline()
    assert '滞后' in (payload['sources']['customs']['lag_note'] or '')


def test_write_events_json_creates_file(isolated_output: Path) -> None:
    payload = {'generated_at': 'x', 'sources': {}, 'events': []}
    pipeline.write_events_json(payload)
    assert isolated_output.exists()
    loaded = json.loads(isolated_output.read_text(encoding='utf-8'))
    assert loaded == payload
