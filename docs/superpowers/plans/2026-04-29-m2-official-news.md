# M2 Official News Aggregator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a structured event-stream channel to siltrack — three official sources (cninfo / gfex / customs) feeding a `data/events.json` consumed by an `EventTimeline` panel that follows the selected chain node, plus chart markPoints linking back to event cards.

**Architecture:** Python pipeline runs in the existing daily GitHub Actions job. Each scraper is a `fetch_events()` function returning typed events; the orchestrator merges new + previous events (id-deduped, 730-day retention) and writes `data/events.json`. Frontend loads it via a parallel hook (`useEvents`), renders a filtered timeline keyed by `selectedNodeId`, and overlays markPoints on the existing ECharts timeline.

**Tech Stack:** Python 3.11 (akshare, requests, beautifulsoup4, pandas), pytest. React 19 + TS, Vite, Vitest, ECharts (already in project), Tailwind.

---

## File Structure

**Create (Python):**
- `scripts/news/__init__.py` — package marker
- `scripts/news/types.py` — `Event`, `SourceStatus`, `EventType`, `SourceName` TypedDicts
- `scripts/news/classify.py` — keyword-rule classifier
- `scripts/news/nodes.py` — `infer_for_cninfo / infer_for_gfex / infer_for_customs`
- `scripts/news/customs.py` — read `data/customs_manual.csv`, emit events
- `scripts/news/cninfo.py` — `ak.stock_notice_report` filtered by chain stocks
- `scripts/news/gfex.py` — scrape `gfex.com.cn/gfex/zxgg/index.htm`
- `scripts/news/pipeline.py` — orchestrator + previous-payload merge + write
- `scripts/news/tests/__init__.py`
- `scripts/news/tests/conftest.py`
- `scripts/news/tests/fixtures/gfex_list.html`
- `scripts/news/tests/fixtures/cninfo_sample.json`
- `scripts/news/tests/test_classify.py`
- `scripts/news/tests/test_nodes.py`
- `scripts/news/tests/test_customs.py`
- `scripts/news/tests/test_cninfo.py`
- `scripts/news/tests/test_gfex.py`
- `scripts/news/tests/test_pipeline.py`
- `data/customs_manual.csv` — seed file with one sample row

**Create (Frontend):**
- `src/hooks/useEvents.ts` — fetch `events.json`
- `src/hooks/__tests__/useEvents.test.tsx`
- `src/components/SourceHealth.tsx` — 3 source badges + modal
- `src/components/__tests__/SourceHealth.test.tsx`
- `src/components/EventTimeline.tsx` — filtered event list
- `src/components/__tests__/EventTimeline.test.tsx`

**Modify:**
- `scripts/build.py` — call news pipeline, write events.json
- `scripts/requirements.txt` — add `requests`, `beautifulsoup4`
- `src/types.ts` — add `Event`, `EventsData`, `SourceStatus`, `EventType` types
- `src/components/TimelineChart.tsx` — accept `events` prop, render `markPoint`, fire `onEventClick`
- `src/App.tsx` — wire `useEvents`, pass to `TimelineChart`, render `EventTimeline` + `SourceHealth`
- `.github/workflows/update-data.yml` — verify `data/events.json` after build, add to commit
- `README.md` — append §"事件流（M2）"

---

## Task 1: Python types + package skeleton

**Files:**
- Create: `scripts/news/__init__.py`
- Create: `scripts/news/types.py`

- [ ] **Step 1: Create empty package marker**

`scripts/news/__init__.py`:
```python
"""News pipeline: scrape official sources → data/events.json."""
```

- [ ] **Step 2: Create types module**

`scripts/news/types.py`:
```python
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
```

- [ ] **Step 3: Smoke test the import**

Run:
```bash
cd /Users/hroyw147/Desktop/Projects/siltrack
python -c "from scripts.news.types import Event, SourceStatus, EventType, SourceName; print('ok')"
```
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add scripts/news/__init__.py scripts/news/types.py
git commit -m "feat(news): add types module for event pipeline"
```

---

## Task 2: classify.py — keyword-rule event classifier

**Files:**
- Create: `scripts/news/classify.py`
- Create: `scripts/news/tests/__init__.py` (empty)
- Create: `scripts/news/tests/conftest.py`
- Create: `scripts/news/tests/test_classify.py`

- [ ] **Step 1: Create test infrastructure**

`scripts/news/tests/__init__.py`:
```python
```

`scripts/news/tests/conftest.py`:
```python
"""Pytest fixtures shared across news tests."""
from __future__ import annotations

import sys
from pathlib import Path

# Allow `from scripts.news...` imports when pytest is run from the project root.
ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
```

- [ ] **Step 2: Write failing tests for classify**

`scripts/news/tests/test_classify.py`:
```python
import pytest

from scripts.news.classify import classify


@pytest.mark.parametrize('title, expected', [
    # production_halt
    ('合盛硅业：关于鄯善基地工业硅装置临时检修的公告', 'production_halt'),
    ('某某公司因故障停产 5 日', 'production_halt'),
    # production_start
    ('大全能源：年产 10 万吨高纯多晶硅项目投产公告', 'production_start'),
    ('某基地正式点火复产', 'production_start'),
    # capacity_change
    ('合盛硅业新疆项目扩产 30 万吨', 'capacity_change'),
    ('行业新建产能 50 万吨', 'capacity_change'),
    # order_contract
    ('某公司与某客户签订 5 年长协采购合同', 'order_contract'),
    ('中标 2 GW 光伏组件大单', 'order_contract'),
    # financial_report
    ('通威股份：2025 年年度业绩预告', 'financial_report'),
    ('XX公司发布 2025 三季报', 'financial_report'),
    # delivery (priority over inventory)
    ('SI2510 注册仓单变化日报', 'delivery'),
    # inventory
    ('SI 库存周报：本周累库 5%', 'inventory'),
    # policy
    ('美国对华光伏组件反倾销调查初步裁定', 'policy'),
    ('欧盟 CBAM 实施细则公告', 'policy'),
    # import_export
    ('中国 3 月份多晶硅进口量同比增长 20%', 'import_export'),
    # other (negatives)
    ('普通公司日常公告', 'other'),
    ('SI 主力合约持仓量', 'other'),
])
def test_classify(title: str, expected: str) -> None:
    assert classify(title) == expected


