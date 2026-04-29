import pytest

from scripts.news.classify import classify


@pytest.mark.parametrize('title, expected', [
    # production_halt
    ('合盛硅业：关于鄯善基地工业硅装置临时检修的公告', 'production_halt'),
    ('某某公司因故障停产 5 日', 'production_halt'),
    # production_start
    ('大全能源：年产 10 万吨高纯多晶硅项目投产公告', 'production_start'),
    ('某基地正式点火复产', 'production_start'),
    # capacity_change
    ('合盛硅业新疆项目扩产 30 万吨', 'capacity_change'),
    ('行业新建产能 50 万吨', 'capacity_change'),
    # order_contract
    ('某公司与某客户签订 5 年长协采购合同', 'order_contract'),
    ('中标 2 GW 光伏组件大单', 'order_contract'),
    # financial_report
    ('通威股份：2025 年年度业绩预告', 'financial_report'),
    ('XX公司发布 2025 三季报', 'financial_report'),
    # delivery (priority over inventory)
    ('SI2510 注册仓单变化日报', 'delivery'),
    # inventory
    ('SI 库存周报：本周累库 5%', 'inventory'),
    # policy
    ('美国对华光伏组件反倾销调查初步裁定', 'policy'),
    ('欧盟 CBAM 实施细则公告', 'policy'),
    # import_export
    ('中国 3 月份多晶硅进口量同比增长 20%', 'import_export'),
    # other (negatives)
    ('普通公司日常公告', 'other'),
    ('SI 主力合约持仓量', 'other'),
])
def test_classify(title: str, expected: str) -> None:
    assert classify(title) == expected


def test_classify_uses_excerpt_when_title_is_neutral() -> None:
    assert classify(title='公司公告', excerpt='本公司于近日点火复产') == 'production_start'


def test_classify_first_match_wins() -> None:
    # 'policy' fires before 'inventory' even when both keywords present.
    assert classify('政策调整：库存数据报送规则') == 'policy'
