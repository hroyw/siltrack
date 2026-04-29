# M2 — 官方新闻聚合（Official News Aggregator）

**Status**: draft, awaiting review
**Date**: 2026-04-29
**Depends on**: siltrack MVP（已上线）
**Blocks**: M3（LLM 标注）、M4（预警引擎）

## 1. 目标

为非业内用户的硅产业链看板补一条**事件信号**通道：把官方/权威来源里跟硅相关的公告汇聚成结构化事件流，与现有价格图表联动展示。

不在 v1 范围：
- LLM 标注（留给 M3）
- 自媒体/公众号文章（已有 `/import` 路径，本期不动）
- 预警/预测引擎（M4）

## 2. 三个数据源

| 来源 | 抓什么 | 实现方式 | 时效 |
|---|---|---|---|
| 巨潮资讯（cninfo） | 现有 11 只硅相关 A 股的公司公告 | akshare `stock_notice_report` + 代码过滤 | T+0 |
| 广期所（gfex） | SI/PS 仓单、交割、风控、保证金、涨跌停板公告 | 自写 `requests + BeautifulSoup` 爬 `gfex.com.cn/gfex/zxgg/` | T+0 |
| 海关总署（customs） | 多晶硅 HS 28046190 月度进出口 | **手工录入 CSV**（`data/customs_manual.csv`），customs.py 仅做 CSV → Event 转换 | 月度，滞后 30–45 天 |

**关于海关走手填的理由**：海关总署官网反爬强、字段不稳，月度数据填一次 30 秒，自动化 ROI 不划算。后续若发现稳定接口（如付费 API 或第三方稳定源），再把 customs.py 升级成自动抓，schema 不变。

## 3. 数据契约

### 3.1 文件位置

`data/events.json`，独立于 `all.json`，由 build.py 在每日 GitHub Actions job 中产出。理由：events 累积增长（保留 2 年），与每日重写的价格快照分离，避免膨胀价格文件、便于 CDN 缓存策略不同。

### 3.2 Schema

```json
{
  "generated_at": "2026-04-29T23:00:00Z",
  "sources": {
    "cninfo":  { "ok": true,  "last_success_at": "2026-04-29T23:00:00Z", "stale_days": 0 },
    "gfex":    { "ok": true,  "last_success_at": "2026-04-29T23:00:00Z", "stale_days": 0 },
    "customs": { "ok": true,  "last_success_at": "2026-04-15T00:00:00Z", "stale_days": 14,
                 "lag_note": "海关数据为月度发布，最新月份通常滞后 30-45 天" }
  },
  "events": [
    {
      "id": "cninfo-603260-20260428-a1b2",
      "date": "2026-04-28",
      "source": "cninfo",
      "source_label": "巨潮资讯",
      "title": "合盛硅业：关于鄯善基地工业硅装置临时检修的公告",
      "url": "http://...",
      "event_type": "production_halt",
      "related_nodes": ["603260", "SI"],
      "summary": null,
      "raw_text_excerpt": "前 200 字..."
    }
  ]
}
```

字段约束：
- `id` 全局唯一，格式 `{source}-{key}-{YYYYMMDD}-{hash4}`，重跑保证幂等
- `date` 是事件**业务日期**（公告日期 / 海关数据所属月最后一日 / 仓单生效日），不是抓取日期
- `event_type` 取下面 §4.1 的枚举之一
- `related_nodes` 至少 1 个 chain_config node id；空数组的事件直接丢弃
- `summary` 在 v1 始终为 `null`，给 M3 占位
- 当某来源失败：`sources.{name} = {ok:false, error:"...", last_success_at: 上次的, stale_days: 自动算}`，已抓到的 events 数组保留

### 3.3 事件容量

events 数组保留**最近 730 天**（约 2 年），超过的从 build 时丢弃。预估稳态规模：每日 ~20 条，2 年 ≈ 1.5 万条，JSON 体积 ~5MB（gzip 后 ~1MB），可接受。