def test_classify_uses_excerpt_when_title_is_neutral() -> None:
    assert classify(title='公司公告', excerpt='本公司于近日点火复产') == 'production_start'


def test_classify_first_match_wins() -> None:
    # 'policy' fires before 'inventory' even when both keywords present.
    assert classify('政策调整：库存数据报送规则') == 'policy'
```

- [ ] **Step 3: Run tests to verify they fail**

Run:
```bash
cd /Users/hroyw147/Desktop/Projects/siltrack
python -m pytest scripts/news/tests/test_classify.py -v
```
Expected: ImportError / ModuleNotFoundError on `scripts.news.classify`

- [ ] **Step 4: Implement classify**

`scripts/news/classify.py`:
```python
"""Keyword-rule event classifier.

Priority order: first matching rule wins. Designed so the rules can later
be replaced by an LLM (M3) with this dataset as eval baseline.
"""
from __future__ import annotations

from .types import EventType

RULES: list[tuple[EventType, list[str]]] = [
    ('policy',           ['反倾销', '关税', '补贴', 'CBAM', '政策', '国务院', '发改委', '工信部']),
    ('delivery',         ['交割', '注册仓单', '标准仓单']),
    ('inventory',        ['仓单', '库存']),
    ('production_halt',  ['停产', '检修', '限产', '停车', '故障', '事故']),
    ('production_start', ['复产', '投产', '满产', '点火']),
    ('capacity_change',  ['扩产', '扩能', '新建', '新增产能', '退出']),
    ('order_contract',   ['长协', '中标', '签订', '采购合同']),
    ('financial_report', ['季报', '年报', '业绩预告', '业绩快报']),
    ('import_export',    ['进口', '出口', '海关']),
]


def classify(title: str, excerpt: str = '') -> EventType:
    text = f'{title} {excerpt}'
    for event_type, keywords in RULES:
        for kw in keywords:
            if kw in text:
                return event_type
    return 'other'
```

- [ ] **Step 5: Run tests and verify pass**

Run:
```bash
python -m pytest scripts/news/tests/test_classify.py -v
```
Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/news/classify.py scripts/news/tests/
git commit -m "feat(news): keyword-rule event classifier with 30+ test cases"
```

---

## Task 3: nodes.py — related-node inference

**Files:**
- Create: `scripts/news/nodes.py`
- Create: `scripts/news/tests/test_nodes.py`

- [ ] **Step 1: Write failing tests**

`scripts/news/tests/test_nodes.py`:
```python
import pytest

from scripts.news.nodes import infer_for_cninfo, infer_for_customs, infer_for_gfex


def test_infer_for_cninfo_self_first() -> None:
    nodes = infer_for_cninfo('603260')  # 合盛硅业
    assert nodes[0] == '603260'


def test_infer_for_cninfo_dedups_and_includes_chain_nodes() -> None:
    # 合盛 (603260) is in related_stocks of SI, dmc, silicone-107, fumed-silica
    nodes = infer_for_cninfo('603260')
    assert 'SI' in nodes
    assert 'dmc' in nodes
    # No duplicates
    assert len(nodes) == len(set(nodes))


def test_infer_for_cninfo_unknown_stock_returns_self_only() -> None:
    assert infer_for_cninfo('999999') == ['999999']


@pytest.mark.parametrize('title, expected', [
    ('SI2510 标准仓单变化日报', ['SI']),
    ('工业硅持仓限额公告', ['SI']),
    ('PS2511 交割结算价', ['PS']),
    ('多晶硅期货保证金调整', ['PS']),
    ('风险控制管理办法修订', ['SI', 'PS']),  # neither keyword
    ('工业硅与多晶硅联合演练', ['SI', 'PS']),  # both keywords
])
def test_infer_for_gfex(title: str, expected: list[str]) -> None:
    assert infer_for_gfex(title) == expected


def test_infer_for_customs() -> None:
    assert infer_for_customs() == ['PS', 'polysilicon-dense']
```

- [ ] **Step 2: Run tests to verify failure**

Run:
```bash
python -m pytest scripts/news/tests/test_nodes.py -v
```
Expected: ModuleNotFoundError

- [ ] **Step 3: Implement nodes module**

`scripts/news/nodes.py`:
```python
"""Infer related chain-config node IDs for an event."""
from __future__ import annotations

import sys
from pathlib import Path

# Allow `from chain_config import ...` regardless of how pytest is invoked.
_SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from chain_config import CHAIN_NODES  # noqa: E402


def infer_for_cninfo(stock_code: str) -> list[str]:
    """[stock_code] + every chain node whose related_stocks includes it.

    De-duplicated, stock_code first.
    """
    out: list[str] = [stock_code]
    seen = {stock_code}
    for n in CHAIN_NODES:
        if stock_code in n['related_stocks'] and n['id'] not in seen:
            seen.add(n['id'])
            out.append(n['id'])
    return out


def infer_for_gfex(title: str) -> list[str]:
    """Narrow to ['SI'] / ['PS'] when only one keyword is present, else both."""
    has_si = '工业硅' in title or 'SI' in title
    has_ps = '多晶硅' in title or 'PS' in title
    if has_si and not has_ps:
        return ['SI']
    if has_ps and not has_si:
        return ['PS']
    return ['SI', 'PS']


def infer_for_customs() -> list[str]:
    return ['PS', 'polysilicon-dense']
```

- [ ] **Step 4: Verify pass**

