"""Regression tests for fetch.py.

Real API calls are not exercised here — we verify the parsing/shape
contract using a recorded CSV fixture captured via the procedure
documented in plan Task 7 step 2.
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
