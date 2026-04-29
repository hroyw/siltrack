"""Fetch raw price series via akshare.

One function per series type (futures / spot / stock). Each returns a
single-column ``pandas.DataFrame`` indexed by date with a ``value`` column
of dtype ``float64``.

Spot prices are pulled from akshare's 99qh aggregator (``spot_price_qh``),
which exposes 生意社/期现 daily prices for ~80 commodities. Many silicon-chain
nodes — particularly the fiber branch and downstream PV processed goods —
have no clean akshare endpoint; for those we return an empty frame and let
downstream code surface them as 'no data'.
"""
from __future__ import annotations

import datetime as dt
import logging
from typing import Optional

import akshare as ak
import pandas as pd

from chain_config import ChainNode, CHAIN_NODES

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Mapping tables
# ---------------------------------------------------------------------------

# Map chain-config IDs to akshare 99qh ``symbol`` arguments. ``None`` means
# we have no known endpoint yet — those nodes record an empty frame.
SPOT_AKSHARE_KEYS: dict[str, Optional[str]] = {
    'polysilicon-dense': '多晶硅',
    'wafer-m10': None,         # no clean 99qh series for wafers
    'cell-topcon': None,       # no clean 99qh series for cells
    'module': None,            # no clean 99qh series for modules
    'dmc': None,               # 99qh has no DMC; consider PV InfoLink/sysweb
    'silicone-107': None,
    'silicone-oil': None,
    'fumed-silica': None,
    'quartz-sand': None,
    'optical-preform': None,
    'optical-fiber': None,
}

# Chain-config futures IDs -> akshare ``futures_main_sina`` symbol.
FUTURES_SYMBOLS: dict[str, str] = {
    'SI': 'SI0',
    'PS': 'PS0',
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _empty_frame() -> pd.DataFrame:
    """Canonical empty frame matching the shape the rest of the pipeline expects."""
    idx = pd.DatetimeIndex([], name='date')
    return pd.DataFrame({'value': pd.Series(dtype='float64')}, index=idx)


def _to_yyyymmdd(d: dt.date) -> str:
    return d.strftime('%Y%m%d')


def _shape(df: pd.DataFrame, date_col: str, value_col: str) -> pd.DataFrame:
    """Coerce a multi-column akshare frame to our (DatetimeIndex, ['value']) shape."""
    if df is None or len(df) == 0:
        return _empty_frame()
    out = df[[date_col, value_col]].copy()
    out[date_col] = pd.to_datetime(out[date_col], errors='coerce')
    out = out.dropna(subset=[date_col])
    out[value_col] = pd.to_numeric(out[value_col], errors='coerce').astype('float64')
    out = out.dropna(subset=[value_col])
    out = out.set_index(date_col).sort_index()
    out.index.name = 'date'
    out = out.rename(columns={value_col: 'value'})
    # Drop accidental duplicate dates (keep last).
    out = out[~out.index.duplicated(keep='last')]
    return out[['value']]


# ---------------------------------------------------------------------------
# Per-type fetchers
# ---------------------------------------------------------------------------

def fetch_futures(node_id: str, start: dt.date) -> pd.DataFrame:
    """Daily settlement of the main contract via ``ak.futures_main_sina``.

    Uses the 动态结算价 (dynamic settlement) column when present, else 收盘价.
    """
    sym = FUTURES_SYMBOLS.get(node_id)
    if sym is None:
        log.warning('no futures symbol mapped for node %s', node_id)
        return _empty_frame()
    end = dt.date.today()
    df = ak.futures_main_sina(
        symbol=sym,
        start_date=_to_yyyymmdd(start),
        end_date=_to_yyyymmdd(end),
    )
    value_col = '动态结算价' if '动态结算价' in df.columns else '收盘价'
    return _shape(df, date_col='日期', value_col=value_col)


def _sina_prefix(stock_code: str) -> str:
    """A-share Sina symbol prefix: sh for 6xx, sz for 0xx/3xx, bj for 8xx/4xx."""
    head = stock_code[:1]
    if head == '6':
        return 'sh'
    if head in ('0', '3'):
        return 'sz'
    return 'bj'


def fetch_stock(stock_code: str, start: dt.date) -> pd.DataFrame:
    """A-share daily close.

    Primary path: ``ak.stock_zh_a_daily`` (Sina, qfq adjust). Falls back to
    the eastmoney-backed ``ak.stock_zh_a_hist`` if Sina errors. Sina is
    preferred because it reliably reaches from networks where eastmoney
    is blocked.
    """
    end = dt.date.today()
    sina_symbol = f'{_sina_prefix(stock_code)}{stock_code}'
    try:
        df = ak.stock_zh_a_daily(
            symbol=sina_symbol,
            start_date=_to_yyyymmdd(start),
            end_date=_to_yyyymmdd(end),
            adjust='qfq',
        )
        return _shape(df, date_col='date', value_col='close')
    except Exception as e:  # noqa: BLE001
        log.warning('stock_zh_a_daily failed for %s (%s); trying eastmoney',
                    stock_code, e)
    df = ak.stock_zh_a_hist(
        symbol=stock_code,
        period='daily',
        start_date=_to_yyyymmdd(start),
        end_date=_to_yyyymmdd(end),
        adjust='qfq',
    )
    return _shape(df, date_col='日期', value_col='收盘')


def fetch_spot(node_id: str, start: dt.date) -> pd.DataFrame:
    """99qh / 生意社 daily spot price.

    Returns an empty frame when the node has no mapping or when the upstream
    endpoint errors (the 99qh JSON shape varies by product and several
    silicon-chain symbols currently break ``ak.spot_price_qh``).
    """
    key = SPOT_AKSHARE_KEYS.get(node_id)
    if key is None:
        log.info('no spot endpoint mapped for node %s', node_id)
        return _empty_frame()
    try:
        df = ak.spot_price_qh(symbol=key)
    except Exception as e:  # noqa: BLE001 -- akshare raises plain Exceptions
        log.warning('spot_price_qh failed for %s (%s): %s', node_id, key, e)
        return _empty_frame()
    shaped = _shape(df, date_col='日期', value_col='现货价格')
    # Filter to start date (99qh returns full history).
    if not shaped.empty:
        shaped = shaped[shaped.index >= pd.Timestamp(start)]
    return shaped


# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------

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
        except Exception as e:  # noqa: BLE001
            log.exception('fetch failed for %s: %s', node['id'], e)
            out[node['id']] = _empty_frame()
    return out
