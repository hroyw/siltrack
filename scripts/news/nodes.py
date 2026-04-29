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
