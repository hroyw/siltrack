# siltrack MVP 设计文档

**日期**: 2026-04-29
**状态**: Draft，待用户 review
**作者**: brainstorming session

## 1. 项目目标

`siltrack` 是一个面向**非行业内部人士**的硅产业链可视化看板，帮助用户通过自动获取的真实价格数据，理解工业硅、多晶硅、有机硅、光纤等多条产业链上下游之间的价格联动、股价反应与领先滞后关系。

不是交易工具，是**学习与观察工具**。

### 1.1 核心用例

> 用户打开网站，看到一张产业链结构图（卡片形式），点击其中任意一个节点（例如"多晶硅致密料"），下方图表自动绘制：
> - 该节点的历史价格
> - 它的**上游一个节点**（例如工业硅期货）
> - 与它相关性最高的**一只 A 股股票**（例如通威股份）
>
> 三条线归一化叠加，旁边自动生成一段文字解读："多晶硅与工业硅 60 日相关性 0.85（强正相关），工业硅领先约 7 天；关联股票通威股份相关性 0.55"。

### 1.2 非目标（MVP 不做）

- 实时分钟级行情（日线足够）
- 用户登录、关注列表、个性化
- 告警 / 推送
- 实时拖动滑块改相关性窗口（窗口固定 30/60 日）
- E2E 测试
- 移动端原生应用（响应式 web 即可）
- 交易 / 下单功能

## 2. 数据范围

### 2.1 追踪 22 个序列，分布在 3 条产业链

#### 分支 1 · 光伏链
| 类型 | 标识 | 名称 | 数据源 |
|---|---|---|---|
| 期货 | `SI` | 工业硅期货主力 | 广期所 / akshare |
| 期货 | `PS` | 多晶硅期货主力 | 广期所 / akshare |
| 现货 | `polysilicon-dense` | 多晶硅致密料 | 生意社 / akshare |
| 现货 | `wafer-m10` | 单晶硅片 M10 | akshare 聚合 |
| 现货 | `cell-topcon` | TOPCon 电池片 | akshare 聚合 |
| 现货 | `module` | 光伏组件均价 | akshare 聚合 |
| 股票 | `600438` | 通威股份 | akshare A 股日线 |
| 股票 | `688303` | 大全能源 | akshare A 股日线 |
| 股票 | `002129` | TCL 中环 | akshare A 股日线 |
| 股票 | `601012` | 隆基绿能 | akshare A 股日线 |

#### 分支 2 · 有机硅链
| 类型 | 标识 | 名称 | 数据源 |
|---|---|---|---|
| 现货 | `dmc` | DMC（二甲基硅氧烷混合环体） | akshare |
| 现货 | `silicone-107` | 107 硅橡胶（同时作为硅酮胶代理指标） | akshare |
| 现货 | `silicone-oil` | 硅油 | akshare |
| 现货 | `fumed-silica` | 气相白炭黑 | akshare |
| 股票 | `603260` | 合盛硅业（工业硅 + 有机硅双龙头） | akshare |
| 股票 | `600596` | 新安股份 | akshare |
| 股票 | `300821` | 东岳硅材 | akshare |
| 股票 | `603938` | 三孚股份 | akshare |

#### 分支 3 · 光纤链（实验性）
| 类型 | 标识 | 名称 | 数据源 |
|---|---|---|---|
| 现货 | `quartz-sand` | 高纯石英砂 | akshare（覆盖弱） |
| 现货 | `optical-preform` | 光纤预制棒 | akshare（覆盖弱） |
| 现货 | `optical-fiber` | 光纤光缆 | akshare（覆盖弱） |
| 股票 | `601869` | 长飞光纤 | akshare |
| 股票 | `600487` | 亨通光电 | akshare |
| 股票 | `600522` | 中天科技 | akshare |

> 分支 3 数据若 akshare 抓不到，前端节点显示"暂无数据"灰态，不阻塞 MVP 上线。

### 2.2 数据约定