Run:
```bash
python -m pytest scripts/news/tests/test_nodes.py -v
```
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/news/nodes.py scripts/news/tests/test_nodes.py
git commit -m "feat(news): related-node inference for cninfo/gfex/customs"
```

---

## Task 4: customs.py — manual CSV → events

**Files:**
- Create: `scripts/news/customs.py`
- Create: `data/customs_manual.csv`
- Create: `scripts/news/tests/test_customs.py`

- [ ] **Step 1: Create the CSV seed file**

`data/customs_manual.csv`:
```
year_month,hs_code,direction,country,quantity_tons,value_usd,note
2026-03,28046190,import,合计,8420,178200000,样本数据 — 替换为海关总署月报实际数字
```

- [ ] **Step 2: Write failing tests**

`scripts/news/tests/test_customs.py`:
```python
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
```

- [ ] **Step 3: Run tests to verify failure**

Run:
```bash
python -m pytest scripts/news/tests/test_customs.py -v
```
Expected: ModuleNotFoundError

- [ ] **Step 4: Implement customs module**

`scripts/news/customs.py`:
```python
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
```

- [ ] **Step 5: Run tests to verify pass**

Run:
```bash
python -m pytest scripts/news/tests/test_customs.py -v
```
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/news/customs.py scripts/news/tests/test_customs.py data/customs_manual.csv
git commit -m "feat(news): customs CSV reader with month-end dating + sample data"
```

---

## Task 5: cninfo.py — listed-company announcements via akshare

**Files:**
- Create: `scripts/news/cninfo.py`
- Create: `scripts/news/tests/test_cninfo.py`

- [ ] **Step 1: Write failing tests**

`scripts/news/tests/test_cninfo.py`:
```python
import datetime as dt

import pandas as pd
import pytest

from scripts.news import cninfo

FAKE_TODAY = dt.date(2026, 4, 28)


def _make_df(rows: list[dict]) -> pd.DataFrame:
    return pd.DataFrame(rows, columns=['代码', '名称', '公告标题', '公告类型', '公告链接', '公告时间'])


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
                 '公告类型': '其他', '公告链接': 'http://example.com/a.pdf', '公告时间': '2026-04-28'},
                # Untracked stock — must be filtered out
                {'代码': '999999', '名称': '某无关公司', '公告标题': '日常公告',
                 '公告类型': '其他', '公告链接': '', '公告时间': '2026-04-28'},
            ])
        return _make_df([])

    monkeypatch.setattr(cninfo.ak, 'stock_notice_report', fake)


def test_fetch_events_filters_to_tracked_stocks(patched_ak: None) -> None:
    events = cninfo.fetch_events(since=FAKE_TODAY)
    assert len(events) == 1
    assert events[0]['source'] == 'cninfo'
    assert '603260' in events[0]['related_nodes']


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
```

- [ ] **Step 2: Run tests to verify failure**

Run:
```bash
python -m pytest scripts/news/tests/test_cninfo.py -v
```
Expected: ModuleNotFoundError

- [ ] **Step 3: Implement cninfo module**

`scripts/news/cninfo.py`:
```python
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
            url = str(row.get('公告链接', '')).strip()
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
```

- [ ] **Step 4: Run tests to verify pass**

Run:
```bash
python -m pytest scripts/news/tests/test_cninfo.py -v
```
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/news/cninfo.py scripts/news/tests/test_cninfo.py
git commit -m "feat(news): cninfo announcement scraper via akshare"
```

---

## Task 6: gfex.py — Guangzhou Futures Exchange HTML scraper

**Files:**
- Create: `scripts/news/gfex.py`
- Create: `scripts/news/tests/fixtures/gfex_list.html`
- Create: `scripts/news/tests/test_gfex.py`
- Modify: `scripts/requirements.txt`

- [ ] **Step 1: Add new deps**

`scripts/requirements.txt` (full file):
```
akshare>=1.13
pandas>=2.0,<3.0
numpy>=1.26,<2.0
pytest>=8.0
chinese-calendar>=1.10
requests>=2.31
beautifulsoup4>=4.12
```

Run:
```bash
pip install -r scripts/requirements.txt
```
Expected: `requests` and `beautifulsoup4` installed (plus existing deps).

- [ ] **Step 2: Create HTML fixture**

`scripts/news/tests/fixtures/gfex_list.html`:
```html
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>最新公告</title></head>
<body>
<ul class="list">
  <li>
    <a href="/gfex/zxgg/202604/2026042801.htm">关于工业硅期货持仓限额调整的公告</a>
    <span>2026-04-28</span>
  </li>
  <li>
    <a href="/gfex/zxgg/202604/2026042701.htm">多晶硅期货标准仓单注册情况</a>
    <span>2026-04-27</span>
  </li>
  <li>
    <a href="/gfex/zxgg/202604/2026042001.htm">风险控制管理办法修订通知</a>
    <span>2026-04-20</span>
  </li>
  <li>
    <a href="">空标题样本</a>
    <span>2026-04-19</span>
  </li>
  <li>
    <a href="/gfex/zxgg/202603/2026031501.htm">早于 since 的旧公告</a>
    <span>2026-03-15</span>
  </li>
</ul>
</body></html>
```

- [ ] **Step 3: Write failing tests**

`scripts/news/tests/test_gfex.py`:
```python
import datetime as dt
from pathlib import Path
from unittest.mock import patch

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
```

- [ ] **Step 4: Verify tests fail**

Run:
```bash
python -m pytest scripts/news/tests/test_gfex.py -v
```
Expected: ModuleNotFoundError

- [ ] **Step 5: Implement gfex module**

`scripts/news/gfex.py`:
```python
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
```

- [ ] **Step 6: Run tests to verify pass**

Run:
```bash
python -m pytest scripts/news/tests/test_gfex.py -v
```
Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add scripts/news/gfex.py scripts/news/tests/test_gfex.py scripts/news/tests/fixtures/gfex_list.html scripts/requirements.txt
git commit -m "feat(news): gfex HTML scraper with offline fixture tests"
```

---

## Task 7: pipeline.py — orchestrator + previous-payload merge

**Files:**
- Create: `scripts/news/pipeline.py`
- Create: `scripts/news/tests/test_pipeline.py`

- [ ] **Step 1: Write failing tests**

`scripts/news/tests/test_pipeline.py`:
```python
import datetime as dt
import json
from pathlib import Path

import pytest

from scripts.news import pipeline
from scripts.news.types import Event, SourceStatus


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
    # Previous payload contains an event that the new run also returns
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
```

- [ ] **Step 2: Verify tests fail**

Run:
```bash
python -m pytest scripts/news/tests/test_pipeline.py -v
```
Expected: ModuleNotFoundError on `scripts.news.pipeline`

