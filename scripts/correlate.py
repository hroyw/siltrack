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