- **历史深度**：拉取最近 3 年（akshare 提供多少拉多少，至少回溯到 2023 年起）
- **频率**：脚本每天跑，但底层数据有的日更（期货/股票/生意社）、有的周更（多晶硅、硅业分会报告）。统一存日线，缺失日期前向填充（forward fill）
- **货币与单位**：均为人民币，期货按 ¥/吨，股价 ¥/股，原始值存储；图表叠加时按 **首日 = 100 归一化**
- **时区**：UTC，但显示按 Asia/Shanghai
- **更新窗口**：每日 UTC 23:00（北京时间次日 07:00）GitHub Actions 自动跑

### 2.3 产业链关系（硬编码）

每个节点声明 `upstream`（一个）和 `relatedStocks`（多个）。例如：

```ts
{
  id: 'polysilicon-dense',
  upstream: 'SI',           // 单一上游
  relatedStocks: ['688303', '600438', '603260'],
}
```

**"最相关股票"**通过预算的 60 日 Pearson 相关系数从 `relatedStocks` 中选出最高的那一只。

## 3. 架构

### 3.1 目录结构

```
siltrack/
├── data/
│   └── all.json                    # GitHub Actions 写入，前端读取
│
├── scripts/                        # Python 数据层
│   ├── fetch.py                    # akshare 拉所有序列
│   ├── transform.py                # 清洗、对齐日期
│   ├── correlate.py                # 预算 60d/30d 滚动相关性
│   ├── build.py                    # 编排：fetch → transform → correlate → 写 all.json
│   ├── chain_config.py             # 产业链定义（节点、上游、相关股）
│   ├── requirements.txt
│   └── tests/
│       └── test_correlate.py
│
├── src/
│   ├── components/
│   │   ├── ChainOverview.tsx       # 三个分支区段的容器
│   │   ├── BranchSection.tsx       # 单条分支
│   │   ├── ChainCard.tsx           # 单个产业链节点卡片（22 个实例之一）
│   │   ├── TimelineChart.tsx       # ECharts 多线图
│   │   ├── InsightPanel.tsx        # 自动解读文字
│   │   ├── TimeRangePicker.tsx     # 1M/3M/6M/1Y/3Y/全部
│   │   └── EmptyDataBadge.tsx      # 灰显占位（光纤分支用）
│   ├── hooks/
│   │   ├── useAllData.ts           # 一次 fetch all.json
│   │   └── useSelection.ts         # 当前选中节点 + 关联序列计算
│   ├── lib/
│   │   ├── analytics.ts            # normalizeFromBase, formatChange, …
│   │   ├── chain.ts                # 产业链元数据（前端镜像）
│   │   └── insight.ts              # 由数据生成解读文字
│   ├── types.ts                    # SeriesId, DataPoint, AllData, ChainNode...
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css                   # Tailwind 入口
│
├── tests/
│   └── analytics.test.ts
│
├── .github/workflows/
│   ├── update-data.yml             # 每日 23:00 UTC，跑 build.py，commit data/
│   └── deploy.yml                  # push to main → build site → deploy Pages
│
├── public/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── package.json
├── README.md                       # 中文
└── LICENSE
```

### 3.2 数据流

```
GitHub Actions cron (每日 23:00 UTC)
    │
    ▼
python scripts/build.py
    │  ├─ fetch.py  → akshare → 原始 22 个序列
    │  ├─ transform.py  → 对齐日期 + ffill + 归一化前的清洗
    │  └─ correlate.py  → 预算每对节点 60d / 30d 相关性
    ▼
data/all.json  (~1-3 MB)
    │
    ▼
git commit + push to main
    │
    ▼
GitHub Actions deploy.yml → vite build → gh-pages
    │
    ▼
浏览器：fetch /data/all.json → React + ECharts 渲染
```

### 3.3 `data/all.json` 形态

```jsonc
{
  "generatedAt": "2026-04-29T23:00:00Z",
  "series": [
    {
      "id": "SI",
      "name": "工业硅期货主力",
      "branch": "photovoltaic",
      "type": "futures",
      "unit": "¥/吨",
      "upstream": null,
      "relatedStocks": ["603260"],
      "points": [
        { "date": "2023-04-29", "value": 14200 },
        { "date": "2023-05-02", "value": 14150 }
      ]
    }
  ],
  "correlations": {
    "60d": {
      "polysilicon-dense": {
        "SI": 0.85,
        "603260": 0.72,
        "688303": 0.78
      }
    },
    "30d": { /* same shape */ }
  }
}
```

