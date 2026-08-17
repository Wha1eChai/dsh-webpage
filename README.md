# dsh-webpage

English | [中文](README.zh.md)

A windowing system for DeepSeek Harness.

DSH already treats everything as a plugin. This project adds the missing piece: an **address**. An App is an ordinary plugin that owns `/apps/<id>/*`. You can refresh it. A session agent can suggest it. If it crashes, that window closes; the conversation and the other Apps stay up.

The address is the same string a person bookmarks, a session agent passes to `open_app`, and any other agent that can reach this Web UI can open to see the same state.

This is not a second plugin runtime, and it is not a plugin store. Plugins remain how software is installed. Apps are what you open. A Pack is a curated composition of existing plugins and configuration. It is not another runtime.

The stock conversation stays mounted. Webpage adds one outlet on the existing `shell.overlay` slot. Leaving an App takes the window away and leaves the chat where it was.

## Try it

Nothing is on npm yet. Tag `v0.2.0` marks this contract. The older `v0.1.0` tag predates the contract and the `@dshapps` name — do not install it.

Requirements: DSH `0.1.0-rc.6`, Node `^22.19.0 || >=24.0.0`, a Web UI mounted at the origin root (`/apps/...` works; `/dsh/apps/...` does not yet).

```powershell
corepack pnpm@11.7.0 install
corepack pnpm@11.7.0 --dir packages/webpage pack
dsh plugin --profile web add .\dshapps-webpage-0.2.0.tgz
```

Then open `/apps/dshapps.usage` or `/apps/dshapps.notes` if those Apps are in the profile. The kernel also contributes Inspector as an ordinary App.

## Write one

Start from [`dsh-app-template`](https://github.com/dshapps/dsh-app-template). You are writing a window, not another sidebar plugin.

The [authoring guide](./docs/guides/app-authoring.md) is the contract (version 1). [`@dshapps/app-check`](https://github.com/dshapps/dsh-app-check) is the same contract, executable — its major version is the contract version. We do not wrap Cordis so Apps “cannot break.” We give you types, a template, and a checker.

## A suite, not twelve sidebars

If you already ship a workbench as many plugins, keep the packages. Register one App and put the pieces in [child slots](./docs/guides/app-authoring.md). You do not need a fourth repository whose only job is `dsh plugin add` three times.

## Family

This repository is the platform: the kernel, the contract, and the acceptance fixtures. Apps live in their own repositories on purpose.

| Repository | Package | Role |
| --- | --- | --- |
| `dsh-webpage` (here) | `@dshapps/webpage` | Kernel: registry, routes, outlet, launcher, Inspector, failure domain, `open_app`, optional `/ui` kit |
| [`dsh-app-check`](https://github.com/dshapps/dsh-app-check) | `@dshapps/app-check` | Executable contract checks |
| [`dsh-app-template`](https://github.com/dshapps/dsh-app-template) | `@acme/hello-app` (placeholders) | Official starter |
| [`dsh-usage-app`](https://github.com/dshapps/dsh-usage-app) | `@dshapps/usage-app` | Flagship: local token heatmap and Host-proxied balances |
| [`dsh-notes-app`](https://github.com/dshapps/dsh-notes-app) | `@dshapps/notes-app` | Small addressable notes App |
| [`dsh-jobs-app`](https://github.com/dshapps/dsh-jobs-app) | `@dshapps/jobs-app` | Historical example. Not in the standing profile |
| [`dsh-automations-app`](https://github.com/dshapps/dsh-automations-app) | `@dshapps/automations-app` | Historical example. Not in the standing profile |

[`dsh-gateway`](https://github.com/dshapps/dsh-gateway) consumes this contract as a heavy service. It is not a first-party App in the table.

## Documents

- [Authoring guide](./docs/guides/app-authoring.md) — write an App (contract version 1)
- [Domain language](./CONTEXT.md) — Plugin, App, Pack, Address
- [Architecture](./docs/design/architecture.md) — what the bundle owns
- [ADR index](./docs/adr/0001-apps-are-plugin-contributions.md) — decisions, starting at 0001

The skill at [`.cursor/skills/dsh-app-authoring/SKILL.md`](./.cursor/skills/dsh-app-authoring/SKILL.md) is the agent-facing door to the same guide. Phase notes and research stay in a private repository; if an author needs a fact, it graduates here.

Licensed under the [MIT License](LICENSE).
