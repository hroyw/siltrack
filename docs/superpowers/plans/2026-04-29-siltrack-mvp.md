# siltrack MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public, auto-updating dashboard at `https://<user>.github.io/siltrack/` that visualizes the silicon industry chain (24 series across 3 branches) with smart-compare interaction.

**Architecture:** Python (akshare) data layer runs daily on GitHub Actions, writes a single `data/all.json` to the repo. React + TypeScript + ECharts frontend reads that JSON statically. GitHub Pages hosts the built site.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, ECharts (`echarts-for-react`), Vitest, React Testing Library, Python 3.11, akshare, pandas, pytest, GitHub Actions, GitHub Pages.

**Spec:** [`docs/superpowers/specs/2026-04-29-siltrack-mvp-design.md`](../specs/2026-04-29-siltrack-mvp-design.md)

---

## Conventions

- **Working dir:** `/Users/hroyw147/Desktop/Projects/siltrack/` (repo already initialized, branch `main`)
- **Commit style:** Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`)
- **Commit cadence:** One commit per task. If a task is large, multiple commits is fine but every commit must be green (tests pass).
- **TDD discipline:** Tests written before implementation for pure functions. For external-API code (fetch.py), use record-then-replay fixtures (justified inline).
- **Node version:** 20 LTS. **Python version:** 3.11.

---

## Phase A — Project Scaffolding

### Task 1: Initialize Vite + React + TypeScript project

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `.gitignore`

- [ ] **Step 1: Scaffold via Vite template**

```bash
cd /Users/hroyw147/Desktop/Projects/siltrack
npm create vite@latest . -- --template react-ts
```

When prompted "Current directory is not empty", choose **"Ignore files and continue"**.

- [ ] **Step 2: Install dependencies**

```bash
npm install
```

Expected: creates `node_modules/`, no errors.

- [ ] **Step 3: Replace `src/App.tsx` with placeholder**

```tsx
function App() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-semibold">siltrack</h1>
      <p className="text-sm text-gray-500">硅产业链看板 · 加载中…</p>
    </main>
  );
}

