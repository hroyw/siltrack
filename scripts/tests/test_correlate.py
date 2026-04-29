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
