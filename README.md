# dsh-webpage

An experimental application layer for the DeepSeek Harness Web UI.

`dsh-webpage` lets ordinary DSH plugins contribute addressable Web applications without introducing a second plugin system. A contributed app owns a stable route subtree, participates in the existing DSH plugin lifecycle, and may later expose the same resources to humans and agents.

The project is implemented entirely as an out-of-tree DSH plugin/bundle. It does not require changes to the DeepSeek Harness repository: the stock client module loader, UI slots, SPA fallback, Cordis lifecycle, Typert remotes, and profile composition are the platform API.

## Current focus

The first milestone is deliberately limited to the shared Web application substrate:

- app registration and discovery;
- stable, namespaced routes with nested pages;
- navigation and application switching;
- lifecycle-safe mount, dispose, and HMR behavior;
- declared extension slots;
- app metadata for classification and read-only catalog views;
- one reference app proving the complete path.

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
- [v0.1 execution plan](./docs/plan/phase-0.1-addressable-apps.md)
- [v0.2 App kernel plan](./docs/plan/phase-0.2-app-kernel.md)
- [v0.3 surfaces and UI kit plan](./docs/plan/phase-0.3-app-surfaces-and-ui-kit.md)
- [v0.4 failure domain and flagship Apps](./docs/plan/phase-0.4-failure-domain-and-flagship-apps.md)
- [Authoring guide](./docs/guides/app-authoring.md)
- [Phase 0.4 demo script](./docs/demo/phase-0.4-demo.md)
- [Phase 0.5 demo script](./docs/demo/phase-0.5-demo.md)
- [Agent loop and peer automations](./docs/research/agent-loop-and-peer-automations.md)
- [Architecture and public contract](./docs/design/architecture.md)
- [Package topology](./docs/design/package-topology.md)
- [Capability dependency map and evolution plan](./docs/design/dependency-map.md)
- [Testing strategy and evidence](./docs/testing.md)
- [Phase 4 verification evidence](./docs/evidence/phase4-verification.md)
- [Phase 5 verification evidence](./docs/evidence/phase5-verification.md)
- [ADR: Apps are plugin contributions](./docs/adr/0001-apps-are-plugin-contributions.md)
- [ADR: App UI composes through DSH slots](./docs/adr/0002-app-ui-composes-through-dsh-slots.md)
- [ADR: Publish App navigation on ctx.pages](./docs/adr/0003-publish-pages-navigation.md)
- [ADR: Inspector panes are list-slot contributions](./docs/adr/0004-inspector-panes-are-slot-contributions.md)
- [ADR: Launcher switcher, App surfaces, and optional `/ui`](./docs/adr/0005-launcher-switcher-and-app-surfaces.md)
- [ADR: Webpage is a windowing system, not a store](./docs/adr/0006-webpage-is-a-windowing-system-not-a-store.md)
- [ADR: Automations are trigger → agent loop](./docs/adr/0007-automations-are-trigger-to-agent-loop.md)
- [ADR: Contract over wrapper](./docs/adr/0008-contract-over-wrapper.md)
- [Roadmap (2026-08, 0.6 and beyond)](./docs/plan/roadmap-2026-08.md)
- [Current handoff](./HANDOFF.md)

## Current status

v0.1 is accepted. Phase 0.2 is accepted. Phase 0.3 is accepted. Phase 0.4 is accepted (failure domain). Phase 0.5 rebuilds Usage as a local token heatmap plus Host-proxied provider cards, and records that standalone cron is not an Automations App ([ADR 0007](./docs/adr/0007-automations-are-trigger-to-agent-loop.md)). Jobs App and the titanwings Automations remote are out of the web profile. Gateway wrapping of CLIProxyAPI is paused. The supported deployment remains root-path-only and shared Cordis HMR remains intentionally disabled. Implementation and evidence status are tracked in the [v0.1 plan](./docs/plan/phase-0.1-addressable-apps.md), [v0.2 plan](./docs/plan/phase-0.2-app-kernel.md), [v0.3 plan](./docs/plan/phase-0.3-app-surfaces-and-ui-kit.md), [v0.4 plan](./docs/plan/phase-0.4-failure-domain-and-flagship-apps.md), [Phase 0.4 evidence](./docs/evidence/phase-0.4-verification.md), [Phase 0.5 evidence](./docs/evidence/phase-0.5-verification.md), [Phase 5 evidence](./docs/evidence/phase5-verification.md), and `HANDOFF.md`.

## Install the v0.1 preview

The project is distributed as a GitHub Release tarball for now; it is not published to npm. DSH `0.1.0-rc.6`, Node `^22.19.0 || >=24.0.0`, and a root-mounted Web deployment are required.

```powershell
gh release download v0.1.0 --repo Wha1eChai/dsh-webpage --pattern 'wha1echai-dsh-webpage-0.1.0.tgz'
dsh plugin --profile web add .\wha1echai-dsh-webpage-0.1.0.tgz
```

The core package contributes the Webpage substrate and Inspector. The private reference fixtures in this repository are test packages, not part of the public installation contract.
