# dsh-webpage 路线图（2026-08 起，0.6 → 长期）

上位结论与形态宣言见 [ADR 0008](../adr/0008-contract-over-wrapper.md)。本文只回答三个问题：短期做什么、中期往哪走、什么永远不做。

## 定位（结论）

dsh-webpage 是全端 agentOS 里的**窗口系统与地址空间**，不是 IDE 皮肤，不是商店，不是第二内核。

| 层 | 类比 | 谁拥有 |
| --- | --- | --- |
| DSH / Cordis | 内核 + 包管理 | 官方 |
| 插件市场 | 应用商店 | 社区（ADR 0006） |
| **dsh-webpage** | **mod loader：窗口系统 + 地址空间 + 作者合同** | **本项目** |
| Apps | 程序 / mod | 树外任何人 |

路线取 Fabric 的薄，不取 Forge 的厚：平台输出**纪律**（类型、模板、检查套件），不输出垫在运行时下面的封装层。0.1–0.5 已回答「窗口系统成立吗」——成立：可寻址、崩溃即关窗、旗舰 Usage 跑通且内核零改动。

**北极星指标：别人的程序数。** 代理指标：一个陌生开发者（人或 agent session），只靠公开模板 + 类型 + 检查套件，hello 级 App ≤ 1 小时、带 Host 半边的真 App ≤ 1 天，全程不读内核源码、不踩已知陷阱。

## 短期（0.6）：Agent 第二用户 + 作者一日达

本期问题：**「Agent 能用同一套开始菜单吗？别人能便宜且安全地写 App 吗？」**

已拍板 agent 优先：agent 能快速用底座产出原生 App，我们自己做生态更便宜，外部接受成本也被 agent 摊平。

| 刀 | 内容 | 验收 |
| --- | --- | --- |
| Agent 地址空间 | 第一刀是 `open_app` tool + 建议卡：Webpage 现有 Host 行注册 `ctx.tools` 的 `open_app`（`inject: ['tools']`），`execute` 只校验并返回 `{ appId, path }`；client 用 `conversationEvents` 把 `tool/result` fold 成惰性建议卡，人点击才 `ctx.pages.open()`（回放安全、不夺屏）。`list_apps` 活目录等 client→Host 镜像（第二刀）；先用 runtime skill 讲地址空间约定。禁改上游：不加自定义 session 事件（持久化拒日志）、不动 `remote-event` 闭集名单、不走 MCP。依据：[agent-tool-surface-rc6.md](../research/agent-tool-surface-rc6.md) | 真实会话里 agent 调 `open_app` → 对话出现 Usage 建议卡 → 点击打开 panel、对话不丢；刷新回放不自动开窗；不新增第二路由、不暴露安装面 |
| 一致性套件抽取 | 从三份 `scripts/check.mjs` 提炼共享检查器（三次法则已满足），sibling 仓库只留配置 | 三个 App 仓库跑同一套件全绿 |
| 官方模板指定 | 新开公开模板仓 `dsh-app-template`（`examples/reference-app` 保持验收夹具身份；模板取其 client 骨架 + usage 的 Host 惯用法），黑话内嵌为注释（lazy body、soft-get、`ctx.inject(['webServer'])`、INSERT-only patch、`codeSplitting: false`）。依据：[conformance-kit-extraction.md](../research/conformance-kit-extraction.md) 模板节 | 陌生 agent session 只喂公开文档，独立产出过套件的 App |
| 合同版本化 | `docs/guides/app-authoring.md` 顶部标合同版本；rc 升级 = 合同版本 +1 + 套件更新 | 版本号与检查套件同步发布 |
| boot 零砖回归 | render 崩、`apply()` 抛、patch 写错三种姿势下 `dsh web` 必须能起 | crash-app 现有回归 + 套件 patch 卫生检查常驻 |

**短期愿望：第一个不是我们写的 App。** 前置条件是分发——npm / awesome / Discussion 草稿已备好（`docs/drafts/`），发布按钮只能由人按。