## 4. 事件分类（v1 规则版）

### 4.1 event_type 枚举

```
policy            政策/反倾销/关税/补贴/CBAM/部委通知
delivery          期货交割/注册仓单/标准仓单
inventory         仓单变化/库存数据
production_halt   停产/检修/限产/故障/事故
production_start  复产/投产/满产/点火
capacity_change   扩产/扩能/新建/退出
order_contract    长协/中标/采购合同
financial_report  季报/年报/业绩预告/业绩快报
import_export     进口/出口/海关数据
other             兜底
```

### 4.2 分类规则

`scripts/news/classify.py`，**优先级顺序匹配，命中即停**（顺序见 §4.1，从上到下）。

每条规则覆盖一组中文关键词，匹配 `title + raw_text_excerpt` 拼接后的字符串。所有规则集中在一个 dict 里，便于 M3 切 LLM 时把这套作为 baseline eval set 复用。

### 4.3 related_nodes 推断

- **cninfo**：根据公告对应的 stock_code，从 `chain_config.CHAIN_NODES` 反查所有 `related_stocks` 包含该 code 的节点；加上 stock_code 自身。
- **gfex**：默认 `["SI", "PS"]`。若标题含合约关键词（"工业硅"、"SI"、"多晶硅"、"PS"），收窄到对应一个。
- **customs**：默认 `["PS", "polysilicon-dense"]`。

## 5. 模块布局

```
scripts/
├── news/
│   ├── __init__.py
│   ├── cninfo.py            # def fetch_events(since: date) -> list[Event]
│   ├── gfex.py              # def fetch_events(since: date) -> list[Event]
│   ├── customs.py           # def fetch_events() -> list[Event]   (no since: 全量从 CSV)
│   ├── classify.py          # def classify(title, excerpt) -> event_type
│   ├── nodes.py             # def infer_related_nodes(source, payload) -> list[str]
│   ├── types.py             # Event TypedDict, SourceStatus TypedDict
│   └── tests/
│       ├── conftest.py
│       ├── fixtures/        # 静态 HTML / akshare mock / 海关 CSV 样本
│       ├── test_cninfo.py
│       ├── test_gfex.py
│       ├── test_customs.py
│       └── test_classify.py
└── build.py                 # 现有，新增调用 news pipeline → data/events.json

data/
├── all.json                 # 现有
├── events.json              # 新增，CI 写入
└── customs_manual.csv       # 新增，手工维护
```

`scripts/news/__init__.py` 导出 `run_news_pipeline(since: date) -> dict`，返回 `events.json` 的完整结构；build.py 调用一次，把结果 dump 到 `data/events.json`。

`customs_manual.csv` 列：`year_month, hs_code, direction, country, quantity_tons, value_usd, note`。提交进 git，每月手工 append。

## 6. 前端

### 6.1 新组件 EventTimeline

文件：`src/components/EventTimeline.tsx`

放置：`InsightPanel` 下方。

行为：
- 跟随 `selectedNodeId` 过滤：显示 `event.related_nodes.includes(selectedNodeId)` 的事件
- 时间倒序，默认显示最近 30 条，"加载更多"按钮一次扩 30 条
- 每条卡片：日期 / 来源徽章 / event_type 图标（emoji 或 lucide icon）/ 标题（外链）
- 来源徽章颜色规则：`cninfo` 蓝、`gfex` 紫、`customs` 橙

### 6.2 顶部 SourceHealth 条

EventTimeline 顶部一行，3 个来源徽章按 `stale_days` 染色：
- `≤1` 绿
- `≤7` 黄
- `>7` 红

点击徽章弹 modal：显示 `last_success_at`、`stale_days`、`lag_note`（如果有）、`error`（如果有）。

### 6.3 TimelineChart 联动

