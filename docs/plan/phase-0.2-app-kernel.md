# Phase 0.2 — App kernel navigation and first ecosystem App

## Status and release boundary

| Item | Decision |
| --- | --- |
| Plan status | Accepted. |
| Kernel | dsh-webpage remains the public App substrate: metadata, `/apps/<id>/*`, outlet, Inspector, launcher. |
| First App | Independent public plugin `dsh-jobs-app` (`wha1echai.jobs`). Not an example fixture and not a Webpage first-party collection. |
| Pinned toolchain | DSH `0.1.0-rc.6`; pnpm `11.7.0`; Node `^22.19.0 || >=24.0.0`. |
| Explicitly out | Host Typert remotes, agent `list_apps` tools, job cancel/streamed output, marketplace, CPA/gateway, Cursor Automations. |

Gateway product work is paused. Reusable Webpage experience is proven by an independent Jobs App, not by wrapping CLIProxyAPI.

## Dependency edges

```text
v0.1 Addressable Apps
  -> ctx.pages.open / close / current
    -> Inspector pane slot + launcher uses open()
      -> independent Jobs App (list + detail + header deep-link)
        -> packed-install and browser conversation-preservation
```

## Phase gates

| Phase | Status | Deliverables | Stop/go |
| --- | --- | --- | --- |
| 0. Docs | Completed | ADR 0003/0004, architecture/topology/HANDOFF, this plan | GO — docs match the public contract |
| 1. Pages navigation | Completed | `PagesService` operate API; unit proof a non-core caller can open/close | GO — one RouteController; `register()` stays metadata-only |
| 2. Inspector panes + Jobs App | Completed | Kernel panes; `dsh-jobs-app` repo | GO — no fork of `dsh-client-ui-jobs`; no Host remotes |
| 3. Packed + browser | Completed | webpage `pnpm verify` subset; Jobs packed-install + deep-link | GO — conversation identity retained; unknown job ids stay on the URL |

## Jobs App contract

- App ID `wha1echai.jobs`
- Routes `/` (current-session job list) and `/<jobId>` (read-only detail)
- Child slot `wha1echai.jobs.actions` for later kind-specific extensions
- Header action opens the App; it does not copy the official popover list
- Data from `jobsBySession`; no RPC, no cancel, no streamed output

## Evidence

Command results for the kernel subset and the Jobs packed-install/browser gate are in [phase-0.2-verification.md](../evidence/phase-0.2-verification.md).