**agent 可用性测试**作为常驻手段：拿全新 agent session 当陌生开发者，卡在哪，哪就是合同的洞。比招募真人便宜且可回归。

## 中期（0.7–0.8）：agentOS 差异化 + 活过一次内核升级

本期问题：**「这是 agentOS 还是又一个 IDE 皮肤？平台能活过内核升级吗？」**

按优先级：

1. **活过一次 rc 升级（必答题，时间不由我们选）。** rc.6 → rc.7 时执行第一次「合同版本升级演练」：合同版本 +1、套件更新、三个 sibling App 跑套件、机械修改列清单。目标：作者只需跑一次检查，不需要读内核 diff。这是「不被上游改崩」承诺的兑现方式。
2. **旗舰组合反哺合同。** Automations recipe App（ADR 0007：trigger + prompt + 权限边界 → 新 Session）在树外推进，其无人值守身份、Host 半边惯用法的第三次重复会决定下一批可抽取项。附带甜点：**App 间深链**（Usage 的某一天 → 打开对应 session），只是 URL 约定，不是新机制。
3. **多端寄宿演示。** 同一 profile 手机浏览器打开，零代码改动，一张截图兑现 web 优先的承诺。做成 demo，不立工程项。
4. **分发铺开。** 人工发布后跟进 awesome PR / Discussion / npm 正式化；差异化（Agent 用户）立住之前不催量。

中期指标：三个 sibling App 无改动（或仅清单内机械改动）通过 rc.7 套件；真实会话中 agent 打开 App 的动作出现在日常使用里。

## 长期（0.9+）：OS 深水区，等原语再进

- **Resources / Principals / Grants / Spaces / 联邦**：照 [dependency-map](../design/dependency-map.md) 的分期，等 DSH 侧长出对应 Host 原语（无人值守身份、事件触发面、授权）再进。提前造 = 又一扇 titanwings 式空窗。
- **事件触发面**：DSH 的事，不代位。Automations App 的 trigger 目录跟着官方原语走。
- 深水区的准入条件：App 数量证明需求（北极星指标持续增长），而不是架构的完备欲。

## 通讯契约的空格子

契约不是设计出来的，是从两个真实通话方之间提炼的（两方法则）。每个空格子写明「等谁出现」，不提前动土：

| 通道 | 契约 | 状态 |
| --- | --- | --- |
| App → 平台（注册/导航）、平台 → App（渲染）、App ↔ 扩展（slot） | 作者合同 v1 | 已有 |
| Agent → 平台 | `open_app` tool schema | 0.6 |
| App ↔ App（数据） | URL 即管道：`open_app(id, path)`，路径就是数据，App 拥有自己的路由语法 | 已有原语；首个使用者是 Usage→session 深链（0.7） |
| App → Agent（回传结果） | 「Host 等、推浏览器、人操作、RPC 回」（`ask_user_question` 先例的泛化） | 等第一个真实需要它的 App；不排期 |
| 共享数据对象 | Resource / Principal / Grant | 长期区，等 DSH Host 原语 |
| 平台级 App 间消息总线 | —— | **永不**。web 靠链接赢了总线 |

建议卡的回调不出平台的门（fold 与 `pages.open()` 都归 webpage），不构成新通讯面。

## 常设不做清单

商店与安装面（ADR 0006）、调度器与第三套 cron（ADR 0007）、运行时封装层与 DSL（ADR 0008）、桌面壳、提前的 Resource/Grant/Space、fork 官方 UI 包、自动发布。

## 治理纪律

- **三次法则**：任何运行时辅助等第三个独立消费者出现再抽。
- **两方法则**：任何通讯契约等两个真实通话方出现再定。契约的成本不在写，在于永久维护。
- **合同版本化**：作者面对的是版本号 + 检查套件，不是内核 diff。
- **每 rc 一次显式兼容 pass**：证据落 `docs/evidence/`。
- **验收即证据**：每期照 `docs/testing.md` 的证据规则落盘，不由代码巡检代替。