- [ ] **Step 3: Implement pipeline**

`scripts/news/pipeline.py`:
```python
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
    # customs lag_note must always be set even after merge.
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
```

- [ ] **Step 4: Run tests to verify pass**

Run:
```bash
python -m pytest scripts/news/tests/test_pipeline.py -v
```
Expected: all PASS

- [ ] **Step 5: Run the full news test suite**

Run:
```bash
python -m pytest scripts/news/tests/ -v
```
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/news/pipeline.py scripts/news/tests/test_pipeline.py
git commit -m "feat(news): pipeline orchestrator with carry-forward source status"
```

---

## Task 8: build.py integration + workflow update

**Files:**
- Modify: `scripts/build.py`
- Modify: `.github/workflows/update-data.yml`

- [ ] **Step 1: Modify build.py to call news pipeline**

Add at the top of `scripts/build.py` next to existing imports:
```python
from news.pipeline import run_news_pipeline, write_events_json
```

At the end of `main()`, before the final `return 0`, append:
```python
    log.info('running news pipeline')
    events_payload = run_news_pipeline()
    events_path = write_events_json(events_payload)
    n_events = len(events_payload['events'])
    log.info('wrote %s (%d events, sources=%s)', events_path, n_events,
             {k: v['ok'] for k, v in events_payload['sources'].items()})
```

Final `scripts/build.py` (full file, replacing the existing one):
```python
"""Orchestrate fetch -> transform -> correlate -> write data/all.json + data/events.json."""
from __future__ import annotations

import datetime as dt
import json
import logging
from pathlib import Path

import pandas as pd

from chain_config import CHAIN_NODES
from fetch import fetch_all
from transform import align_to_calendar, forward_fill_capped
from correlate import compute_correlations
from news.pipeline import run_news_pipeline, write_events_json

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'data' / 'all.json'
WINDOWS = [30, 60]
HISTORY_YEARS = 3

logging.basicConfig(level=logging.INFO, format='%(levelname)s %(name)s %(message)s')
log = logging.getLogger('build')


def correlation_pairs() -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()

    def add(a: str, b: str) -> None:
        key = (a, b) if a < b else (b, a)
        if key not in seen and a != b:
            seen.add(key)
            pairs.append((a, b))

    for n in CHAIN_NODES:
        if n['upstream']:
            add(n['id'], n['upstream'])
        for s in n['related_stocks']:
            add(n['id'], s)
    return pairs


def to_points(s: pd.Series) -> list[dict]:
    out: list[dict] = []
    for ts, v in s.items():
        if pd.isna(v):
            continue
        out.append({'date': ts.strftime('%Y-%m-%d'), 'value': float(v)})
    return out


