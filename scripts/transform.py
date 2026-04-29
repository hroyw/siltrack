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
