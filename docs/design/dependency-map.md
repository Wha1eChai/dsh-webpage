# Capability dependency map

This document separates the long-term system from the set of capabilities that can be implemented as one fast, coherent release.

## Existing DSH foundation

The project should reuse these DSH mechanisms rather than replace them:

- Cordis plugin services, injection, lifecycle, and disposal;
- profiles, bundles, patches, and plugin installation;
- Host and `dsh.client` plugin halves;
- browser module graph, HMR, and UI slots;
- Typert remote APIs, Connection, and WebSocket event delivery;
- the existing DSH Web server and SPA shell.

The project has a zero-upstream-change constraint. It must ship as an ordinary external DSH bundle and compose through these public surfaces; a missing convenience API is not by itself a reason to patch the Harness repository.

## Stock-shell integration

The first implementation can remain additive to the standard Web profile:

```text
ordinary App client plugins
  -> register App metadata in ctx.pages
  -> register App UI in the keyed webpage.app slot
      -> Webpage App Outlet selects the active History API route
          -> one contribution in the existing shell.overlay slot
              -> covers the AppFrame while an App route is active
              -> disappears on conversation routes without unmounting chat
```

The existing frontend fallback already serves `index.html` for unknown GET paths, so refreshing `/apps/<app-id>/*` can return to the same browser route without claiming the Web server's single fallback seat. Host capabilities remain ordinary plugin services and Typert remotes. Navigation can enter through an existing additive sidebar seat or through a Webpage-owned launcher.

Replacing `ui-layout` through a Pack remains technically possible, because profile layers can override plugin rows, but it is not required for Addressable Apps and would create unnecessary coupling to the shipped layout.

## Dependency graph

```text
Existing DSH plugin and Web runtime
  |
  +-- App contribution contract
      |
      +-- App registry and conflict diagnostics
      |   |
      |   +-- namespaced route ownership and nested pages
      |   +-- navigation and app switching
      |   +-- declared App surfaces (overlay / panel / modal)
      |   +-- optional /ui kit for App chrome
      |   +-- lifecycle-safe mount, dispose, and HMR
      |   +-- app inventory and read-only catalog
      |
      +-- declared extension points
      |   |
      |   +-- third-party App Extensions
      |   +-- app-specific composition
      |
      +-- Pack descriptor
      |   |
      |   +-- classification and compatibility views
      |   +-- profile/bundle composition UI
      |   +-- installation and update UI (later)
      |
      +-- App Resource contract
          |
          +-- authoritative resource operations
          +-- agent-facing capabilities
          +-- versioning, migration, backup, and undo
          +-- Principal and Grant enforcement
              |
              +-- Documents and Artifacts reference app
              +-- multi-user Space
              +-- remote Node trust and dsh-link adapters
                  |
                  +-- remote tasks
                  +-- resource federation and conflict policy
                  +-- collaborative Sheets and CRDT applications
```

The graph has two important separations:

1. The entire App surface can work before a generic Resource model exists.
2. Multi-user and remote features depend on enforceable identity and Grants, not merely on Web reachability.

Phase 0.2 adds operate APIs (`ctx.pages.open` / `close` / `current`) and Inspector panes on existing DSH slots. Host Typert remotes and agent tools remain a later kernel slice. The first consumer is an independent Jobs App that reads `jobsBySession`; it does not replace official `dsh-client-ui-jobs` and does not live in this repository.

## What can be completed quickly as one slice

The first release should consume the complete **addressable App surface** and the read side of ecosystem discovery:

1. A minimal, UI-free App descriptor: stable `id`, label, description, ordering, and classification metadata.
2. A registry that detects duplicate IDs, invalid descriptors, and withdrawn contributions.
3. A reserved `/apps/<app-id>/*` namespace with app-owned nested routing.
4. Root-mounted deep links that survive browser refresh. Reverse-proxy subpaths are explicitly deferred.
5. Navigation and an app switcher integrated through existing declared layout slots.
6. Cordis lifecycle behavior: registration, disposal, HMR replacement, and failure isolation.
7. App-owned extension points built on the existing UI slot mechanism.
8. Classification metadata and a read-only Installed Apps inspector showing the source plugin and contributed surfaces.
9. One reference App plus one small extension plugin proving cross-plugin composition.
10. A declarative Pack example that maps to existing DSH profile/bundle mechanisms without adding an installer.

These capabilities share the same registries and lifecycle path. Implementing them together produces a useful public contract and a visible demo without requiring a new persistence, authorization, or networking system.

## First-release acceptance scenarios

- Two unrelated plugins contribute Apps and both appear in navigation.
- Directly opening an App's nested URL renders the same view after refresh.
- Two plugins claiming the same App ID produce a deterministic diagnostic rather than silent replacement.
- Disabling or reloading a plugin removes or replaces its App without restarting unrelated Apps.
- An extension plugin contributes UI only through an extension point declared by the target App.
- The inspector identifies each App's source Plugin, route, status, categories, and extension points.
- Installing the example Pack through existing DSH profile mechanics activates the reference App and its extension.

## What not to consume in the first release

- generic App-owned persistence or schema migration;
- agent/user ACL and delegated Grants;
- authentication, organizations, or multi-user Spaces;
- Plugin Hub installation, upgrades, signatures, and rollback;
- untrusted client or server code sandboxing;
- remote Node federation or resource synchronization;
- collaborative editing, CRDT, or Sheets;
- supervisor integration;
- a declarative UI programming language;
- a second dependency resolver or package manager.
- patches or required feature work in the upstream DeepSeek Harness repository.
- reverse-proxy deployment below a URL prefix such as `/dsh/apps/...`.

## Evolution path

### 0.1 — Addressable Apps

Ship the complete first slice above as `@wha1echai/dsh-webpage`, plus private reference App, extension, and Pack fixtures. This establishes the vocabulary, route convention, metadata registry, keyed UI slot, lifecycle behavior, and extension contract that other plugin authors can adopt. The compatibility target is frozen at DSH `0.1.0-rc.6`; upgrades require a separate compatibility pass.

### 0.2 — Agent-native Resources

Introduce a narrow Resource contract through one Documents or Artifacts reference App. Start with stable resource identity, CRUD operations, revisions, preview/diff, backup/export, and a DSH-native agent tool surface. Treat MCP as an optional adapter for external clients, not as the internal authority model.

### 0.3 — Principals and Grants

Add Host-enforced authorization for human and agent Principals. A session-scoped capability may bootstrap the first implementation, but caller-provided identity and UI-only filtering are never authorization boundaries.

### 0.4 — Catalog and Packs

Turn the read-only inspector into a discovery experience. Reuse the official plugin/profile operations for installation and upgrades; add Pack compatibility, configuration previews, and rollback only when those host APIs are stable.

### 0.5 — Spaces

Group Resources and Grants into local multi-user collaboration boundaries. Authentication, audit, membership inheritance, and resource ownership precede sharing UI.

### 0.6 — Link and federation adapters

Expose selected resources or remote tasks between Nodes. Reuse shared discovery and secure transport where appropriate, while keeping supervisor Fleet control and Webpage Resource protocols independent.

## Relationship to dsh-supervisor

`dsh-supervisor` and `dsh-webpage` are independent plugins over the DSH runtime:

- Supervisor owns live cross-session agent observation and control.
- Webpage owns addressable applications and, later, application resources.
- A future adapter may render Supervisor as an App or carry Fleet operations over a Node link.
- Neither project is a required dependency of the other.