def main() -> int:
    start = dt.date.today() - dt.timedelta(days=365 * HISTORY_YEARS)
    log.info('fetching since %s', start)
    raw = fetch_all(start=start)

    log.info('aligning %d series', len(raw))
    wide = align_to_calendar(raw)
    filled = wide.apply(lambda col: forward_fill_capped(col, max_gap=5))

    log.info('computing correlations across windows %s', WINDOWS)
    pairs = correlation_pairs()
    corr = compute_correlations(filled, pairs, windows=WINDOWS)

    series_payload = []
    for node in CHAIN_NODES:
        col = filled[node['id']] if node['id'] in filled.columns else pd.Series(dtype='float64')
        series_payload.append({
            'id': node['id'],
            'name': node['name'],
            'branch': node['branch'],
            'type': node['type'],
            'unit': node['unit'],
            'upstream': node['upstream'],
            'relatedStocks': node['related_stocks'],
            'points': to_points(col),
        })

    payload = {
        'generatedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
        'series': series_payload,
        'correlations': {str(w): corr[w] for w in WINDOWS},
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    sizes = sum(len(s['points']) for s in series_payload)
    log.info('wrote %s (%d series, %d total points)', OUTPUT, len(series_payload), sizes)

    log.info('running news pipeline')
    events_payload = run_news_pipeline()
    events_path = write_events_json(events_payload)
    log.info('wrote %s (%d events, sources=%s)', events_path,
             len(events_payload['events']),
             {k: v['ok'] for k, v in events_payload['sources'].items()})
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
```

- [ ] **Step 2: Run build locally and verify both files exist**

Run:
```bash
cd /Users/hroyw147/Desktop/Projects/siltrack
python scripts/build.py 2>&1 | tail -20
```
Expected: log lines mentioning `wrote .../all.json` AND `wrote .../events.json`. The events count may be 0 (no live customs data, weekend with no announcements) — that's fine for a smoke test.

Then:
```bash
test -s data/events.json && python -c "import json,pathlib; d=json.loads(pathlib.Path('data/events.json').read_text(encoding='utf-8')); assert set(d['sources'].keys()) == {'cninfo','gfex','customs'}; print('events.json OK')"
```
Expected: `events.json OK`

- [ ] **Step 3: Update GitHub Actions workflow**

`.github/workflows/update-data.yml` (full file replacement):
```yaml
name: Update data

on:
  schedule:
    - cron: '0 23 * * *'  # 每日 UTC 23:00 (北京时间次日 07:00)
  workflow_dispatch: {}

permissions:
  contents: write

concurrency:
  group: update-data
  cancel-in-progress: true

jobs:
  build-data:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: pip
          cache-dependency-path: scripts/requirements.txt

      - run: pip install -r scripts/requirements.txt

      - name: Run data build
        run: python scripts/build.py
        env:
          PYTHONUNBUFFERED: '1'

      - name: Verify data/all.json
        run: |
          test -s data/all.json
          python -c "import json,pathlib; d=json.loads(pathlib.Path('data/all.json').read_text(encoding='utf-8')); assert len(d['series'])==24"

      - name: Verify data/events.json
        run: |
          test -s data/events.json
          python <<'PY'
          import json, pathlib, sys
          d = json.loads(pathlib.Path('data/events.json').read_text(encoding='utf-8'))
          required = {'cninfo', 'gfex', 'customs'}
          assert set(d['sources'].keys()) == required, f"sources keys mismatch: {d['sources'].keys()}"
          oks = [name for name, s in d['sources'].items() if s.get('ok')]
          if not oks:
              print('FATAL: all 3 news sources failed', file=sys.stderr)
              sys.exit(1)
          print(f"events.json OK: {len(d['events'])} events, sources ok={oks}")
          PY

      - name: Commit if changed
        run: |
          git config user.name 'siltrack-bot'
          git config user.email 'siltrack-bot@users.noreply.github.com'
          git add -f data/all.json data/events.json
          if git diff --cached --quiet; then
            echo "no data changes"
          else
            git commit -m "chore(data): daily refresh $(date -u +%Y-%m-%d)"
            git push
          fi
```

- [ ] **Step 4: Commit**

```bash
git add scripts/build.py .github/workflows/update-data.yml
git commit -m "feat(build): wire news pipeline into daily build + CI verification"
```

---

## Task 9: Frontend types + useEvents hook

**Files:**
- Modify: `src/types.ts`
- Create: `src/hooks/useEvents.ts`
- Create: `src/hooks/__tests__/useEvents.test.tsx`

- [ ] **Step 1: Extend types.ts**

Append to `src/types.ts`:
```typescript
export type EventType =
  | 'policy'
  | 'delivery'
  | 'inventory'
  | 'production_halt'
  | 'production_start'
  | 'capacity_change'
  | 'order_contract'
  | 'financial_report'
  | 'import_export'
  | 'other';

export type SourceName = 'cninfo' | 'gfex' | 'customs';

export interface NewsEvent {
  id: string;
  date: string;
  source: SourceName;
  source_label: string;
  title: string;
  url: string;
  event_type: EventType;
  related_nodes: string[];
  summary: string | null;
  raw_text_excerpt: string;
}

export interface SourceStatus {
  ok: boolean;
  last_success_at: string;
  stale_days: number;
  error: string | null;
  lag_note: string | null;
}

export interface EventsData {
  generated_at: string;
  sources: Record<SourceName, SourceStatus>;
  events: NewsEvent[];
}
```

- [ ] **Step 2: Write failing test for hook**

`src/hooks/__tests__/useEvents.test.tsx`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useEvents } from '../useEvents';

const sample = {
  generated_at: '2026-04-29T00:00:00Z',
  sources: {
    cninfo: { ok: true, last_success_at: '2026-04-29T00:00:00Z', stale_days: 0, error: null, lag_note: null },
    gfex: { ok: true, last_success_at: '2026-04-29T00:00:00Z', stale_days: 0, error: null, lag_note: null },
    customs: { ok: true, last_success_at: '2026-04-15T00:00:00Z', stale_days: 14, error: null, lag_note: '海关数据滞后...' },
  },
  events: [
    { id: 'a', date: '2026-04-28', source: 'cninfo', source_label: '巨潮资讯',
      title: 't', url: '', event_type: 'other', related_nodes: ['SI'],
      summary: null, raw_text_excerpt: '' },
  ],
};

beforeEach(() => {
  // @ts-expect-error - test stub
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(sample) }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useEvents', () => {
  it('fetches events.json and returns events', async () => {
    const { result } = renderHook(() => useEvents());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.events).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('reports error on failed fetch but does not throw', async () => {
    // @ts-expect-error
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 404 }));
    const { result } = renderHook(() => useEvents());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run test to verify failure**

Run:
```bash
cd /Users/hroyw147/Desktop/Projects/siltrack
npx vitest run src/hooks/__tests__/useEvents.test.tsx
```
Expected: failure on missing module `../useEvents`

- [ ] **Step 4: Implement the hook**

`src/hooks/useEvents.ts`:
```typescript
import { useEffect, useState } from 'react';
import type { EventsData } from '../types';

interface State {
  data: EventsData | null;
  loading: boolean;
  error: Error | null;
}

const EVENTS_URL = `${import.meta.env.BASE_URL}data/events.json`;

export function useEvents(): State {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    fetch(EVENTS_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<EventsData>;
      })
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ data: null, loading: false, error: error as Error });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
```

- [ ] **Step 5: Run test to verify pass**

Run:
```bash
npx vitest run src/hooks/__tests__/useEvents.test.tsx
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/hooks/useEvents.ts src/hooks/__tests__/useEvents.test.tsx
git commit -m "feat(fe): useEvents hook + EventsData/NewsEvent types"
```

---

## Task 10: SourceHealth component

**Files:**
- Create: `src/components/SourceHealth.tsx`
- Create: `src/components/__tests__/SourceHealth.test.tsx`

- [ ] **Step 1: Write failing tests**

`src/components/__tests__/SourceHealth.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SourceHealth } from '../SourceHealth';
import type { EventsData } from '../../types';

const baseSources: EventsData['sources'] = {
  cninfo:  { ok: true,  last_success_at: '2026-04-29T00:00:00Z', stale_days: 0,  error: null, lag_note: null },
  gfex:    { ok: false, last_success_at: '2026-04-23T00:00:00Z', stale_days: 6,  error: 'timeout', lag_note: null },
  customs: { ok: true,  last_success_at: '2026-04-15T00:00:00Z', stale_days: 14, error: null, lag_note: '海关数据滞后 30-45 天' },
};

