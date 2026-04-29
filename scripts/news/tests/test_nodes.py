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
