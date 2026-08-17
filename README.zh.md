# dsh-webpage

[English](README.md) | 中文

DeepSeek Harness 的窗口系统。

DSH 已经把一切都当成插件。这个项目补上缺的那一块：**地址**。App 是普通插件，拥有 `/apps/<id>/*`。可以刷新。会话里的 agent 可以建议打开它。挂了只关这扇窗，对话和其他 App 还在。

地址就是人收藏的那条、会话 agent 传给 `open_app` 的那条，以及任何够得着这台 Web UI 的其他 agent 打开后能看到同一状态的那条。

这不是第二套插件运行时，也不是插件商店。软件怎么装，还是插件。打开的是 App。Pack 是已有插件和配置的组合，不是另一套运行时。

原有对话继续挂着。Webpage 只在现有的 `shell.overlay` 槽上加一个出口。离开 App 只拿走窗口，对话留在原地。

## 试用

还没有上 npm。tag `v0.2.0` 对应这份合同。更早的 `v0.1.0` 早于这份合同和 `@dshapps` 这个名字——不要装它。

要求：DSH `0.1.0-rc.6`，Node `^22.19.0 || >=24.0.0`，Web UI 挂在站点根路径（`/apps/...` 可用；`/dsh/apps/...` 还不行）。

```powershell
corepack pnpm@11.7.0 install
corepack pnpm@11.7.0 --dir packages/webpage pack
dsh plugin --profile web add .\dshapps-webpage-0.2.0.tgz
```

如果 profile 里已经有这些 App，打开 `/apps/dshapps.usage` 或 `/apps/dshapps.notes`。内核自己也贡献一个普通 App：Inspector。

## 写一个

从 [`dsh-app-template`](https://github.com/dshapps/dsh-app-template) 开始。你在写一扇窗，不是又一个侧栏插件。

[写作指南](./docs/guides/app-authoring.md) 就是合同（版本 1）。[`@dshapps/app-check`](https://github.com/dshapps/dsh-app-check) 是同一份合同的可执行版本——主版本号就是合同版本。我们不包装 Cordis 来让 App「不会坏」。我们给你类型、模板和检查器。

## 一套，不是十二条侧栏

如果工作台已经拆成多个插件，包可以留着。注册一个 App，把零件放进[子槽](./docs/guides/app-authoring.md)。不需要再开一个仓库，只为了跑三次 `dsh plugin add`。

## 这一家

这个仓库是平台：内核、合同、验收夹具。App 故意各自独立成库。

| 仓库 | 包 | 角色 |
| --- | --- | --- |
| `dsh-webpage`（本仓库） | `@dshapps/webpage` | 内核：注册表、路由、出口、启动器、Inspector、故障域、`open_app`、可选 `/ui` 套件 |
| [`dsh-app-check`](https://github.com/dshapps/dsh-app-check) | `@dshapps/app-check` | 可执行合同检查 |
| [`dsh-app-template`](https://github.com/dshapps/dsh-app-template) | `@acme/hello-app`（占位名） | 官方起步模板 |
| [`dsh-usage-app`](https://github.com/dshapps/dsh-usage-app) | `@dshapps/usage-app` | 旗舰：本地 token 热力图和 Host 代理的余额 |
| [`dsh-notes-app`](https://github.com/dshapps/dsh-notes-app) | `@dshapps/notes-app` | 小的、有地址的笔记 App |
| [`dsh-jobs-app`](https://github.com/dshapps/dsh-jobs-app) | `@dshapps/jobs-app` | 历史示例。不在常驻 profile 里 |
| [`dsh-automations-app`](https://github.com/dshapps/dsh-automations-app) | `@dshapps/automations-app` | 历史示例。不在常驻 profile 里 |

[`dsh-gateway`](https://github.com/dshapps/dsh-gateway) 作为重型服务消费这份合同。它不是表里的一等 App。

## 文档

- [写作指南](./docs/guides/app-authoring.md) — 写一个 App（合同版本 1）
- [领域用语](./CONTEXT.md) — Plugin、App、Pack、Address
- [架构](./docs/design/architecture.md) — 这个 bundle 拥有什么
- [ADR 索引](./docs/adr/0001-apps-are-plugin-contributions.md) — 从 0001 起的决定

[`.cursor/skills/dsh-app-authoring/SKILL.md`](./.cursor/skills/dsh-app-authoring/SKILL.md) 是同一份指南面向 agent 的入口。阶段笔记和调研留在私有仓库；作者需要的事实会升到这里。

使用 [MIT License](LICENSE)。
