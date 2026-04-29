"""Keyword-rule event classifier.

Priority order: first matching rule wins. Designed so the rules can later
be replaced by an LLM (M3) with this dataset as eval baseline.
"""
from __future__ import annotations

from .types import EventType

RULES: list[tuple[EventType, list[str]]] = [
    ('policy',           ['反倾销', '关税', '补贴', 'CBAM', '政策', '国务院', '发改委', '工信部']),
    ('delivery',         ['交割', '注册仓单', '标准仓单']),
    ('inventory',        ['仓单', '库存']),
    ('production_halt',  ['停产', '检修', '限产', '停车', '故障', '事故']),
    ('production_start', ['复产', '投产', '满产', '点火']),
    ('capacity_change',  ['扩产', '扩能', '新建', '新增产能', '退出']),
    ('order_contract',   ['长协', '中标', '签订', '采购合同']),
    ('financial_report', ['季报', '年报', '业绩预告', '业绩快报']),
    ('import_export',    ['进口', '出口', '海关']),
]


def classify(title: str, excerpt: str = '') -> EventType:
    text = f'{title} {excerpt}'
    for event_type, keywords in RULES:
        for kw in keywords:
            if kw in text:
                return event_type
    return 'other'
