# dsh-webpage

An experimental application layer for the DeepSeek Harness Web UI.

`dsh-webpage` lets ordinary DSH plugins contribute addressable Web applications without introducing a second plugin system. A contributed app owns a stable route subtree, participates in the existing DSH plugin lifecycle, and may later expose the same resources to humans and agents.

The project is implemented entirely as an out-of-tree DSH plugin/bundle. It does not require changes to the DeepSeek Harness repository: the stock client module loader, UI slots, SPA fallback, Cordis lifecycle, Typert remotes, and profile composition are the platform API.

## Current focus

The platform is deliberately limited to the shared Web application substrate:

- app registration and discovery;
- stable, namespaced routes with nested pages;
- navigation and application switching;
- lifecycle-safe mount, dispose, and HMR behavior;
- a failure domain in which a crashed App is a closed window, not a broken shell;
- declared extension slots;
- app metadata for classification and read-only catalog views;
- one address space shared by humans and session agents (`open_app` plus an inert suggestion card);
- an executable authoring contract, proven by out-of-tree Apps rather than by in-tree features.

The stock Web shell remains mounted. A single Webpage outlet contributes to the existing `shell.overlay` slot and renders the active `/apps/<app-id>/*` route above the conversation surface; leaving an App reveals the still-mounted conversation with its local state intact.

Version 0.1 supports deployments mounted at the origin root only. URLs such as `https://host/apps/example.app` are in scope; reverse-proxy prefixes such as `https://host/dsh/apps/example.app` are not yet supported.

Resource persistence, agent authorization, multi-user Spaces, remote federation, marketplace installation, and untrusted-code sandboxing are later layers.

## Relationship to DSH plugins

Plugins remain the only installation, versioning, dependency, trust, and lifecycle unit. Apps and pages are contributions made by plugins:

```text
DSH Plugin
  -> contributes zero or more Apps
       -> owns /apps/<app-id>/*
            -> contains Pages and declared extension slots
```

A Pack is a curated composition of existing plugins and configuration, analogous to a modpack. It does not define another runtime or package manager.

## Documents

- [Domain language](./CONTEXT.md)
- [Authoring guide](./docs/guides/app-authoring.md) — the versioned authoring contract (contract version 1)
- [App authoring skill](./.cursor/skills/dsh-app-authoring/SKILL.md) — agent-facing entry point to the same contract
- [Architecture and public contract](./docs/design/architecture.md)
- [Package topology](./docs/design/package-topology.md)
- [Capability dependency map and evolution plan](./docs/design/dependency-map.md)
- [ADR: Apps are plugin contributions](./docs/adr/0001-apps-are-plugin-contributions.md)
- [ADR: App UI composes through DSH slots](./docs/adr/0002-app-ui-composes-through-dsh-slots.md)
- [ADR: Publish App navigation on ctx.pages](./docs/adr/0003-publish-pages-navigation.md)
- [ADR: Inspector panes are list-slot contributions](./docs/adr/0004-inspector-panes-are-slot-contributions.md)
- [ADR: Launcher switcher, App surfaces, and optional `/ui`](./docs/adr/0005-launcher-switcher-and-app-surfaces.md)
- [ADR: Webpage is a windowing system, not a store](./docs/adr/0006-webpage-is-a-windowing-system-not-a-store.md)
- [ADR: Automations are trigger → agent loop](./docs/adr/0007-automations-are-trigger-to-agent-loop.md)
- [ADR: Contract over wrapper](./docs/adr/0008-contract-over-wrapper.md)
- [ADR: Apps do not proxy foreign origins](./docs/adr/0009-apps-do-not-proxy-foreign-origins.md)

Phase plans, verification records, research notes, and the cross-session handoff live in a separate private repository. They describe how this project is run rather than how to build on it; anything an App author needs graduates into the documents above.

## The repository family

This repository is the **platform**: the kernel, its documentation, the authoring contract, and the acceptance fixtures. Ecosystem Apps live in their own repositories on purpose — an App is an out-of-tree contribution that consumes the published contract, and that property is the product claim ([ADR 0001](./docs/adr/0001-apps-are-plugin-contributions.md), [ADR 0006](./docs/adr/0006-webpage-is-a-windowing-system-not-a-store.md)).

| Repository | Package | Role |
| --- | --- | --- |
| `dsh-webpage` (here) | `@dshapps/webpage` | App kernel: registry, routes, outlet, launcher, Inspector, failure domain, `open_app` tool, optional `/ui` kit |
| [`dsh-app-check`](https://github.com/dshapps/dsh-app-check) | `@dshapps/app-check` | Executable authoring-contract checks. Major version tracks the contract version |
| [`dsh-app-template`](https://github.com/dshapps/dsh-app-template) | `@acme/hello-app` (placeholders) | Official starter: client + Host halves, rename script, conformance wiring |
| [`dsh-usage-app`](https://github.com/dshapps/dsh-usage-app) | `@dshapps/usage-app` | Flagship App: local token heatmap plus Host-proxied provider balances |
| [`dsh-notes-app`](https://github.com/dshapps/dsh-notes-app) | `@dshapps/notes-app` | Small addressable notes App; built as a cold-start test of this contract |
| [`dsh-jobs-app`](https://github.com/dshapps/dsh-jobs-app) | `@dshapps/jobs-app` | Historical example: current-session jobs as a panel. Not in the standing profile |
| [`dsh-automations-app`](https://github.com/dshapps/dsh-automations-app) | `@dshapps/automations-app` | Historical example only; superseded by [ADR 0007](./docs/adr/0007-automations-are-trigger-to-agent-loop.md). Not in the standing profile |

Start a new App from [`dsh-app-template`](https://github.com/dshapps/dsh-app-template). [`dsh-gateway`](https://github.com/dshapps/dsh-gateway) is a separate heavy-service consumer of this contract, not a first-party App in this table.

## Current status

v0.1 through Phase 0.5 are accepted. Phase 0.6 stamps authoring contract version 1 and makes agents first-class users of the address space: the kernel Host half registers an `open_app` tool, and the client renders it as an inert suggestion card that navigates only when a human clicks it. The conformance checks ship as `@dshapps/app-check`, whose major version tracks the contract version. Standalone cron is explicitly not an Automations App ([ADR 0007](./docs/adr/0007-automations-are-trigger-to-agent-loop.md)); the platform ships contract carriers rather than a runtime layer ([ADR 0008](./docs/adr/0008-contract-over-wrapper.md)).

Every phase is verified against a real profile: unit coverage, real Loader integration, packed-payload equality, an external CLI install, and browser acceptance on a running Web shell. CI runs typecheck, lint, unit tests, build, and pack verification on Ubuntu and Windows. The packed-profile install that needs the external DSH CLI stays a local gate. The supported deployment remains root-path-only and shared Cordis HMR remains intentionally disabled.

Known gaps are recorded rather than implied: the contract has never survived an upstream DSH bump, and nothing is published to npm.

## Install

Requirements: DSH `0.1.0-rc.6`, Node `^22.19.0 || >=24.0.0`, and a root-mounted Web deployment.

Nothing is on npm yet, and the existing `v0.1.0` release predates both Phase 0.2 and the `@dshapps` rename, so build the current kernel from source and install the tarball it produces:

```powershell
corepack pnpm@11.7.0 install
corepack pnpm@11.7.0 --dir packages/webpage pack
dsh plugin --profile web add .\dshapps-webpage-0.2.0.tgz
```

A refreshed release and an npm publish are the next distribution steps. The core package contributes the Webpage substrate and the Inspector App; the reference fixtures in this repository are `private: true` test packages, not part of the public installation contract.
