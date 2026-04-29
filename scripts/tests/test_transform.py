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