export default App;
```

- [ ] **Step 4: Update `.gitignore`** — append these lines:

```
# siltrack
.superpowers/
.DS_Store
*.local
```

- [ ] **Step 5: Verify dev server boots**

```bash
npm run dev
```

Expected: prints `Local: http://localhost:5173/`. Press `q` to quit.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore: scaffold Vite + React + TS project"
```

---

### Task 2: Add Tailwind CSS

**Files:**
- Create: `tailwind.config.js`, `postcss.config.js`
- Modify: `src/index.css`, `package.json`

- [ ] **Step 1: Install Tailwind**

```bash
npm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p
```

Note: pin Tailwind v3 — v4 has different config.

- [ ] **Step 2: Configure content paths in `tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        chain: {
          futures: '#10b981',
          spot: '#3b82f6',
          stock: '#a855f7',
        },
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 3: Replace `src/index.css` content**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root {
  height: 100%;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
```

- [ ] **Step 4: Smoke check**

```bash
npm run dev
```

Open `http://localhost:5173/`. Expected: heading rendered with Tailwind styles applied (large, semibold, padded).

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.js postcss.config.js src/index.css package.json package-lock.json
git commit -m "chore: add Tailwind CSS with chain color palette"
```

---

### Task 3: Add ECharts and Vitest

**Files:**
- Modify: `package.json`, `vite.config.ts`
- Create: `src/test-setup.ts`

- [ ] **Step 1: Install runtime + test deps**

```bash
npm install echarts echarts-for-react
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @types/node
```

- [ ] **Step 2: Replace `vite.config.ts`**

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});
```

`base: './'` makes the build work under any GitHub Pages path.

- [ ] **Step 3: Create `src/test-setup.ts`**

```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 4: Add test script to `package.json`** under `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Sanity test — create `src/lib/__tests__/sanity.test.ts`**

```ts
import { describe, it, expect } from 'vitest';

describe('sanity', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run tests**

```bash
npm test
```

Expected: 1 passed.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/test-setup.ts src/lib/__tests__/sanity.test.ts
git commit -m "chore: add ECharts and Vitest"
```

---

## Phase B — Python Data Layer

### Task 4: Set up Python project and chain config

**Files:**
- Create: `scripts/__init__.py`, `scripts/requirements.txt`, `scripts/chain_config.py`, `scripts/tests/__init__.py`, `scripts/tests/conftest.py`, `scripts/tests/test_chain_config.py`

- [ ] **Step 1: Create venv and install deps**

```bash
cd /Users/hroyw147/Desktop/Projects/siltrack
python3.11 -m venv .venv
source .venv/bin/activate
```

Add `.venv/` to `.gitignore` if not already there.

- [ ] **Step 2: Create `scripts/requirements.txt`**

```
akshare==1.13.85
pandas>=2.0,<3.0
numpy>=1.26,<2.0
pytest>=8.0
chinese-calendar>=1.10
```

- [ ] **Step 3: Install**

```bash
pip install -r scripts/requirements.txt
```

- [ ] **Step 4: Create `scripts/chain_config.py`**

```python
"""Single source of truth for the silicon industry chain.

Each node has:
- id: stable identifier used in data/all.json and frontend
- name: human-readable Chinese name
- branch: 'photovoltaic' | 'organosilicon' | 'fiber'
- type: 'futures' | 'spot' | 'stock'
- unit: display unit
- upstream: id of the immediate upstream node, or None for chain origins
- related_stocks: list of stock ids likely correlated (used to pick "top stock")
- akshare: a callable spec describing how to fetch this series; see fetch.py
"""

from typing import TypedDict, Literal, Optional


class ChainNode(TypedDict):
    id: str
    name: str
    branch: Literal['photovoltaic', 'organosilicon', 'fiber']
    type: Literal['futures', 'spot', 'stock']
    unit: str
    upstream: Optional[str]
    related_stocks: list[str]


CHAIN_NODES: list[ChainNode] = [
    # --- photovoltaic ---
    {'id': 'SI', 'name': '工业硅期货主力', 'branch': 'photovoltaic', 'type': 'futures', 'unit': '¥/吨',
     'upstream': None, 'related_stocks': ['603260']},
    {'id': 'PS', 'name': '多晶硅期货主力', 'branch': 'photovoltaic', 'type': 'futures', 'unit': '¥/吨',
     'upstream': 'SI', 'related_stocks': ['688303', '600438']},
    {'id': 'polysilicon-dense', 'name': '多晶硅致密料', 'branch': 'photovoltaic', 'type': 'spot', 'unit': '¥/吨',
     'upstream': 'PS', 'related_stocks': ['688303', '600438', '603260']},
    {'id': 'wafer-m10', 'name': '单晶硅片 M10', 'branch': 'photovoltaic', 'type': 'spot', 'unit': '¥/片',
     'upstream': 'polysilicon-dense', 'related_stocks': ['002129', '601012']},
    {'id': 'cell-topcon', 'name': 'TOPCon 电池片', 'branch': 'photovoltaic', 'type': 'spot', 'unit': '¥/W',
     'upstream': 'wafer-m10', 'related_stocks': ['600438', '601012']},
    {'id': 'module', 'name': '光伏组件均价', 'branch': 'photovoltaic', 'type': 'spot', 'unit': '¥/W',
     'upstream': 'cell-topcon', 'related_stocks': ['601012']},
    {'id': '600438', 'name': '通威股份', 'branch': 'photovoltaic', 'type': 'stock', 'unit': '¥/股',
     'upstream': None, 'related_stocks': []},
    {'id': '688303', 'name': '大全能源', 'branch': 'photovoltaic', 'type': 'stock', 'unit': '¥/股',
     'upstream': None, 'related_stocks': []},
    {'id': '002129', 'name': 'TCL 中环', 'branch': 'photovoltaic', 'type': 'stock', 'unit': '¥/股',
     'upstream': None, 'related_stocks': []},
    {'id': '601012', 'name': '隆基绿能', 'branch': 'photovoltaic', 'type': 'stock', 'unit': '¥/股',
     'upstream': None, 'related_stocks': []},
    # --- organosilicon ---
    {'id': 'dmc', 'name': 'DMC（二甲基硅氧烷混合环体）', 'branch': 'organosilicon', 'type': 'spot', 'unit': '¥/吨',
     'upstream': 'SI', 'related_stocks': ['603260', '600596', '300821']},
    {'id': 'silicone-107', 'name': '107 硅橡胶', 'branch': 'organosilicon', 'type': 'spot', 'unit': '¥/吨',
     'upstream': 'dmc', 'related_stocks': ['603260', '300821']},
    {'id': 'silicone-oil', 'name': '硅油', 'branch': 'organosilicon', 'type': 'spot', 'unit': '¥/吨',
     'upstream': 'dmc', 'related_stocks': ['600596', '603938']},
    {'id': 'fumed-silica', 'name': '气相白炭黑', 'branch': 'organosilicon', 'type': 'spot', 'unit': '¥/吨',
     'upstream': 'SI', 'related_stocks': ['603938']},
    {'id': '603260', 'name': '合盛硅业', 'branch': 'organosilicon', 'type': 'stock', 'unit': '¥/股',
     'upstream': None, 'related_stocks': []},
    {'id': '600596', 'name': '新安股份', 'branch': 'organosilicon', 'type': 'stock', 'unit': '¥/股',
     'upstream': None, 'related_stocks': []},
    {'id': '300821', 'name': '东岳硅材', 'branch': 'organosilicon', 'type': 'stock', 'unit': '¥/股',
     'upstream': None, 'related_stocks': []},
    {'id': '603938', 'name': '三孚股份', 'branch': 'organosilicon', 'type': 'stock', 'unit': '¥/股',
     'upstream': None, 'related_stocks': []},
    # --- fiber (experimental: data may be partial) ---
    {'id': 'quartz-sand', 'name': '高纯石英砂', 'branch': 'fiber', 'type': 'spot', 'unit': '¥/吨',
     'upstream': None, 'related_stocks': ['601869']},
    {'id': 'optical-preform', 'name': '光纤预制棒', 'branch': 'fiber', 'type': 'spot', 'unit': '¥/吨',
     'upstream': 'quartz-sand', 'related_stocks': ['601869', '600487']},
    {'id': 'optical-fiber', 'name': '光纤光缆', 'branch': 'fiber', 'type': 'spot', 'unit': '¥/芯·公里',
     'upstream': 'optical-preform', 'related_stocks': ['601869', '600487', '600522']},
    {'id': '601869', 'name': '长飞光纤', 'branch': 'fiber', 'type': 'stock', 'unit': '¥/股',
     'upstream': None, 'related_stocks': []},
    {'id': '600487', 'name': '亨通光电', 'branch': 'fiber', 'type': 'stock', 'unit': '¥/股',
     'upstream': None, 'related_stocks': []},
    {'id': '600522', 'name': '中天科技', 'branch': 'fiber', 'type': 'stock', 'unit': '¥/股',
     'upstream': None, 'related_stocks': []},
]


def get_node(node_id: str) -> ChainNode:
    for n in CHAIN_NODES:
        if n['id'] == node_id:
            return n
    raise KeyError(f'unknown chain node: {node_id}')
```

- [ ] **Step 5: Create `scripts/tests/conftest.py`** (empty file makes `scripts/` discoverable):

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
```

- [ ] **Step 6: Create `scripts/tests/test_chain_config.py`**

```python
from chain_config import CHAIN_NODES, get_node


def test_count_is_24():
    assert len(CHAIN_NODES) == 24


def test_branch_counts():
    by_branch = {}
    for n in CHAIN_NODES:
        by_branch.setdefault(n['branch'], 0)
        by_branch[n['branch']] += 1
    assert by_branch == {'photovoltaic': 10, 'organosilicon': 8, 'fiber': 6}


def test_type_counts():
    by_type = {}
    for n in CHAIN_NODES:
        by_type.setdefault(n['type'], 0)
        by_type[n['type']] += 1
    assert by_type == {'futures': 2, 'spot': 11, 'stock': 11}


def test_upstream_references_exist_or_none():
    ids = {n['id'] for n in CHAIN_NODES}
    for n in CHAIN_NODES:
        if n['upstream'] is not None:
            assert n['upstream'] in ids, f'{n["id"]} -> unknown upstream {n["upstream"]}'


def test_related_stocks_reference_actual_stocks():
    stock_ids = {n['id'] for n in CHAIN_NODES if n['type'] == 'stock'}
    for n in CHAIN_NODES:
        for s in n['related_stocks']:
            assert s in stock_ids, f'{n["id"]} -> unknown stock {s}'


def test_get_node_lookup():
    assert get_node('SI')['name'] == '工业硅期货主力'


def test_get_node_unknown_raises():
    import pytest
    with pytest.raises(KeyError):
        get_node('unknown')
```

- [ ] **Step 7: Run tests**

```bash
cd scripts && python -m pytest tests/ -v && cd ..
```

Expected: 7 passed.

- [ ] **Step 8: Commit**

```bash
git add scripts/ .gitignore
git commit -m "feat(data): chain config with 24 nodes across 3 branches"
```

---

### Task 5: Implement `transform.py` with TDD

**Files:**
- Create: `scripts/transform.py`, `scripts/tests/test_transform.py`

- [ ] **Step 1: Write the failing test in `scripts/tests/test_transform.py`**

```python
import pandas as pd
import numpy as np
from datetime import date

from transform import align_to_calendar, forward_fill_capped


def test_align_uses_union_of_dates_then_sorted():
    a = pd.DataFrame({'value': [1.0, 2.0]}, index=pd.to_datetime(['2024-01-02', '2024-01-04']))
    b = pd.DataFrame({'value': [10.0, 20.0]}, index=pd.to_datetime(['2024-01-03', '2024-01-04']))
    out = align_to_calendar({'a': a, 'b': b})
    expected_dates = pd.to_datetime(['2024-01-02', '2024-01-03', '2024-01-04'])
    assert list(out.index) == list(expected_dates)
    assert list(out.columns) == ['a', 'b']


def test_align_keeps_nan_for_missing_days():
    a = pd.DataFrame({'value': [1.0]}, index=pd.to_datetime(['2024-01-02']))
    b = pd.DataFrame({'value': [10.0]}, index=pd.to_datetime(['2024-01-03']))
    out = align_to_calendar({'a': a, 'b': b})
    assert pd.isna(out.loc[pd.Timestamp('2024-01-03'), 'a'])
    assert pd.isna(out.loc[pd.Timestamp('2024-01-02'), 'b'])


def test_forward_fill_caps_at_5_days():
    idx = pd.date_range('2024-01-01', periods=10, freq='D')
    s = pd.Series([1.0] + [np.nan] * 7 + [2.0, 3.0], index=idx)
    out = forward_fill_capped(s, max_gap=5)
    assert out.iloc[0] == 1.0
    assert out.iloc[1] == 1.0
    assert out.iloc[5] == 1.0
    assert pd.isna(out.iloc[6])
    assert pd.isna(out.iloc[7])
    assert out.iloc[8] == 2.0


def test_forward_fill_does_not_touch_leading_nans():
    idx = pd.date_range('2024-01-01', periods=4, freq='D')
    s = pd.Series([np.nan, np.nan, 1.0, np.nan], index=idx)
    out = forward_fill_capped(s, max_gap=5)
    assert pd.isna(out.iloc[0])
    assert pd.isna(out.iloc[1])
    assert out.iloc[2] == 1.0
    assert out.iloc[3] == 1.0
```

- [ ] **Step 2: Run — should fail with ImportError**

```bash
cd scripts && python -m pytest tests/test_transform.py -v && cd ..
```

Expected: FAILED, `ModuleNotFoundError: No module named 'transform'`.

- [ ] **Step 3: Implement `scripts/transform.py`**

```python
"""Pure data transformations: alignment + capped forward fill.

No I/O. Inputs are pandas dataframes/series produced by fetch.py.
"""
import pandas as pd
import numpy as np


def align_to_calendar(series_map: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """Combine N single-column dataframes into one wide frame.

    - Index: union of all input dates, sorted.
    - Columns: keys of `series_map`.
    - Missing dates remain NaN (forward-fill happens separately).

    Each input frame must have a DatetimeIndex and exactly one value column.
    """
    cols = {}
    for sid, df in series_map.items():
        if df is None or df.empty:
            cols[sid] = pd.Series(dtype='float64')
            continue
        s = df.iloc[:, 0].copy()
        s.name = sid
        cols[sid] = s
    return pd.concat(cols.values(), axis=1, keys=cols.keys()).sort_index()


def forward_fill_capped(s: pd.Series, max_gap: int = 5) -> pd.Series:
    """Forward-fill NaNs but never bridge a gap longer than `max_gap` rows.

    Leading NaNs are preserved (we don't know what came before).
    """
    out = s.copy()
    last_valid_pos = -1
    for i, v in enumerate(s.values):
        if not pd.isna(v):
            last_valid_pos = i
            continue
        if last_valid_pos == -1:
            continue
        if i - last_valid_pos <= max_gap:
            out.iat[i] = s.iat[last_valid_pos]
    return out
```

- [ ] **Step 4: Run tests — should pass**

```bash
cd scripts && python -m pytest tests/test_transform.py -v && cd ..
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/transform.py scripts/tests/test_transform.py
git commit -m "feat(data): align_to_calendar and forward_fill_capped (TDD)"
```

---

### Task 6: Implement `correlate.py` with TDD

**Files:**
- Create: `scripts/correlate.py`, `scripts/tests/test_correlate.py`

- [ ] **Step 1: Write the failing test in `scripts/tests/test_correlate.py`**

```python
import pandas as pd
import numpy as np
import pytest

from correlate import rolling_corr_endpoint, compute_correlations


def test_rolling_corr_endpoint_perfect_correlation():
    n = 100
    idx = pd.date_range('2024-01-01', periods=n, freq='D')
    a = pd.Series(np.arange(n, dtype='float64'), index=idx)
    b = a * 2 + 5
    r = rolling_corr_endpoint(a, b, window=60)
    assert r == pytest.approx(1.0, abs=1e-9)


def test_rolling_corr_endpoint_zero_correlation():
    np.random.seed(42)
    n = 200
    idx = pd.date_range('2024-01-01', periods=n, freq='D')
    a = pd.Series(np.random.randn(n), index=idx)
    b = pd.Series(np.random.randn(n), index=idx)
    r = rolling_corr_endpoint(a, b, window=60)
    assert abs(r) < 0.3


def test_rolling_corr_endpoint_returns_none_when_too_few_points():
    idx = pd.date_range('2024-01-01', periods=10, freq='D')
    a = pd.Series(np.arange(10, dtype='float64'), index=idx)
    b = a * 2
    assert rolling_corr_endpoint(a, b, window=60) is None


def test_rolling_corr_endpoint_returns_none_with_all_nan():
    idx = pd.date_range('2024-01-01', periods=100, freq='D')
    a = pd.Series([np.nan] * 100, index=idx)
    b = pd.Series(np.arange(100, dtype='float64'), index=idx)
    assert rolling_corr_endpoint(a, b, window=60) is None


def test_compute_correlations_shape_and_keys():
    n = 200
    idx = pd.date_range('2024-01-01', periods=n, freq='D')
    df = pd.DataFrame({
        'A': np.arange(n, dtype='float64'),
        'B': np.arange(n, dtype='float64') * 2 + 1,
        'C': np.random.RandomState(0).randn(n),
    }, index=idx)
    pairs = [('A', 'B'), ('A', 'C')]
    result = compute_correlations(df, pairs, windows=[30, 60])
    assert set(result.keys()) == {30, 60}
    assert set(result[60].keys()) == {'A'}
    assert set(result[60]['A'].keys()) == {'B', 'C'}
    assert result[60]['A']['B'] == pytest.approx(1.0, abs=1e-9)
```

- [ ] **Step 2: Run — should fail with ImportError**

```bash
cd scripts && python -m pytest tests/test_correlate.py -v && cd ..
```

Expected: FAILED.

- [ ] **Step 3: Implement `scripts/correlate.py`**

```python
"""Correlation computation over the aligned wide dataframe."""
from typing import Iterable
import pandas as pd
import numpy as np


def rolling_corr_endpoint(a: pd.Series, b: pd.Series, window: int) -> float | None:
    """Pearson correlation over the *last* `window` aligned non-null observations.

    Returns None if fewer than `window` overlapping non-null pairs exist or
    if either side has zero variance in the window.
    """
    pair = pd.concat([a, b], axis=1).dropna()
    if len(pair) < window:
        return None
    tail = pair.iloc[-window:]
    sa, sb = tail.iloc[:, 0], tail.iloc[:, 1]
    if sa.std(ddof=0) == 0 or sb.std(ddof=0) == 0:
        return None
    return float(sa.corr(sb))


def compute_correlations(
    df: pd.DataFrame,
    pairs: Iterable[tuple[str, str]],
    windows: list[int],
) -> dict[int, dict[str, dict[str, float | None]]]:
    """Compute end-of-period rolling correlation for every (a, b) pair across each window.

    Output shape: { window: { a: { b: corr } } }
    """
    out: dict[int, dict[str, dict[str, float | None]]] = {w: {} for w in windows}
    for w in windows:
        for a, b in pairs:
            r = rolling_corr_endpoint(df[a], df[b], window=w)
            out[w].setdefault(a, {})[b] = r
    return out
```

- [ ] **Step 4: Run tests — should pass**

```bash
cd scripts && python -m pytest tests/test_correlate.py -v && cd ..
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/correlate.py scripts/tests/test_correlate.py
git commit -m "feat(data): rolling correlation computation (TDD)"
```

---

### Task 7: Implement `fetch.py` (record-then-replay)

`fetch.py` calls live external APIs (akshare). Pure TDD doesn't fit. Strategy: write small functions that map a `ChainNode` to a dataframe, run them once to capture fixtures, then write a regression test against the fixture.

**Files:**
- Create: `scripts/fetch.py`, `scripts/tests/test_fetch.py`, `scripts/tests/fixtures/sample_si.csv`

- [ ] **Step 1: Implement `scripts/fetch.py`**

```python
"""Fetch raw price series via akshare.

One function per series type (futures / spot / stock). Each returns a
single-column pandas DataFrame indexed by date.

Spot prices are pulled from akshare's 生意社 (sysweb) aggregator. Some
nodes — especially fiber chain — may have no akshare endpoint; those
return an empty frame and are surfaced as 'no data' downstream.
"""
from __future__ import annotations

import datetime as dt
import logging
from typing import Optional

import akshare as ak
import pandas as pd

from chain_config import ChainNode, CHAIN_NODES

log = logging.getLogger(__name__)

# Map chain-config IDs to akshare-specific lookups.
# `None` means "no known endpoint yet" — we record an empty frame and move on.
SPOT_AKSHARE_KEYS: dict[str, Optional[str]] = {
    'polysilicon-dense': '多晶硅',          # 生意社
    'wafer-m10': '硅片',
    'cell-topcon': '电池片',
    'module': '光伏组件',
    'dmc': 'DMC',
    'silicone-107': '107硅橡胶',
    'silicone-oil': '硅油',
    'fumed-silica': '气相白炭黑',
    'quartz-sand': None,            # fiber chain — no public daily endpoint
    'optical-preform': None,
    'optical-fiber': None,
}

FUTURES_SYMBOLS: dict[str, str] = {
    'SI': 'SI',                     # 工业硅 main contract
    'PS': 'PS',                     # 多晶硅 main contract
}


def fetch_futures(node_id: str, start: dt.date) -> pd.DataFrame:
    """Daily settlement of the main contract."""
    symbol = FUTURES_SYMBOLS[node_id]
    df = ak.futures_main_sina(symbol=symbol)
    if df is None or df.empty:
        return pd.DataFrame(columns=['value'])
    df = df.rename(columns={'日期': 'date', '收盘价': 'value'})
    df['date'] = pd.to_datetime(df['date'])
    df = df[df['date'] >= pd.Timestamp(start)]
    return df.set_index('date')[['value']].astype('float64')


def fetch_stock(stock_code: str, start: dt.date) -> pd.DataFrame:
    """A-share daily close, prefix inferred from code."""
    if stock_code.startswith(('60', '68')):
        symbol = f'sh{stock_code}'
    else:
        symbol = f'sz{stock_code}'
    df = ak.stock_zh_a_daily(symbol=symbol, start_date=start.strftime('%Y%m%d'),
                             adjust='qfq')
    if df is None or df.empty:
        return pd.DataFrame(columns=['value'])
    df = df.rename(columns={'date': 'date', 'close': 'value'})
    df['date'] = pd.to_datetime(df['date'])
    return df.set_index('date')[['value']].astype('float64')


def fetch_spot(node_id: str, start: dt.date) -> pd.DataFrame:
    """生意社 daily price for spot commodities. Returns empty if unmapped."""
    key = SPOT_AKSHARE_KEYS.get(node_id)
    if key is None:
        log.warning('no spot endpoint for %s', node_id)
        return pd.DataFrame(columns=['value'])
    try:
        df = ak.spot_price_qh_sina(symbol=key)
    except Exception as e:
        log.warning('spot fetch failed for %s (%s): %s', node_id, key, e)
        return pd.DataFrame(columns=['value'])
    if df is None or df.empty:
        return pd.DataFrame(columns=['value'])
    df = df.rename(columns={'日期': 'date', '现货价': 'value'})
    df['date'] = pd.to_datetime(df['date'])
    df = df[df['date'] >= pd.Timestamp(start)]
    return df.set_index('date')[['value']].astype('float64')


def fetch_node(node: ChainNode, start: dt.date) -> pd.DataFrame:
    if node['type'] == 'futures':
        return fetch_futures(node['id'], start)
    if node['type'] == 'stock':
        return fetch_stock(node['id'], start)
    if node['type'] == 'spot':
        return fetch_spot(node['id'], start)
    raise ValueError(f'unknown type: {node["type"]}')


def fetch_all(start: dt.date | None = None) -> dict[str, pd.DataFrame]:
    """Fetch every node defined in chain_config. Per-node failures are isolated."""
    if start is None:
        start = dt.date.today() - dt.timedelta(days=365 * 3)
    out: dict[str, pd.DataFrame] = {}
    for node in CHAIN_NODES:
        try:
            df = fetch_node(node, start)
            log.info('fetched %s: %d rows', node['id'], len(df))
            out[node['id']] = df
        except Exception as e:
            log.exception('fetch failed for %s: %s', node['id'], e)
            out[node['id']] = pd.DataFrame(columns=['value'])
    return out
```

> **Note on akshare APIs:** The function names above (`futures_main_sina`, `stock_zh_a_daily`, `spot_price_qh_sina`) reflect akshare conventions but akshare evolves frequently. If any call fails at runtime, look up the current name in akshare docs (https://akshare.akfamily.xyz) and update the call. The test in step 3 uses recorded fixtures, so it stays green even if APIs change — but `build.py` will surface real errors.

- [ ] **Step 2: Capture a fixture by running fetch once**

```bash
cd scripts && python -c "
import datetime as dt, pandas as pd
from fetch import fetch_node
from chain_config import get_node
df = fetch_node(get_node('SI'), dt.date(2024, 1, 1))
df.to_csv('tests/fixtures/sample_si.csv')
print(f'captured {len(df)} rows')
" && cd ..
```

Expected: prints something like `captured 300 rows`. If it errors (akshare API changed), update fetch_futures and retry.

- [ ] **Step 3: Write regression test in `scripts/tests/test_fetch.py`**

```python
"""Regression tests for fetch.py. Real API calls are not exercised here —
we verify the parsing/shape contract using a recorded CSV fixture.
"""
from pathlib import Path
import pandas as pd

FIXTURE = Path(__file__).parent / 'fixtures' / 'sample_si.csv'


def test_fixture_exists_and_has_value_column():
    assert FIXTURE.exists(), 'run the capture command in plan Task 7 step 2 first'
    df = pd.read_csv(FIXTURE, index_col=0, parse_dates=True)
    assert 'value' in df.columns
    assert df['value'].dtype.kind == 'f'
    assert len(df) > 50, 'fixture suspiciously short'


def test_fixture_index_is_monotonic():
    df = pd.read_csv(FIXTURE, index_col=0, parse_dates=True)
    assert df.index.is_monotonic_increasing
```

- [ ] **Step 4: Run tests**

```bash
cd scripts && python -m pytest tests/test_fetch.py -v && cd ..
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch.py scripts/tests/test_fetch.py scripts/tests/fixtures/
git commit -m "feat(data): akshare fetch with per-node isolation and fixture"
```

---

### Task 8: Implement `build.py` to orchestrate everything

**Files:**
- Create: `scripts/build.py`, `data/.gitkeep`

- [ ] **Step 1: Create `scripts/build.py`**

```python
"""Orchestrate fetch -> transform -> correlate -> write data/all.json."""
from __future__ import annotations

import datetime as dt
import json
import logging
from pathlib import Path

import pandas as pd

from chain_config import CHAIN_NODES, get_node
from fetch import fetch_all
from transform import align_to_calendar, forward_fill_capped
from correlate import compute_correlations

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'data' / 'all.json'
WINDOWS = [30, 60]
HISTORY_YEARS = 3

logging.basicConfig(level=logging.INFO, format='%(levelname)s %(name)s %(message)s')
log = logging.getLogger('build')


def correlation_pairs() -> list[tuple[str, str]]:
    """For each non-stock node: (node, upstream) and (node, each related stock)."""
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
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
```

- [ ] **Step 2: Create empty `data/.gitkeep`**

```bash
mkdir -p data && touch data/.gitkeep
```

- [ ] **Step 3: Smoke run**

```bash
cd scripts && python build.py && cd ..
```

Expected: prints `wrote .../data/all.json (24 series, NNNN total points)`. Some nodes will have 0 points (fiber, missing endpoints) — that's fine.

- [ ] **Step 4: Sanity check the JSON**

```bash
python -c "
import json
from pathlib import Path
data = json.loads(Path('data/all.json').read_text(encoding='utf-8'))
assert len(data['series']) == 24
print('series:', len(data['series']))
print('with points >0:', sum(1 for s in data['series'] if s['points']))
print('correlation windows:', list(data['correlations'].keys()))
"
```

Expected: `series: 24`, `with points >0:` >= 10, `correlation windows: ['30', '60']`.

- [ ] **Step 5: Commit (omit the data file from this commit — CI will regenerate it)**

```bash
echo "data/all.json" >> .gitignore
git add scripts/build.py data/.gitkeep .gitignore
git commit -m "feat(data): build.py orchestrator emits data/all.json"
```

> Note: `data/all.json` is generated by CI. We keep it out of the manual commit history; the CI workflow in Task 17 will commit it.

---

## Phase C — Frontend Library Layer

### Task 9: Define types in `src/types.ts`

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create file**

```ts
export type Branch = 'photovoltaic' | 'organosilicon' | 'fiber';
export type SeriesType = 'futures' | 'spot' | 'stock';

export interface DataPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface Series {
  id: string;
  name: string;
  branch: Branch;
  type: SeriesType;
  unit: string;
  upstream: string | null;
  relatedStocks: string[];
  points: DataPoint[];
}

export type CorrelationMap = Record<string, Record<string, number | null>>;

export interface AllData {
  generatedAt: string;
  series: Series[];
  correlations: Record<'30' | '60', CorrelationMap>;
}

export type TimeRange = '1M' | '3M' | '6M' | '1Y' | '3Y' | 'ALL';
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat(fe): core type definitions"
```

---

### Task 10: Implement `src/lib/analytics.ts` with TDD

**Files:**
- Create: `src/lib/analytics.ts`, `src/lib/__tests__/analytics.test.ts`

- [ ] **Step 1: Write the failing test in `src/lib/__tests__/analytics.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { sliceByRange, normalizeFromBase, latestChange, RANGE_DAYS } from '../analytics';
import type { DataPoint } from '../../types';

const points: DataPoint[] = Array.from({ length: 400 }, (_, i) => {
  const d = new Date(2024, 0, 1);
  d.setDate(d.getDate() + i);
  return { date: d.toISOString().slice(0, 10), value: 100 + i };
});

describe('RANGE_DAYS', () => {
  it('maps to known day counts', () => {
    expect(RANGE_DAYS['1M']).toBe(30);
    expect(RANGE_DAYS['1Y']).toBe(365);
    expect(RANGE_DAYS.ALL).toBe(Infinity);
  });
});

describe('sliceByRange', () => {
  it('returns last N days when range is bounded', () => {
    const out = sliceByRange(points, '1M');
    expect(out.length).toBeLessThanOrEqual(31);
    expect(out[out.length - 1]).toEqual(points[points.length - 1]);
  });

  it('returns all points for ALL', () => {
    expect(sliceByRange(points, 'ALL').length).toBe(points.length);
  });

  it('returns empty when given empty', () => {
    expect(sliceByRange([], '1Y')).toEqual([]);
  });
});

describe('normalizeFromBase', () => {
  it('first point is 100', () => {
    const out = normalizeFromBase(points.slice(0, 5));
    expect(out[0].value).toBe(100);
  });

  it('preserves ratio', () => {
    const sample: DataPoint[] = [
      { date: '2024-01-01', value: 50 },
      { date: '2024-01-02', value: 75 },
      { date: '2024-01-03', value: 100 },
    ];
    const out = normalizeFromBase(sample);
    expect(out[1].value).toBeCloseTo(150, 6);
    expect(out[2].value).toBeCloseTo(200, 6);
  });

  it('returns empty when input empty', () => {
    expect(normalizeFromBase([])).toEqual([]);
  });

  it('handles zero base by returning unchanged values', () => {
    const sample: DataPoint[] = [
      { date: '2024-01-01', value: 0 },
      { date: '2024-01-02', value: 5 },
    ];
    const out = normalizeFromBase(sample);
    expect(out).toEqual(sample);
  });
});

describe('latestChange', () => {
  it('returns last value and day-over-day change percent', () => {
    const sample: DataPoint[] = [
      { date: '2024-01-01', value: 100 },
      { date: '2024-01-02', value: 110 },
    ];
    expect(latestChange(sample)).toEqual({ value: 110, changePct: 10 });
  });

  it('returns null when fewer than 2 points', () => {
    expect(latestChange([])).toBeNull();
    expect(latestChange([{ date: '2024-01-01', value: 1 }])).toBeNull();
  });
});
```

- [ ] **Step 2: Run — should fail**

```bash
npm test -- src/lib/__tests__/analytics.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/analytics.ts`**

```ts
import type { DataPoint, TimeRange } from '../types';

export const RANGE_DAYS: Record<TimeRange, number> = {
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365,
  '3Y': 365 * 3,
  ALL: Infinity,
};

export function sliceByRange(points: DataPoint[], range: TimeRange): DataPoint[] {
  if (points.length === 0) return points;
  const days = RANGE_DAYS[range];
  if (!Number.isFinite(days)) return points;
  const cutoffMs = new Date(points[points.length - 1].date).getTime() - days * 86400_000;
  return points.filter((p) => new Date(p.date).getTime() >= cutoffMs);
}

export function normalizeFromBase(points: DataPoint[]): DataPoint[] {
  if (points.length === 0) return points;
  const base = points[0].value;
  if (base === 0) return points;
  return points.map((p) => ({ date: p.date, value: (p.value / base) * 100 }));
}

export function latestChange(points: DataPoint[]): { value: number; changePct: number } | null {
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const changePct = prev.value === 0 ? 0 : ((last.value - prev.value) / prev.value) * 100;
  return { value: last.value, changePct };
}
```

- [ ] **Step 4: Run tests — should pass**

```bash
npm test -- src/lib/__tests__/analytics.test.ts
```

Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analytics.ts src/lib/__tests__/analytics.test.ts
git commit -m "feat(fe): analytics helpers (slice, normalize, latestChange) (TDD)"
```

---

### Task 11: Implement `src/lib/insight.ts` with TDD

**Files:**
- Create: `src/lib/insight.ts`, `src/lib/__tests__/insight.test.ts`

- [ ] **Step 1: Write the failing test in `src/lib/__tests__/insight.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { generateInsight, classifyCorrelation, pickTopRelatedStock } from '../insight';
import type { CorrelationMap } from '../../types';

describe('classifyCorrelation', () => {
  it('labels by absolute value', () => {
    expect(classifyCorrelation(0.85)).toBe('强正相关');
    expect(classifyCorrelation(-0.85)).toBe('强负相关');
    expect(classifyCorrelation(0.5)).toBe('中等正相关');
    expect(classifyCorrelation(0.2)).toBe('弱相关');
    expect(classifyCorrelation(null)).toBe('数据不足');
  });
});

describe('pickTopRelatedStock', () => {
  it('picks the relatedStock with highest absolute correlation', () => {
    const corr: CorrelationMap = { 'polysilicon-dense': { '600438': 0.5, '688303': 0.78, '603260': -0.6 } };
    expect(pickTopRelatedStock('polysilicon-dense', ['600438', '688303', '603260'], corr)).toBe('688303');
  });

  it('returns null when no candidates have correlation data', () => {
    const corr: CorrelationMap = { 'polysilicon-dense': {} };
    expect(pickTopRelatedStock('polysilicon-dense', ['600438'], corr)).toBeNull();
  });
});

describe('generateInsight', () => {
  it('describes upstream and related stock with named entities', () => {
    const text = generateInsight({
      nodeName: '多晶硅致密料',
      upstreamName: '多晶硅期货主力',
      upstreamCorr: 0.85,
      stockName: '通威股份',
      stockCorr: 0.55,
    });
    expect(text).toContain('多晶硅致密料');
    expect(text).toContain('多晶硅期货主力');
    expect(text).toContain('强正相关');
    expect(text).toContain('通威股份');
    expect(text).toContain('0.55');
  });

  it('omits upstream clause when no upstream', () => {
    const text = generateInsight({
      nodeName: '工业硅期货主力',
      upstreamName: null,
      upstreamCorr: null,
      stockName: '合盛硅业',
      stockCorr: 0.72,
    });
    expect(text).toContain('合盛硅业');
    expect(text).not.toContain('上游');
  });
});
```

- [ ] **Step 2: Run — should fail**

```bash
npm test -- src/lib/__tests__/insight.test.ts
```

- [ ] **Step 3: Implement `src/lib/insight.ts`**

```ts
import type { CorrelationMap } from '../types';

export function classifyCorrelation(r: number | null): string {
  if (r === null || Number.isNaN(r)) return '数据不足';
  const a = Math.abs(r);
  const sign = r >= 0 ? '正' : '负';
  if (a >= 0.7) return `强${sign}相关`;
  if (a >= 0.4) return `中等${sign}相关`;
  return '弱相关';
}

export function pickTopRelatedStock(
  nodeId: string,
  candidates: string[],
  corr60: CorrelationMap,
): string | null {
  const row = corr60[nodeId] ?? {};
  let best: string | null = null;
  let bestAbs = -1;
  for (const c of candidates) {
    const r = row[c];
    if (r === null || r === undefined) continue;
    const a = Math.abs(r);
    if (a > bestAbs) {
      bestAbs = a;
      best = c;
    }
  }
  return best;
}

export interface InsightInput {
  nodeName: string;
  upstreamName: string | null;
  upstreamCorr: number | null;
  stockName: string | null;
  stockCorr: number | null;
}

export function generateInsight(i: InsightInput): string {
  const parts: string[] = [];
  if (i.upstreamName && i.upstreamCorr !== null) {
    parts.push(
      `${i.nodeName} 与上游 ${i.upstreamName} 60日相关性 ${i.upstreamCorr.toFixed(2)}（${classifyCorrelation(i.upstreamCorr)}）`,
    );
  }
  if (i.stockName && i.stockCorr !== null) {
    parts.push(
      `关联股票 ${i.stockName} 相关性 ${i.stockCorr.toFixed(2)}（${classifyCorrelation(i.stockCorr)}）`,
    );
  }
  if (parts.length === 0) return `${i.nodeName} 暂无足够数据生成解读`;
  return parts.join('；');
}
```

- [ ] **Step 4: Run tests — should pass**

```bash
npm test -- src/lib/__tests__/insight.test.ts
```

Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/insight.ts src/lib/__tests__/insight.test.ts
git commit -m "feat(fe): insight text generator (TDD)"
```

---

### Task 12: Implement `useAllData` hook

**Files:**
- Create: `src/hooks/useAllData.ts`, `src/hooks/__tests__/useAllData.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAllData } from '../useAllData';

const sample = {
  generatedAt: '2026-04-29T00:00:00Z',
  series: [{ id: 'SI', name: '工业硅', branch: 'photovoltaic', type: 'futures', unit: '¥/吨',
              upstream: null, relatedStocks: [], points: [] }],
  correlations: { '30': {}, '60': {} },
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

describe('useAllData', () => {
  it('fetches and returns data', async () => {
    const { result } = renderHook(() => useAllData());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.series.length).toBe(1);
    expect(result.current.error).toBeNull();
  });

  it('reports error on failed fetch', async () => {
    // @ts-expect-error
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 404 }));
    const { result } = renderHook(() => useAllData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — should fail**

```bash
npm test -- src/hooks/__tests__/useAllData.test.tsx
```

- [ ] **Step 3: Implement `src/hooks/useAllData.ts`**

```ts
import { useEffect, useState } from 'react';
import type { AllData } from '../types';

interface State {
  data: AllData | null;
  loading: boolean;
  error: Error | null;
}

const DATA_URL = `${import.meta.env.BASE_URL}data/all.json`;

export function useAllData(): State {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    fetch(DATA_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<AllData>;
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

- [ ] **Step 4: Run tests — should pass**

```bash
npm test -- src/hooks/__tests__/useAllData.test.tsx
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAllData.ts src/hooks/__tests__/useAllData.test.tsx
git commit -m "feat(fe): useAllData hook (TDD)"
```

---

### Task 13: Implement `useSelection` hook

**Files:**
- Create: `src/hooks/useSelection.ts`, `src/hooks/__tests__/useSelection.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from 'vitest';
import { computeSelection } from '../useSelection';
import type { AllData } from '../../types';

const ALL: AllData = {
  generatedAt: 'x',
  series: [
    { id: 'SI', name: '工业硅期货', branch: 'photovoltaic', type: 'futures', unit: '¥/吨',
      upstream: null, relatedStocks: ['603260'],
      points: [{ date: '2024-01-01', value: 14000 }, { date: '2024-01-02', value: 14100 }] },
    { id: 'PS', name: '多晶硅期货', branch: 'photovoltaic', type: 'futures', unit: '¥/吨',
      upstream: 'SI', relatedStocks: ['688303'],
      points: [{ date: '2024-01-01', value: 50000 }, { date: '2024-01-02', value: 50500 }] },
    { id: '603260', name: '合盛硅业', branch: 'organosilicon', type: 'stock', unit: '¥/股',
      upstream: null, relatedStocks: [],
      points: [{ date: '2024-01-01', value: 40 }, { date: '2024-01-02', value: 41 }] },
    { id: '688303', name: '大全能源', branch: 'photovoltaic', type: 'stock', unit: '¥/股',
      upstream: null, relatedStocks: [],
      points: [{ date: '2024-01-01', value: 30 }, { date: '2024-01-02', value: 31 }] },
  ],
  correlations: {
    '30': {},
    '60': {
      'PS': { 'SI': 0.85, '688303': 0.78 },
    },
  },
};

describe('computeSelection', () => {
  it('returns primary + upstream + topStock for an inner node', () => {
    const sel = computeSelection(ALL, 'PS');
    expect(sel.primary?.id).toBe('PS');
    expect(sel.upstream?.id).toBe('SI');
    expect(sel.topStock?.id).toBe('688303');
    expect(sel.upstreamCorr).toBe(0.85);
    expect(sel.topStockCorr).toBe(0.78);
  });

  it('returns null upstream for chain origin', () => {
    const sel = computeSelection(ALL, 'SI');
    expect(sel.primary?.id).toBe('SI');
    expect(sel.upstream).toBeNull();
  });

  it('returns null primary for unknown id', () => {
    const sel = computeSelection(ALL, 'unknown');
    expect(sel.primary).toBeNull();
  });
});
```

- [ ] **Step 2: Run — should fail**

```bash
npm test -- src/hooks/__tests__/useSelection.test.ts
```

- [ ] **Step 3: Implement `src/hooks/useSelection.ts`**

```ts
import { useMemo } from 'react';
import type { AllData, Series } from '../types';
import { pickTopRelatedStock } from '../lib/insight';

export interface Selection {
  primary: Series | null;
  upstream: Series | null;
  topStock: Series | null;
  upstreamCorr: number | null;
  topStockCorr: number | null;
}

export function computeSelection(all: AllData, nodeId: string): Selection {
  const byId = new Map(all.series.map((s) => [s.id, s]));
  const primary = byId.get(nodeId) ?? null;
  if (!primary) return { primary: null, upstream: null, topStock: null, upstreamCorr: null, topStockCorr: null };

  const upstream = primary.upstream ? byId.get(primary.upstream) ?? null : null;
  const corr60 = all.correlations['60'] ?? {};
  const upstreamCorr = upstream ? corr60[primary.id]?.[upstream.id] ?? null : null;

  const topStockId = pickTopRelatedStock(primary.id, primary.relatedStocks, corr60);
  const topStock = topStockId ? byId.get(topStockId) ?? null : null;
  const topStockCorr = topStockId ? corr60[primary.id]?.[topStockId] ?? null : null;

  return { primary, upstream, topStock, upstreamCorr, topStockCorr };
}

export function useSelection(all: AllData | null, nodeId: string | null): Selection | null {
  return useMemo(() => {
    if (!all || !nodeId) return null;
    return computeSelection(all, nodeId);
  }, [all, nodeId]);
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- src/hooks/__tests__/useSelection.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSelection.ts src/hooks/__tests__/useSelection.test.ts
git commit -m "feat(fe): useSelection hook with computeSelection (TDD)"
```

---

## Phase D — UI Components

### Task 14: `ChainCard` component

**Files:**
- Create: `src/components/ChainCard.tsx`, `src/components/__tests__/ChainCard.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChainCard } from '../ChainCard';
import type { Series } from '../../types';

const SERIES: Series = {
  id: 'PS', name: '多晶硅期货主力', branch: 'photovoltaic', type: 'futures', unit: '¥/吨',
  upstream: 'SI', relatedStocks: [],
  points: [
    { date: '2024-01-01', value: 50000 },
    { date: '2024-01-02', value: 50500 },
  ],
};

describe('ChainCard', () => {
  it('renders name and latest value', () => {
    render(<ChainCard series={SERIES} state="default" onClick={() => {}} />);
    expect(screen.getByText('多晶硅期货主力')).toBeInTheDocument();
    expect(screen.getByText(/50,500/)).toBeInTheDocument();
    expect(screen.getByText(/\+1\.00%/)).toBeInTheDocument();
  });

  it('renders empty placeholder when no points', () => {
    const empty: Series = { ...SERIES, points: [] };
    render(<ChainCard series={empty} state="default" onClick={() => {}} />);
    expect(screen.getByText(/暂无数据/)).toBeInTheDocument();
  });

  it('fires onClick with id', () => {
    const onClick = vi.fn();
    render(<ChainCard series={SERIES} state="default" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith('PS');
  });
});
```

- [ ] **Step 2: Run — should fail**

```bash
npm test -- src/components/__tests__/ChainCard.test.tsx
```

- [ ] **Step 3: Implement `src/components/ChainCard.tsx`**

```tsx
import type { Series } from '../types';
import { latestChange } from '../lib/analytics';

export type CardState = 'default' | 'selected' | 'related' | 'empty';

interface Props {
  series: Series;
  state: CardState;
  onClick: (id: string) => void;
}

const stateClass: Record<CardState, string> = {
  default: 'bg-white border-gray-200 hover:border-blue-400',
  selected: 'bg-blue-600 text-white border-blue-700',
  related: 'bg-emerald-50 border-emerald-400',
  empty: 'bg-gray-50 border-gray-200 text-gray-400',
};

const fmt = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 });

export function ChainCard({ series, state, onClick }: Props) {
  const change = latestChange(series.points);
  const isEmpty = series.points.length === 0;
  const effectiveState: CardState = isEmpty ? 'empty' : state;

  return (
    <button
      type="button"
      onClick={() => onClick(series.id)}
      className={`min-w-[120px] flex-1 rounded-md border p-2 text-left text-sm transition ${stateClass[effectiveState]}`}
    >
      <div className="text-xs opacity-70">{series.name}</div>
      {isEmpty ? (
        <div className="mt-1 text-xs">暂无数据</div>
      ) : change ? (
        <>
          <div className="mt-1 font-semibold">{fmt.format(change.value)}</div>
          <div
            className={`text-xs ${
              effectiveState === 'selected'
                ? 'text-white'
                : change.changePct >= 0
                ? 'text-emerald-600'
                : 'text-rose-600'
            }`}
          >
            {change.changePct >= 0 ? '+' : ''}
            {change.changePct.toFixed(2)}%
          </div>
        </>
      ) : null}
    </button>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- src/components/__tests__/ChainCard.test.tsx
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/ChainCard.tsx src/components/__tests__/ChainCard.test.tsx
git commit -m "feat(fe): ChainCard with default/selected/related/empty states"
```

---

### Task 15: `BranchSection` and `ChainOverview`

**Files:**
- Create: `src/components/BranchSection.tsx`, `src/components/ChainOverview.tsx`, `src/lib/chain.ts`

- [ ] **Step 1: Create `src/lib/chain.ts` (frontend mirror of branch labels)**

```ts
import type { Branch } from '../types';

export const BRANCH_LABELS: Record<Branch, string> = {
  photovoltaic: '光伏链',
  organosilicon: '有机硅链',
  fiber: '光纤链（实验性）',
};

export const BRANCH_ORDER: Branch[] = ['photovoltaic', 'organosilicon', 'fiber'];
```

- [ ] **Step 2: Create `src/components/BranchSection.tsx`**

```tsx
import type { Series, Branch } from '../types';
import { ChainCard, type CardState } from './ChainCard';
import { BRANCH_LABELS } from '../lib/chain';

interface Props {
  branch: Branch;
  series: Series[];
  selectedId: string | null;
  upstreamId: string | null;
  topStockId: string | null;
  onSelect: (id: string) => void;
}

export function BranchSection({ branch, series, selectedId, upstreamId, topStockId, onSelect }: Props) {
  const ordered = [...series].sort((a, b) => {
    const order = { futures: 0, spot: 1, stock: 2 } as const;
    return order[a.type] - order[b.type];
  });

  function stateOf(id: string): CardState {
    if (id === selectedId) return 'selected';
    if (id === upstreamId || id === topStockId) return 'related';
    return 'default';
  }

  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-semibold text-gray-700">▎ {BRANCH_LABELS[branch]}</h2>
      <div className="flex flex-wrap gap-2">
        {ordered.map((s) => (
          <ChainCard key={s.id} series={s} state={stateOf(s.id)} onClick={onSelect} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Create `src/components/ChainOverview.tsx`**

```tsx
import type { AllData } from '../types';
import { BRANCH_ORDER } from '../lib/chain';
import { BranchSection } from './BranchSection';

interface Props {
  data: AllData;
  selectedId: string | null;
  upstreamId: string | null;
  topStockId: string | null;
  onSelect: (id: string) => void;
}

export function ChainOverview({ data, selectedId, upstreamId, topStockId, onSelect }: Props) {
  return (
    <div>
      {BRANCH_ORDER.map((b) => {
        const series = data.series.filter((s) => s.branch === b);
        if (series.length === 0) return null;
        return (
          <BranchSection
            key={b}
            branch={b}
            series={series}
            selectedId={selectedId}
            upstreamId={upstreamId}
            topStockId={topStockId}
            onSelect={onSelect}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Smoke compile (no test added — these are pure presentation, covered in Task 19 integration)**

```bash
npx tsc --noEmit
```

Expected: no output (success).

- [ ] **Step 5: Commit**

```bash
git add src/lib/chain.ts src/components/BranchSection.tsx src/components/ChainOverview.tsx
git commit -m "feat(fe): BranchSection and ChainOverview"
```

---

### Task 16: `TimelineChart` component (ECharts)

**Files:**
- Create: `src/components/TimelineChart.tsx`

- [ ] **Step 1: Implement `src/components/TimelineChart.tsx`**

```tsx
import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { Series, TimeRange } from '../types';
import { sliceByRange, normalizeFromBase } from '../lib/analytics';

interface Line {
  series: Series;
  color: string;
  dashed?: boolean;
}

interface Props {
  lines: Line[];
  range: TimeRange;
}

export function TimelineChart({ lines, range }: Props) {
  const option = useMemo(() => {
    const echartsSeries = lines
      .filter((l) => l.series.points.length > 0)
      .map((l) => {
        const sliced = sliceByRange(l.series.points, range);
        const normalized = normalizeFromBase(sliced);
        return {
          name: l.series.name,
          type: 'line' as const,
          smooth: true,
          symbol: 'none' as const,
          lineStyle: { color: l.color, width: 1.8, type: l.dashed ? 'dashed' : 'solid' },
          itemStyle: { color: l.color },
          data: normalized.map((p) => [p.date, +p.value.toFixed(2)]),
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
  }, [lines, range]);

  if (lines.every((l) => l.series.points.length === 0)) {
    return (
      <div className="flex h-72 items-center justify-center rounded-md border border-dashed border-gray-300 text-sm text-gray-400">
        当前选中的节点暂无数据
      </div>
    );
  }

  return <ReactECharts option={option} style={{ height: 320 }} notMerge lazyUpdate />;
}
```

- [ ] **Step 2: Smoke compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/TimelineChart.tsx
git commit -m "feat(fe): TimelineChart with ECharts (normalized overlay)"
```

---

### Task 17: `InsightPanel` and `TimeRangePicker`

**Files:**
- Create: `src/components/InsightPanel.tsx`, `src/components/TimeRangePicker.tsx`

- [ ] **Step 1: Create `src/components/InsightPanel.tsx`**

```tsx
import type { Selection } from '../hooks/useSelection';
import { generateInsight } from '../lib/insight';

interface Props {
  selection: Selection;
}

export function InsightPanel({ selection }: Props) {
  if (!selection.primary) return null;
  const text = generateInsight({
    nodeName: selection.primary.name,
    upstreamName: selection.upstream?.name ?? null,
    upstreamCorr: selection.upstreamCorr,
    stockName: selection.topStock?.name ?? null,
    stockCorr: selection.topStockCorr,
  });
  return (
    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      💡 {text}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/TimeRangePicker.tsx`**

```tsx
import type { TimeRange } from '../types';

const ORDER: TimeRange[] = ['1M', '3M', '6M', '1Y', '3Y', 'ALL'];
const LABEL: Record<TimeRange, string> = {
  '1M': '1月', '3M': '3月', '6M': '6月', '1Y': '1年', '3Y': '3年', ALL: '全部',
};

interface Props {
  value: TimeRange;
  onChange: (r: TimeRange) => void;
}

export function TimeRangePicker({ value, onChange }: Props) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-gray-200 text-sm">
      {ORDER.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={`px-3 py-1 transition ${
            r === value ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          {LABEL[r]}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Smoke compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/InsightPanel.tsx src/components/TimeRangePicker.tsx
git commit -m "feat(fe): InsightPanel and TimeRangePicker"
```

---

### Task 18: Wire everything in `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace `src/App.tsx`**

```tsx
import { useState } from 'react';
import { useAllData } from './hooks/useAllData';
import { useSelection } from './hooks/useSelection';
import { ChainOverview } from './components/ChainOverview';
import { TimelineChart } from './components/TimelineChart';
import { InsightPanel } from './components/InsightPanel';
import { TimeRangePicker } from './components/TimeRangePicker';
import type { TimeRange } from './types';

const DEFAULT_NODE = 'SI';

export default function App() {
  const { data, loading, error } = useAllData();
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_NODE);
  const [range, setRange] = useState<TimeRange>('1Y');
  const selection = useSelection(data, selectedId);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-gray-500">
        加载中…
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm">
        <p className="text-rose-600">数据加载失败：{error?.message ?? '未知错误'}</p>
        <button
          type="button"
          className="rounded-md border border-gray-300 bg-white px-3 py-1"
          onClick={() => location.reload()}
        >
          重试
        </button>
      </main>
    );
  }

  const lines = selection
    ? [
        selection.primary && { series: selection.primary, color: '#3b82f6' },
        selection.upstream && { series: selection.upstream, color: '#10b981', dashed: true },
        selection.topStock && { series: selection.topStock, color: '#a855f7' },
      ].filter((l): l is { series: NonNullable<typeof l>['series']; color: string; dashed?: boolean } => Boolean(l))
    : [];

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">siltrack · 硅产业链看板</h1>
          <p className="text-xs text-gray-500">
            数据更新时间 {new Date(data.generatedAt).toLocaleString('zh-CN')}
          </p>
        </div>
        <TimeRangePicker value={range} onChange={setRange} />
      </header>

      <ChainOverview
        data={data}
        selectedId={selection?.primary?.id ?? null}
        upstreamId={selection?.upstream?.id ?? null}
        topStockId={selection?.topStock?.id ?? null}
        onSelect={setSelectedId}
      />

      <section className="mt-2 rounded-md border border-gray-200 bg-white p-3">
        <TimelineChart lines={lines} range={range} />
        {selection && <InsightPanel selection={selection} />}
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Place a real `data/all.json` for local dev**

The fetched real `all.json` from Task 8 is in `data/`. Vite serves files from `public/` by default — symlink so the frontend can read it:

```bash
mkdir -p public && cp data/all.json public/data/all.json
```

(For dev only. CI deploys `dist/` which contains a built copy. We'll formalize this in Task 19.)

- [ ] **Step 3: Run dev server and click around**

```bash
npm run dev
```

Open `http://localhost:5173/`. Verify:
- Three branch sections render with cards
- Default selection (`SI`) is highlighted blue
- Chart shows the SI line
- Clicking another card switches the chart
- Time range buttons reslice the chart
- Insight text appears below the chart

If a card has no data, it renders gray with "暂无数据" — that is correct behavior.

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx public/
git commit -m "feat(fe): wire App with selection, chart, range picker, insight"
```

---

### Task 19: Build pipeline includes `data/all.json` in `dist/`

The frontend reads from `${BASE_URL}data/all.json` (set in `useAllData`). The Pages site serves whatever ends up in `dist/`. We need to ensure `data/all.json` is copied into `dist/` at build time.

**Files:**
- Modify: `vite.config.ts`, `package.json`, `.gitignore`

- [ ] **Step 1: Move `data/all.json` location for Vite static serving**

Vite copies `public/` into `dist/`. Adjust the build to symlink `public/data` → repo `data` so a single source of truth exists.

Replace the build script in `package.json`:

```json
"build": "node scripts/prep-public.cjs && tsc -b && vite build",
```

- [ ] **Step 2: Create `scripts/prep-public.cjs`**

```cjs
// Mirror data/all.json into public/data/all.json so vite includes it in dist/.
const fs = require('node:fs');
const path = require('node:path');

const src = path.resolve(__dirname, '..', 'data', 'all.json');
const destDir = path.resolve(__dirname, '..', 'public', 'data');
const dest = path.join(destDir, 'all.json');

if (!fs.existsSync(src)) {
  console.warn(`prep-public: ${src} not found; build will lack data/all.json`);
  process.exit(0);
}
fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`prep-public: copied ${src} -> ${dest}`);
```

- [ ] **Step 3: Update `.gitignore`** — add:

```
public/data/
dist/
```

- [ ] **Step 4: Run build**

```bash
npm run build
ls dist/data/
```

Expected: `dist/data/all.json` exists.

- [ ] **Step 5: Preview the production build**

```bash
npx vite preview
```

Open the printed URL. Same UX as dev. Press `q` to quit.

- [ ] **Step 6: Commit**

```bash
git add scripts/prep-public.cjs package.json .gitignore
git commit -m "chore: prep-public step copies data/all.json into dist/ at build"
```

---

## Phase E — CI / Deploy

### Task 20: GitHub Action — daily data update

**Files:**
- Create: `.github/workflows/update-data.yml`

- [ ] **Step 1: Create the workflow**

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

      - name: Commit if changed
        run: |
          git config user.name 'siltrack-bot'
          git config user.email 'siltrack-bot@users.noreply.github.com'
          git add -f data/all.json
          if git diff --cached --quiet; then
            echo "no data changes"
          else
            git commit -m "chore(data): daily refresh $(date -u +%Y-%m-%d)"
            git push
          fi
```

- [ ] **Step 2: Locally lint the YAML**

```bash
python -c "import yaml,sys; yaml.safe_load(open('.github/workflows/update-data.yml'))" && echo OK
```

Expected: `OK`.

- [ ] **Step 3: Remove `data/all.json` from `.gitignore`** so the bot can commit it. Edit `.gitignore` and delete the line `data/all.json` (added in Task 8).

```bash
# After editing, verify:
grep -n 'data/all.json' .gitignore && echo 'STILL IGNORED — fix it' || echo 'OK ignore line removed'
```

- [ ] **Step 4: Commit workflow**

```bash
git add .github/workflows/update-data.yml .gitignore
git commit -m "ci: daily data refresh workflow"
```

---

### Task 21: GitHub Action — deploy to Pages

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy site

on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'public/**'
      - 'data/**'
      - 'index.html'
      - 'package.json'
      - 'package-lock.json'
      - 'vite.config.ts'
      - 'tailwind.config.js'
      - 'postcss.config.js'
      - 'tsconfig.json'
      - 'tsconfig.node.json'
      - 'scripts/prep-public.cjs'
  workflow_dispatch: {}

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Lint**

```bash
python -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy.yml'))" && echo OK
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: GitHub Pages deploy on main push"
```

> **Manual one-time setup after pushing to GitHub** (not part of the automated plan):
> 1. Create a GitHub repo named `siltrack` and `git remote add origin ... && git push -u origin main`
> 2. Repo Settings → Pages → Source: **GitHub Actions**
> 3. Trigger `Update data` workflow once manually to seed `data/all.json` on `main`

---

### Task 22: README and final smoke

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# siltrack · 硅产业链看板

面向非业内人士的硅产业链可视化工具。覆盖 24 个数据序列，分布在 3 条产业链：

- **光伏链**：工业硅期货 → 多晶硅 → 硅片 → 电池片 → 组件
- **有机硅链**：工业硅 → DMC → 107 硅橡胶 / 硅油 / 气相白炭黑
- **光纤链**（实验性）：高纯石英砂 → 光纤预制棒 → 光纤光缆

点击产业链上任意节点，下方图表自动叠加该节点 + 上游一节点 + 最相关股票，附文字解读。

## 在线访问

`https://<github-user>.github.io/siltrack/`

## 数据来源

- 期货：广期所（akshare 接入新浪期货）
- 现货：生意社聚合（akshare）
- 股票：A 股日线（akshare）
- 相关性：Python 后端预算 30/60 日 Pearson

数据每日 UTC 23:00（北京时间次日 07:00）由 GitHub Actions 自动刷新。

## 本地开发

依赖：Node 20+、Python 3.11+

```bash
git clone <repo-url> siltrack && cd siltrack

# 拉一份数据
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r scripts/requirements.txt
python scripts/build.py     # 写入 data/all.json

# 跑前端
npm install
npm run dev                  # http://localhost:5173
```

## 测试

```bash
npm test                     # Vitest 前端测试
cd scripts && python -m pytest tests/ -v && cd ..
```

## 项目结构

```
siltrack/
├── data/all.json             # CI 写入，前端读取（gh 不忽略）
├── scripts/                  # Python 数据层（akshare → all.json）
├── src/                      # React + TS 前端
├── .github/workflows/
│   ├── update-data.yml       # 每日数据刷新
│   └── deploy.yml            # main push → Pages 部署
└── docs/superpowers/
    ├── specs/                # 设计文档
    └── plans/                # 实施计划
```

## 已知限制

- 光纤链（`quartz-sand` / `optical-preform` / `optical-fiber`）目前 akshare 没有公开端点；前端会以"暂无数据"灰显
- 现货价格部分序列周更，已用 ≤5 交易日的前向填充对齐
- 不是交易工具，不构成投资建议
```

- [ ] **Step 2: Run all tests one last time**

```bash
npm test && cd scripts && python -m pytest tests/ -v && cd ..
```

Expected: all green on both sides.

- [ ] **Step 3: Final smoke build**

```bash
npm run build
ls dist/data/all.json && echo OK
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: README with overview, dev setup, and known limits"
```

---

## Done

After Task 22, `git log --oneline` should show 22 commits, the dev server renders a working dashboard against real data, and pushing to GitHub will trigger the deploy workflow. The daily data refresh workflow runs autonomously thereafter.

## Out of scope (future work)

- ECharts on-demand bundle imports (current bundle ~600KB)
- A separate sankey diagram for chain visualization
- E2E tests (Playwright)
- A "compare mode" toggle that switches from smart auto-overlay to free multi-select
- Alerts when correlations break down or prices cross thresholds
