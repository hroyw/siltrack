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
