# siltrack · 硅产业链看板

面向非业内人士的硅产业链可视化工具。覆盖 24 个数据序列，分布在 3 条产业链：

- **光伏链**：工业硅期货 → 多晶硅 → 硅片 → 电池片 → 组件
- **有机硅链**：工业硅 → DMC → 107 硅橡胶 / 硅油 / 气相白炭黑
- **光纤链**（实验性）：高纯石英砂 → 光纤预制棒 → 光纤光缆

点击产业链上任意节点，下方图表自动叠加该节点 + 上游一节点 + 最相关股票，附文字解读。

## 在线访问

https://hroyw.github.io/siltrack/

## 数据来源

- 期货：广期所（akshare 接入新浪期货）
- 现货：生意社聚合（akshare）
- 股票：A 股日线（akshare）
- 相关性：Python 后端预算 30/60 日 Pearson

数据每日 UTC 23:00（北京时间次日 07:00）由 GitHub Actions 自动刷新。

## 本地开发

依赖：Node 20+、Python 3.11+

```bash
git clone <repo-url> siltrack && cd siltrack

# 拉一份数据
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r scripts/requirements.txt
python scripts/build.py     # 写入 data/all.json

# 跑前端
npm install
npm run dev                  # http://localhost:5173
```

## 测试

```bash
npm test                     # Vitest 前端测试
cd scripts && python -m pytest tests/ -v && cd ..
```

## 项目结构

```
siltrack/
├── data/all.json             # CI 写入，前端读取（gh 不忽略）
├── scripts/                  # Python 数据层（akshare → all.json）
├── src/                      # React + TS 前端
├── .github/workflows/
│   ├── update-data.yml       # 每日数据刷新
│   └── deploy.yml            # main push → Pages 部署
└── docs/superpowers/
    ├── specs/                # 设计文档
    └── plans/                # 实施计划
```

## 已知限制

- **现货数据暂时为空**：akshare 1.18.59 的现货端点（`spot_price_qh`、`futures_spot_sys`）目前对硅类品种均失效——这影响所有 11 个现货节点（多晶硅、硅片、电池片、组件、DMC、107 硅橡胶、硅油、气相白炭黑、高纯石英砂、光纤预制棒、光纤光缆）。前端按"暂无数据"灰显，不阻塞期货 + 股票部分的功能。当 akshare 修复这些端点，或换成生意社官方爬虫 / SMM 付费 API 后，前端零改动可恢复
- 期货 + 股票数据正常：工业硅 / 多晶硅期货 + 11 只 A 股日线（约 725 个交易日）
- 缺口前向填充上限 5 个交易日，超过则保留 NaN
- 不是交易工具，不构成投资建议

## 事件流（M2）

每日跑数据时同步刷新 `data/events.json`，覆盖三个官方来源：

- **巨潮资讯**（cninfo）— 11 只硅产业链 A 股的公司公告，T+0 通过 akshare
- **广期所**（gfex）— SI / PS 仓单、交割、风控、保证金等公告，自爬
- **海关总署**（customs）— 多晶硅 HS 28046190 月度进出口，**手工录入** `data/customs_manual.csv`（月度滞后 30–45 天）

事件类型由关键词规则分到 9 类（policy / delivery / inventory / production_halt / production_start / capacity_change / order_contract / financial_report / import_export / other）。长尾事件可能误分类，规划在后续阶段升级到 LLM 标注。

页面右上角的 SourceHealth 徽章按"距上次成功抓取天数"染色（绿 ≤1d / 黄 ≤7d / 红 >7d），点击查看详情；广期所爬虫依赖 HTML 结构，网站改版会触发 stale 告警。
