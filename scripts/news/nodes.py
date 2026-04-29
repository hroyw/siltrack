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
    """Map a gfex announcement title to silicon node IDs.

    Logic:
      - Title mentions 工业硅/SI → ['SI']
      - Title mentions 多晶硅/PS → ['PS']
      - Title mentions both → ['SI', 'PS']
      - Title mentions a non-silicon GFEX product (铂/钯/碳酸锂) → [] (filtered out)
      - Title mentions neither → ['SI', 'PS'] (exchange-wide rule, e.g. 风险控制 / 假期安排)
    """
    has_si = '工业硅' in title or 'SI' in title
    has_ps = '多晶硅' in title or 'PS' in title
    if has_si and has_ps:
        return ['SI', 'PS']
    if has_si:
        return ['SI']
    if has_ps:
        return ['PS']
    # No silicon mention. Filter out announcements specific to other GFEX products.
    other_products = ('铂', '钯', '碳酸锂')
    if any(p in title for p in other_products):
        return []
    # Truly exchange-wide (e.g. 风险控制管理办法 / 节假日安排) — applies to silicon too.
    return ['SI', 'PS']


def infer_for_customs() -> list[str]:
    return ['PS', 'polysilicon-dense']