describe('SourceHealth', () => {
  it('renders three source badges', () => {
    render(<SourceHealth sources={baseSources} />);
    expect(screen.getByText('巨潮资讯')).toBeInTheDocument();
    expect(screen.getByText('广期所')).toBeInTheDocument();
    expect(screen.getByText('海关总署')).toBeInTheDocument();
  });

  it('uses green for stale_days <= 1', () => {
    render(<SourceHealth sources={baseSources} />);
    const badge = screen.getByRole('button', { name: /巨潮资讯/ });
    expect(badge.className).toMatch(/green|emerald/);
  });

  it('uses yellow for 1 < stale_days <= 7', () => {
    render(<SourceHealth sources={baseSources} />);
    const badge = screen.getByRole('button', { name: /广期所/ });
    expect(badge.className).toMatch(/yellow|amber/);
  });

  it('uses red for stale_days > 7', () => {
    render(<SourceHealth sources={baseSources} />);
    const badge = screen.getByRole('button', { name: /海关总署/ });
    expect(badge.className).toMatch(/red|rose/);
  });

  it('opens a modal with details when a badge is clicked', () => {
    render(<SourceHealth sources={baseSources} />);
    fireEvent.click(screen.getByRole('button', { name: /海关总署/ }));
    expect(screen.getByText(/海关数据滞后 30-45 天/)).toBeInTheDocument();
    expect(screen.getByText(/2026-04-15/)).toBeInTheDocument();
  });

  it('shows error in modal when source is not ok', () => {
    render(<SourceHealth sources={baseSources} />);
    fireEvent.click(screen.getByRole('button', { name: /广期所/ }));
    expect(screen.getByText(/timeout/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run:
```bash
npx vitest run src/components/__tests__/SourceHealth.test.tsx
```
Expected: fail on missing module

- [ ] **Step 3: Implement SourceHealth**

`src/components/SourceHealth.tsx`:
```typescript
import { useState } from 'react';
import type { EventsData, SourceName, SourceStatus } from '../types';

const LABELS: Record<SourceName, string> = {
  cninfo: '巨潮资讯',
  gfex: '广期所',
  customs: '海关总署',
};

const ORDER: SourceName[] = ['cninfo', 'gfex', 'customs'];

function colorClass(stale: number, ok: boolean): string {
  if (!ok || stale > 7) return 'bg-rose-50 text-rose-700 border-rose-300';
  if (stale > 1) return 'bg-amber-50 text-amber-700 border-amber-300';
  return 'bg-emerald-50 text-emerald-700 border-emerald-300';
}

interface Props {
  sources: EventsData['sources'];
}

export function SourceHealth({ sources }: Props) {
  const [open, setOpen] = useState<SourceName | null>(null);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {ORDER.map((name) => {
          const s = sources[name];
          if (!s) return null;
          return (
            <button
              key={name}
              type="button"
              aria-label={LABELS[name]}
              onClick={() => setOpen(name)}
              className={`rounded-full border px-2 py-0.5 text-xs ${colorClass(s.stale_days, s.ok)}`}
            >
              {LABELS[name]} · {s.ok ? `${s.stale_days}d` : '失败'}
            </button>
          );
        })}
      </div>
      {open && (
        <SourceModal name={open} status={sources[open]} onClose={() => setOpen(null)} />
      )}
    </>
  );
}

function SourceModal({
  name,
  status,
  onClose,
}: {
  name: SourceName;
  status: SourceStatus;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="w-80 rounded-md border border-gray-200 bg-white p-4 text-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-2 font-medium">{LABELS[name]}</h3>
        <dl className="space-y-1 text-xs text-gray-700">
          <div><dt className="inline text-gray-500">状态：</dt><dd className="inline">{status.ok ? '正常' : '失败'}</dd></div>
          <div><dt className="inline text-gray-500">距上次成功：</dt><dd className="inline">{status.stale_days} 天</dd></div>
          <div><dt className="inline text-gray-500">最近成功时间：</dt><dd className="inline">{status.last_success_at || '—'}</dd></div>
          {status.error && (
            <div><dt className="inline text-gray-500">错误：</dt><dd className="inline text-rose-600">{status.error}</dd></div>
          )}
          {status.lag_note && (
            <div className="mt-2 rounded bg-amber-50 p-2 text-amber-800">{status.lag_note}</div>
          )}
        </dl>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs"
        >
          关闭
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify tests pass**

Run:
```bash
npx vitest run src/components/__tests__/SourceHealth.test.tsx
```
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/SourceHealth.tsx src/components/__tests__/SourceHealth.test.tsx
git commit -m "feat(fe): SourceHealth badges with stale-day color + detail modal"
```

---

## Task 11: EventTimeline component

**Files:**
- Create: `src/components/EventTimeline.tsx`
- Create: `src/components/__tests__/EventTimeline.test.tsx`

- [ ] **Step 1: Write failing tests**

`src/components/__tests__/EventTimeline.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventTimeline } from '../EventTimeline';
import type { NewsEvent } from '../../types';

function evt(over: Partial<NewsEvent> = {}): NewsEvent {
  return {
    id: 'x', date: '2026-04-28', source: 'cninfo', source_label: '巨潮资讯',
    title: '默认标题', url: '', event_type: 'other', related_nodes: ['SI'],
    summary: null, raw_text_excerpt: '',
    ...over,
  };
}

describe('EventTimeline', () => {
  it('filters events by selectedNodeId', () => {
    const events = [
      evt({ id: 'a', title: '关于 SI', related_nodes: ['SI'] }),
      evt({ id: 'b', title: '关于 PS', related_nodes: ['PS'] }),
    ];
    render(<EventTimeline events={events} selectedNodeId="SI" />);
    expect(screen.getByText('关于 SI')).toBeInTheDocument();
    expect(screen.queryByText('关于 PS')).not.toBeInTheDocument();
  });

  it('sorts events by date descending', () => {
    const events = [
      evt({ id: 'old', title: '旧', date: '2026-04-20', related_nodes: ['SI'] }),
      evt({ id: 'new', title: '新', date: '2026-04-28', related_nodes: ['SI'] }),
    ];
    render(<EventTimeline events={events} selectedNodeId="SI" />);
    const titles = screen.getAllByTestId('event-title').map((el) => el.textContent);
    expect(titles).toEqual(['新', '旧']);
  });

  it('renders only initial 30 by default and "load more" extends', () => {
    const events = Array.from({ length: 50 }, (_, i) =>
      evt({ id: `e${i}`, title: `事件${i}`, date: `2026-04-${String(28 - (i % 28)).padStart(2, '0')}`, related_nodes: ['SI'] }),
    );
    render(<EventTimeline events={events} selectedNodeId="SI" />);
    expect(screen.getAllByTestId('event-title')).toHaveLength(30);
    fireEvent.click(screen.getByRole('button', { name: /加载更多/ }));
    expect(screen.getAllByTestId('event-title')).toHaveLength(50);
  });

  it('shows empty state when nothing matches', () => {
    render(<EventTimeline events={[evt({ related_nodes: ['PS'] })]} selectedNodeId="SI" />);
    expect(screen.getByText(/暂无相关事件/)).toBeInTheDocument();
  });

  it('exposes a focus method via ref + scrolls + highlights', () => {
    const events = [
      evt({ id: 'a', title: 'A', related_nodes: ['SI'] }),
      evt({ id: 'b', title: 'B', related_nodes: ['SI'] }),
    ];
    const ref = { current: null as ((id: string) => void) | null };
    render(<EventTimeline events={events} selectedNodeId="SI" focusRef={ref} />);
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;
    expect(typeof ref.current).toBe('function');
    ref.current?.('b');
    expect(scrollSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run:
```bash
npx vitest run src/components/__tests__/EventTimeline.test.tsx
```
Expected: fail on missing module

- [ ] **Step 3: Implement EventTimeline**

`src/components/EventTimeline.tsx`:
```typescript
import { useEffect, useMemo, useState } from 'react';
import type { EventType, NewsEvent } from '../types';

const PAGE = 30;

const SOURCE_BADGE: Record<NewsEvent['source'], string> = {
  cninfo: 'bg-blue-50 text-blue-700 border-blue-200',
  gfex: 'bg-purple-50 text-purple-700 border-purple-200',
  customs: 'bg-orange-50 text-orange-700 border-orange-200',
};

const TYPE_ICON: Record<EventType, string> = {
  policy: '📜',
  delivery: '📦',
  inventory: '📊',
  production_halt: '🛑',
  production_start: '🚀',
  capacity_change: '🏗️',
  order_contract: '📝',
  financial_report: '💰',
  import_export: '🌏',
  other: '•',
};

interface Props {
  events: NewsEvent[];
  selectedNodeId: string;
  focusRef?: { current: ((id: string) => void) | null };
}

export function EventTimeline({ events, selectedNodeId, focusRef }: Props) {
  const filtered = useMemo(
    () =>
      events
        .filter((e) => e.related_nodes.includes(selectedNodeId))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [events, selectedNodeId],
  );

  const [shown, setShown] = useState<number>(PAGE);
  // Reset paging when selection changes.
  useEffect(() => setShown(PAGE), [selectedNodeId]);

  const [highlighted, setHighlighted] = useState<string | null>(null);

  useEffect(() => {
    if (!focusRef) return;
    focusRef.current = (id: string) => {
      const el = document.getElementById(`event-card-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlighted(id);
        window.setTimeout(() => setHighlighted(null), 2000);
      }
    };
    return () => {
      focusRef.current = null;
    };
  }, [focusRef]);

  if (filtered.length === 0) {
    return (
      <div className="rounded-md border border-gray-200 bg-white p-3 text-xs text-gray-500">
        暂无相关事件
      </div>
    );
  }

  const visible = filtered.slice(0, shown);

  return (
    <div className="space-y-2">
      {visible.map((e) => (
        <article
          key={e.id}
          id={`event-card-${e.id}`}
          className={`rounded-md border p-3 text-sm transition-colors ${
            highlighted === e.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'
          }`}
        >
          <div className="mb-1 flex items-center gap-2 text-xs text-gray-500">
            <span>{e.date}</span>
            <span className={`rounded border px-1.5 py-0.5 ${SOURCE_BADGE[e.source]}`}>
              {e.source_label}
            </span>
            <span title={e.event_type}>{TYPE_ICON[e.event_type]}</span>
          </div>
          {e.url ? (
            <a
              data-testid="event-title"
              href={e.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-900 hover:text-blue-600"
            >
              {e.title}
            </a>
          ) : (
            <span data-testid="event-title" className="text-gray-900">
              {e.title}
            </span>
          )}
        </article>
      ))}
      {filtered.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="w-full rounded-md border border-gray-300 bg-white py-1 text-xs text-gray-700 hover:border-blue-400 hover:text-blue-600"
        >
          加载更多（剩余 {filtered.length - shown}）
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify tests pass**

Run:
```bash
npx vitest run src/components/__tests__/EventTimeline.test.tsx
```
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/EventTimeline.tsx src/components/__tests__/EventTimeline.test.tsx
git commit -m "feat(fe): EventTimeline with node filter, paging, focus-by-id"
```

---

## Task 12: TimelineChart markPoint integration

**Files:**
- Modify: `src/components/TimelineChart.tsx`

- [ ] **Step 1: Replace TimelineChart with markPoint-aware version**

`src/components/TimelineChart.tsx` (full file replacement):
```typescript
import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { NewsEvent, Series, TimeRange } from '../types';
import { sliceByRange, normalizeFromBase } from '../lib/analytics';

interface Line {
  series: Series;
  color: string;
  dashed?: boolean;
}

interface Props {
  lines: Line[];
  range: TimeRange;
  events?: NewsEvent[];
  onEventClick?: (id: string) => void;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function TimelineChart({ lines, range, events, onEventClick }: Props) {
  const option = useMemo(() => {
    const echartsSeries = lines
      .filter((l) => l.series.points.length > 0)
      .map((l, idx) => {
        const sliced = sliceByRange(l.series.points, range);
        const normalized = normalizeFromBase(sliced);
        const base = {
          name: l.series.name,
          type: 'line' as const,
          smooth: true,
          symbol: 'none' as const,
          lineStyle: { color: l.color, width: 1.8, type: l.dashed ? 'dashed' : 'solid' },
          itemStyle: { color: l.color },
          data: normalized.map((p) => [p.date, +p.value.toFixed(2)]),
        };
        if (idx !== 0 || !events || events.length === 0) return base;

        const primaryId = l.series.id;
        const inRange = new Set(normalized.map((p) => p.date));
        const matched = events.filter(
          (e) => e.related_nodes.includes(primaryId) && inRange.has(e.date),
        );
        if (matched.length === 0) return base;

        return {
          ...base,
          markPoint: {
            symbol: 'circle' as const,
            symbolSize: 8,
            label: { show: false },
            tooltip: {
              formatter: (p: { name?: string; data?: { event?: NewsEvent } }) => {
                const e = p.data?.event;
                if (!e) return '';
                return `${e.date} · ${escapeHtml(e.source_label)}<br/>${escapeHtml(e.title)}`;
              },
            },
            data: matched.map((e) => ({
              name: e.id,
              xAxis: e.date,
              yAxis: 100, // normalized base; ECharts snaps to nearest line value visually
              itemStyle: { color: l.color, opacity: 0.7 },
              event: e,
            })),
          },
        };
      });

    return {
      animation: false,
      grid: { left: 50, right: 16, top: 30, bottom: 30 },
      tooltip: { trigger: 'axis' as const },
      legend: { top: 0, textStyle: { fontSize: 11 } },
      xAxis: { type: 'time' as const, axisLine: { lineStyle: { color: '#cbd5e1' } } },
      yAxis: {
        type: 'value' as const,
        scale: true,
        name: '归一化（首日=100）',
        nameTextStyle: { fontSize: 10, color: '#64748b' },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
      },
      series: echartsSeries,
    };
  }, [lines, range, events]);

  if (lines.every((l) => l.series.points.length === 0)) {
    return (
      <div className="flex h-72 items-center justify-center rounded-md border border-dashed border-gray-300 text-sm text-gray-400">
        当前选中的节点暂无数据
      </div>
    );
  }

  const echartsEvents = onEventClick
    ? {
        click: (params: { componentType?: string; data?: { name?: string } }) => {
          if (params.componentType === 'markPoint' && params.data?.name) {
            onEventClick(params.data.name);
          }
        },
      }
    : undefined;

  return (
    <ReactECharts
      option={option}
      style={{ height: 320 }}
      notMerge
      lazyUpdate
      onEvents={echartsEvents}
    />
  );
}
```

- [ ] **Step 2: Run existing tests + typecheck**

Run:
```bash
cd /Users/hroyw147/Desktop/Projects/siltrack
npx vitest run src/components/__tests__/
npm run build
```
Expected: all existing tests pass + build succeeds. (No new TimelineChart unit tests — ECharts integration is verified in the App smoke test in Task 13.)

- [ ] **Step 3: Commit**

```bash
git add src/components/TimelineChart.tsx
git commit -m "feat(fe): TimelineChart markPoint overlay + onEventClick callback"
```

---

## Task 13: App.tsx wiring + README

**Files:**
- Modify: `src/App.tsx`
- Modify: `README.md`

- [ ] **Step 1: Wire useEvents into App**

Modify `src/App.tsx`. Add imports:
```typescript
import { useRef } from 'react';
import { useEvents } from './hooks/useEvents';
import { EventTimeline } from './components/EventTimeline';
import { SourceHealth } from './components/SourceHealth';
```

In the component body, after the existing `useAllData` line:
```typescript
const eventsState = useEvents();
const focusRef = useRef<((id: string) => void) | null>(null);
```

Filter events for the primary selected node (do this above the return):
```typescript
const visibleEvents = eventsState.data?.events ?? [];
```

In the JSX, replace the existing `<section>` containing TimelineChart + InsightPanel with:
```tsx
<section className="mt-2 rounded-md border border-gray-200 bg-white p-3">
  <TimelineChart
    lines={lines}
    range={range}
    events={visibleEvents}
    onEventClick={(id) => focusRef.current?.(id)}
  />
  {selection && <InsightPanel selection={selection} />}
</section>

<section className="mt-3 space-y-3">
  {eventsState.data && (
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-medium text-gray-700">相关事件</h2>
      <SourceHealth sources={eventsState.data.sources} />
    </div>
  )}
  {eventsState.error ? (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
      事件流暂时不可用：{eventsState.error.message}
    </div>
  ) : (
    <EventTimeline
      events={visibleEvents}
      selectedNodeId={selectedId}
      focusRef={focusRef}
    />
  )}
</section>
```

- [ ] **Step 2: Run all frontend tests**

Run:
```bash
npx vitest run
```
Expected: all PASS.

- [ ] **Step 3: Smoke test in dev**

Run:
```bash
npm run dev
```
Open `http://localhost:5173`. Manual checks:
- Page renders without errors
- Three SourceHealth badges visible top-right of "相关事件"
- Click a chain node → EventTimeline filters to its events (or "暂无相关事件")
- Click a SourceHealth badge → modal opens with status detail
- (If events.json has any events with dates inside the chart range): markPoints visible on the chart, clicking one scrolls + highlights its card

Stop the dev server (Ctrl+C).

- [ ] **Step 4: Update README**

Append to `README.md` (after the "已知限制" section):
```markdown
## 事件流（M2）

每日跑数据时同步刷新 `data/events.json`，覆盖三个官方来源：

- **巨潮资讯**（cninfo）— 11 只硅产业链 A 股的公司公告，T+0 通过 akshare
- **广期所**（gfex）— SI / PS 仓单、交割、风控、保证金等公告，自爬
- **海关总署**（customs）— 多晶硅 HS 28046190 月度进出口，**手工录入** `data/customs_manual.csv`（月度滞后 30–45 天）

事件类型由关键词规则分到 9 类（policy / delivery / inventory / production_halt / production_start / capacity_change / order_contract / financial_report / import_export / other）。长尾事件可能误分类，规划在后续阶段升级到 LLM 标注。

页面右上角的 SourceHealth 徽章按"距上次成功抓取天数"染色（绿 ≤1d / 黄 ≤7d / 红 >7d），点击查看详情；广期所爬虫依赖 HTML 结构，网站改版会触发 stale 告警。
```

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx README.md
git commit -m "feat(fe): wire EventTimeline + SourceHealth into App; README events section"
```

---

## Final verification

- [ ] **Run the full test suite**

```bash
cd /Users/hroyw147/Desktop/Projects/siltrack
python -m pytest scripts/news/tests/ -v
python -m pytest scripts/tests/ -v
npx vitest run
npm run build
```
All four must succeed.

- [ ] **Check all spec acceptance criteria from §11 of the spec**

For each item in `docs/superpowers/specs/2026-04-29-m2-official-news-design.md` §11, eyeball the implementation and tick it off in the spec.

- [ ] **Final commit if any cleanup**

If any leftover untracked files (e.g. dist/), don't commit them. If any small fixes were needed, commit with a `chore:` prefix.