`src/components/TimelineChart.tsx` 增强：
- 给 ECharts series 加 `markPoint`，事件日期上画小圆点（按 event_type 用不同 icon）
- 点击 markPoint → 滚到 EventTimeline 对应卡片 + 高亮 2 秒
- 鼠标 hover → tooltip 显示标题摘要

### 6.4 数据加载

`src/api/events.ts`：
- 新 hook `useEvents()` fetch `/data/events.json`，沿用 `src/hooks/useAllData.ts` 的 `useEffect + fetch + useState` 模式（不引入 React Query）
- 与 `useAllData()` 并行加载（两个 hook 各自独立），错误隔离：events 失败不阻塞 chart 渲染

## 7. 错误处理 / 降级

- **scraper 级**：每个 scraper 内部 try/except，失败时返回空 events + 在 source status 标 `ok:false, error:"..."`，不抛到 build.py
- **pipeline 级**：build.py 永远写 `data/events.json`（即使所有 scraper 全挂，至少 sources 状态是真的）
- **CI 级**：GitHub Actions 在 3 个 scraper 全部失败时才让 job 失败；任何一个或两个挂不影响每日刷新流程
- **前端级**：`events.json` fetch 失败 → EventTimeline 显示"事件流暂时不可用"，chart 正常

## 8. 测试策略

### 8.1 Python（scripts/news/tests/）

- `test_cninfo.py`：mock `ak.stock_notice_report`，校验股票过滤 + id 生成 + related_nodes 推断
- `test_gfex.py`：用 fixture 静态 HTML（保留 3 个真实公告样本），校验解析 + 增量去重 + 失败回退
- `test_customs.py`：CSV fixture → events 列表，校验 related_nodes 默认值、date 取月末
- `test_classify.py`：每个 event_type 至少 2 个真实标题正例 + 1 反例；总计 ~30 个 case
- 集成测试：`test_pipeline.py` 串起 3 个 scraper（全 mock），断言 events.json 结构

### 8.2 前端（src/components/__tests__/）

- `EventTimeline.test.tsx`：mock events.json，校验过滤 + 排序 + 加载更多 + 来源徽章染色
- `SourceHealth.test.tsx`：stale_days 三档染色 + modal 打开

## 9. 数据刷新

复用现有 `.github/workflows/update-data.yml`：
- `scripts/build.py` 默认行为同时刷新 `all.json` 和 `events.json`（news pipeline 集成进主 build，不加单独 flag，保持调用面简单）
- 两个文件同次 commit
- 频率不变：每日 UTC 23:00（北京次日 07:00）

## 10. README 必须新增的限制说明

- 海关数据为手工录入 CSV，月度滞后 30–45 天
- 关键词分类规则版，长尾事件可能误分类（计划 M3 上 LLM 修正）
- 广期所爬虫依赖 HTML 结构，可能因网站改版失效；通过 `stale_days` 颜色提示用户

## 11. 验收标准（Definition of Done）

- [ ] `data/events.json` 在 GitHub Actions 每日 job 中正常产出
- [ ] 三个来源任一独立失败不阻塞其他来源和 `all.json` 写入
- [ ] 选中任一 chain_node，EventTimeline 能正确过滤显示相关事件
- [ ] `stale_days` 三档染色正确
- [ ] 海关 lag_note 在徽章 modal 中显示
- [ ] chart markPoint 点击跳转 + 高亮 EventTimeline 对应卡片
- [ ] 所有 scraper / classify / 前端组件单元测试通过
- [ ] README 已加入 §10 列出的限制说明
- [ ] `data/customs_manual.csv` 已创建并 commit 至少一条样本数据

## 12. 后续阶段对接

- **M3**：LLM 标注 — 替换 classify.py 为 LLM 调用，把 §8.1 的 test_classify 数据集作为 eval set；填充 events[].summary
- **M4**：预警引擎 — 监听 events 流 + 价格序列，检测领先指标背离；事件类型已结构化，可直接做规则匹配
