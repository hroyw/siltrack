"""Single source of truth for the silicon industry chain.

Each node has:
- id: stable identifier used in data/all.json and frontend
- name: human-readable Chinese name
- branch: 'photovoltaic' | 'organosilicon' | 'fiber'
- type: 'futures' | 'spot' | 'stock'
- unit: display unit
- upstream: id of the immediate upstream node, or None for chain origins
- related_stocks: list of stock ids likely correlated (used to pick "top stock")
- akshare: a callable spec describing how to fetch this series; see fetch.py
"""

from typing import TypedDict, Literal, Optional


class ChainNode(TypedDict):
    id: str
    name: str
    branch: Literal['photovoltaic', 'organosilicon', 'fiber']
    type: Literal['futures', 'spot', 'stock']
    unit: str
    upstream: Optional[str]
    related_stocks: list[str]


CHAIN_NODES: list[ChainNode] = [
    # --- photovoltaic ---
    {'id': 'SI', 'name': '工业硅期货主力', 'branch': 'photovoltaic', 'type': 'futures', 'unit': '¥/吨',
     'upstream': None, 'related_stocks': ['603260']},
    {'id': 'PS', 'name': '多晶硅期货主力', 'branch': 'photovoltaic', 'type': 'futures', 'unit': '¥/吨',
     'upstream': 'SI', 'related_stocks': ['688303', '600438']},
    {'id': 'polysilicon-dense', 'name': '多晶硅致密料', 'branch': 'photovoltaic', 'type': 'spot', 'unit': '¥/吨',
     'upstream': 'PS', 'related_stocks': ['688303', '600438', '603260']},
    {'id': 'wafer-m10', 'name': '单晶硅片 M10', 'branch': 'photovoltaic', 'type': 'spot', 'unit': '¥/片',
     'upstream': 'polysilicon-dense', 'related_stocks': ['002129', '601012']},
    {'id': 'cell-topcon', 'name': 'TOPCon 电池片', 'branch': 'photovoltaic', 'type': 'spot', 'unit': '¥/W',
     'upstream': 'wafer-m10', 'related_stocks': ['600438', '601012']},
    {'id': 'module', 'name': '光伏组件均价', 'branch': 'photovoltaic', 'type': 'spot', 'unit': '¥/W',
     'upstream': 'cell-topcon', 'related_stocks': ['601012']},
    {'id': '600438', 'name': '通威股份', 'branch': 'photovoltaic', 'type': 'stock', 'unit': '¥/股',
     'upstream': None, 'related_stocks': []},
    {'id': '688303', 'name': '大全能源', 'branch': 'photovoltaic', 'type': 'stock', 'unit': '¥/股',
     'upstream': None, 'related_stocks': []},
    {'id': '002129', 'name': 'TCL 中环', 'branch': 'photovoltaic', 'type': 'stock', 'unit': '¥/股',
     'upstream': None, 'related_stocks': []},
    {'id': '601012', 'name': '隆基绿能', 'branch': 'photovoltaic', 'type': 'stock', 'unit': '¥/股',
     'upstream': None, 'related_stocks': []},
    # --- organosilicon ---
    {'id': 'dmc', 'name': 'DMC（二甲基硅氧烷混合环体）', 'branch': 'organosilicon', 'type': 'spot', 'unit': '¥/吨',
     'upstream': 'SI', 'related_stocks': ['603260', '600596', '300821']},
    {'id': 'silicone-107', 'name': '107 硅橡胶', 'branch': 'organosilicon', 'type': 'spot', 'unit': '¥/吨',
     'upstream': 'dmc', 'related_stocks': ['603260', '300821']},
    {'id': 'silicone-oil', 'name': '硅油', 'branch': 'organosilicon', 'type': 'spot', 'unit': '¥/吨',
     'upstream': 'dmc', 'related_stocks': ['600596', '603938']},
    {'id': 'fumed-silica', 'name': '气相白炭黑', 'branch': 'organosilicon', 'type': 'spot', 'unit': '¥/吨',
     'upstream': 'SI', 'related_stocks': ['603938']},
    {'id': '603260', 'name': '合盛硅业', 'branch': 'organosilicon', 'type': 'stock', 'unit': '¥/股',
     'upstream': None, 'related_stocks': []},
    {'id': '600596', 'name': '新安股份', 'branch': 'organosilicon', 'type': 'stock', 'unit': '¥/股',
     'upstream': None, 'related_stocks': []},
    {'id': '300821', 'name': '东岳硅材', 'branch': 'organosilicon', 'type': 'stock', 'unit': '¥/股',
     'upstream': None, 'related_stocks': []},
    {'id': '603938', 'name': '三孚股份', 'branch': 'organosilicon', 'type': 'stock', 'unit': '¥/股',
     'upstream': None, 'related_stocks': []},
    # --- fiber (experimental: data may be partial) ---
    {'id': 'quartz-sand', 'name': '高纯石英砂', 'branch': 'fiber', 'type': 'spot', 'unit': '¥/吨',
     'upstream': None, 'related_stocks': ['601869']},
    {'id': 'optical-preform', 'name': '光纤预制棒', 'branch': 'fiber', 'type': 'spot', 'unit': '¥/吨',
     'upstream': 'quartz-sand', 'related_stocks': ['601869', '600487']},
    {'id': 'optical-fiber', 'name': '光纤光缆', 'branch': 'fiber', 'type': 'spot', 'unit': '¥/芯·公里',
     'upstream': 'optical-preform', 'related_stocks': ['601869', '600487', '600522']},
    {'id': '601869', 'name': '长飞光纤', 'branch': 'fiber', 'type': 'stock', 'unit': '¥/股',
     'upstream': None, 'related_stocks': []},
    {'id': '600487', 'name': '亨通光电', 'branch': 'fiber', 'type': 'stock', 'unit': '¥/股',
     'upstream': None, 'related_stocks': []},
    {'id': '600522', 'name': '中天科技', 'branch': 'fiber', 'type': 'stock', 'unit': '¥/股',
     'upstream': None, 'related_stocks': []},
]


def get_node(node_id: str) -> ChainNode:
    for n in CHAIN_NODES:
        if n['id'] == node_id:
            return n
    raise KeyError(f'unknown chain node: {node_id}')