### 3.4 关键模块职责

| 模块 | 职责 | 公开接口（伪签名） |
|---|---|---|
| `scripts/fetch.py` | 调 akshare，纯抓取，按序列输出原始 dataframe | `fetch_all() -> dict[str, DataFrame]` |
| `scripts/transform.py` | 对齐日期索引，前向填充，丢弃异常 | `align(raw) -> DataFrame` |
| `scripts/correlate.py` | 滚动相关性，对每个节点的 `relatedStocks` 和 `upstream` 计算 60/30 日相关 | `compute(aligned) -> dict` |
| `scripts/chain_config.py` | 唯一的产业链定义来源（Python 端） | `CHAIN_NODES: list[dict]` |
| `src/lib/chain.ts` | 前端镜像（生成自 `chain_config.py`，或手动同步） | `CHAIN_NODES: ChainNode[]` |
| `src/lib/analytics.ts` | 纯函数：归一化、涨跌幅、日期切片 | `normalizeFromBase`, `sliceByRange` |
| `src/lib/insight.ts` | 数据 → 文字模板生成解读 | `generateInsight(node, data) -> string` |
| `src/hooks/useAllData.ts` | fetch + cache `all.json` | `useAllData() -> { data, loading, error }` |
| `src/hooks/useSelection.ts` | 给定选中节点，导出"主线 + 上游线 + 最相关股票线"三组数据 | `useSelection(nodeId) -> { primary, upstream, topStock }` |
| `src/components/TimelineChart.tsx` | ECharts 渲染三线 + 标注 | `<TimelineChart series={[...]} range="1Y" />` |
| `src/components/InsightPanel.tsx` | 显示 `insight.ts` 生成的文字 | `<InsightPanel nodeId="..." />` |

### 3.5 状态管理

只用 React useState + 一个轻量 Context：

- `DataContext` — 提供 `all.json`，全局只 fetch 一次
- `SelectionContext` — 当前选中节点 + 时间范围

不引入 Redux / Zustand 等。

## 4. UI 与交互

### 4.1 单页布局

```
┌─────────────────────────────────────────────────────────┐
│  siltrack · 硅产业链看板          [1M 3M 6M 1Y 3Y 全部] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ▎ 光伏链                                               │
│  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐        │
│  │工业硅│→│多晶硅│→│多晶硅│→│硅片 │→│电池 │→│组件 │       │
│  │期货 │  │期货 │  │致密料│  │ M10│  │TOPCon│ │     │      │
│  └────┘  └────┘  └────┘  └────┘  └────┘  └────┘        │
│  相关股票: 通威 大全 TCL中环 隆基                        │
│                                                         │
│  ▎ 有机硅链                                             │
│  …                                                      │
│  ▎ 光纤链                                               │
│  …                                                      │
├─────────────────────────────────────────────────────────┤
│  [TimelineChart - ECharts]                              │
│  ━━━ 多晶硅致密料   ┄┄┄ 工业硅期货   ─── 通威股份         │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  💡 多晶硅与工业硅 60日相关性 0.85（强正相关），         │
│     工业硅领先约 7 天 · 关联股票通威 相关性 0.55          │
└─────────────────────────────────────────────────────────┘
```

### 4.2 默认状态

- 首次打开：默认选中 **工业硅期货** (`SI`)，因为它是产业链起点
- 时间范围：默认 **1Y**

### 4.3 卡片样态

- 普通：白色背景，淡边框，显示名称 + 当前价 + 当日涨跌（彩色）
- 鼠标悬停：边框高亮蓝色
- 已选中：蓝色填充背景 + 蓝色边框 + 白字
- 上游 / 关联股票（联动出图的）：绿色标记
- 数据缺失（光纤分支可能）：灰显，文字"暂无数据"

### 4.4 时间范围切换

切换时三条线全部按新范围重切。归一化基准点 = 范围内首日。

## 5. 错误处理

