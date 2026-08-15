# Phase 0.3 — Launcher switcher, App surfaces, and `/ui` kit

## Status and release boundary

| Item | Decision |
| --- | --- |
| Plan status | Accepted. |
| Kernel | Sidebar Apps opens a list+filter launch panel. `AppDescriptor.surface` selects overlay / panel / modal chrome. Optional `@wha1echai/dsh-webpage/ui`. |
| First consumer | Independent `dsh-jobs-app` drops the marketing hero, uses the kit, and declares `surface: 'panel'`. |
| Pinned toolchain | DSH `0.1.0-rc.6`; pnpm `11.7.0`; Node `^22.19.0 || >=24.0.0`. |
| Explicitly out | Cmd+K, action contributions in the palette, Host remotes, job cancel/streamed output, Gateway/CPA. |

## Dependency edges

```text
v0.2 App kernel
  -> ADR 0005 launcher + surface + optional /ui
    -> Outlet shells + launch panel
      -> Inspector and launcher consume the kit
        -> Jobs App consumes the kit and declares panel
          -> webpage e2e + jobs browser + packed profile
```

## Phase gates

| Phase | Status | Deliverables | Stop/go |
| --- | --- | --- | --- |
| 0. Docs | Completed | ADR 0005, architecture/topology/HANDOFF, this plan | GO — docs match the public contract |
| 1. Surfaces + switcher | Completed | `surface` on the descriptor; three Outlet shells; launch panel | GO — one RouteController; Inspector is a row |
| 2. `/ui` kit | Completed | `@wha1echai/dsh-webpage/ui`; Inspector and launcher consume it | GO — kit is not part of `register()` |
| 3. Jobs | Completed | Kit layout, whole-row open, empty actions hidden, `panel` | GO — conversation remains visible |
| 4. Verify | Completed | unit/lint/pack; webpage e2e; jobs browser; tarball + web profile | GO — Apps → panel → Inspector; Jobs panel leaves chat visible |

## Public contract additions

```ts
interface AppDescriptor {
  id: string
  label: string
  description?: string
  order?: number
  categories?: readonly string[]
  surface?: 'overlay' | 'panel' | 'modal'
}
```

Omitted `surface` is `overlay`. Invalid values throw at `register()`.

`@wha1echai/dsh-webpage/ui` exports `AppPage`, `AppList`, `AppRow`, `AppEmpty`, `AppFields`, `AppField`, and `AppActions`. `AppActions` renders nothing when it has no children.

## Evidence

Command results belong in [phase-0.3-verification.md](../evidence/phase-0.3-verification.md) after the verify gate.