| 场景 | 处理 |
|---|---|
| `all.json` 加载失败（网络/404） | 全屏错误提示 + 重试按钮 |
| `all.json` 中某序列字段缺失 | 该卡片显示"暂无数据"灰态，其他正常工作 |
| 某序列点击但没有 `upstream`（如起点节点） | 不显示上游线，仅画主线 + 最相关股票 |
| 某序列没有 `relatedStocks`（极少见） | 不显示股票线，仅画主线 + 上游 |
| 数据脚本某个 akshare 调用失败 | 该序列保留上次成功的数据；CI 任务整体不失败（除非全部失败） |

## 6. 测试策略

### 6.1 Python（pytest）
- `test_correlate.py` — 滚动相关性算法单测，含已知输入输出
- `test_transform.py` — 日期对齐、前向填充
- 不测 fetch（真实 API 调用，留给 CI 整体跑）

### 6.2 前端（Vitest）
- `analytics.test.ts` — 归一化、日期切片纯函数
- `insight.test.ts` — 文字模板生成
- 关键组件 1-2 个 snapshot：`ChainCard`、`InsightPanel`

### 6.3 不做
- E2E（Playwright 等）—— MVP 不需要
- 跨浏览器测试 —— 只保证现代 Chrome/Safari

## 7. 自动化 / CI

### 7.1 `.github/workflows/update-data.yml`
- Cron: `0 23 * * *`（每日 UTC 23:00）
- 也可手动 trigger
- 步骤：
  1. checkout
  2. setup Python 3.11
  3. `pip install -r scripts/requirements.txt`
  4. `python scripts/build.py`
  5. 如果 `data/all.json` 有变化，commit & push（用 `actions-user`）

### 7.2 `.github/workflows/deploy.yml`
- 触发：push 到 main
- 步骤：
  1. checkout
  2. setup Node 20
  3. `npm ci && npm run build`
  4. 部署 `dist/` 到 `gh-pages` 分支
  5. 启用 Pages（首次手动）

## 8. 部署 / 运维

- **域名**：默认 `https://<user>.github.io/siltrack/`
- **Pages 设置**：`gh-pages` 分支根目录
- **失败告警**：GitHub Actions 失败时 GitHub 自动邮件通知（无需额外配置）
- **数据修复**：手动触发 `update-data.yml` 即可重抓

## 9. 开发里程碑

| 阶段 | 内容 | 预估 |
|---|---|---|
| M0 | 仓库初始化、Vite + React + TS + Tailwind + ECharts 脚手架、空白 App | 0.5 天 |
| M1 | Python 数据脚本：能本地跑出 `all.json`（先用 5 个核心序列） | 1 天 |
| M2 | 前端：读 `all.json`，画 `ChainCard` × 22，静态布局 | 1 天 |
| M3 | TimelineChart 接通，点击卡片联动出图 | 1 天 |
| M4 | InsightPanel + 时间范围切换 | 0.5 天 |
| M5 | 扩展数据脚本到全部 22 个序列 + 滚动相关性 | 0.5 天 |
| M6 | GitHub Actions：update-data + deploy 跑通 | 0.5 天 |
| M7 | 测试 + README + 上线 | 0.5 天 |

**总计 ~5.5 个工作日**。可并行（数据脚本和前端骨架同时做）。

## 10. 风险与 Open Questions

| 风险 | 缓解 |
|---|---|
| akshare 部分接口稳定性差 | 容错：失败的序列保留上次数据，不阻塞其他序列 |
| 光纤数据可能完全拿不到 | 已设计灰显态，分支 3 标"实验性" |
| GitHub Actions cron 不保证准时 | 接受最多几小时延迟；用户对 MVP 不敏感 |
| `data/all.json` 体积超过 5MB | 切换为按分支拆分（优化项，先不做） |
| akshare 在国外 GitHub Actions 上调中国 API 偶发超时 | 重试 3 次；记录失败序列 |

### Open Questions（设计文档里保留，实施时解决）

- ECharts 按需引入哪些模块？（在 M3 决定，目标压到 ~250KB）
- `chain_config.py` 和 `src/lib/chain.ts` 如何保证同步？（候选：CI 里跑一个校验脚本）
- README 是否包含截图？（M7 截图后补充）

---

**完成此设计文档后的下一步**：调用 `superpowers:writing-plans` 转化为实现计划。
