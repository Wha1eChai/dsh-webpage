# Phase 0.4 — Failure domain, flagship Apps, demo drafts

## Status and release boundary

| Item | Decision |
| --- | --- |
| Plan status | Accepted. |
| Kernel | `AppBoundary` (error boundary + Suspense) wraps every App body. A crashed App is a closed window. |
| Authoring | [app-authoring.md](../guides/app-authoring.md) is the operational contract. ADR 0006 is the norm. |
| Flagship A | Usage App is **最小自建** after gate A. Sibling repo `dsh-usage-app`. |
| Flagship B | Automations App is **适配移植** titanwings/dsh-automation `#v0.1.5` after gate B. Sibling repo `dsh-automations-app`. |
| Distribution | Drafts only. No public npm publish, no awesome PR, no Discussion post. |
| Pinned toolchain | DSH `0.1.0-rc.6`; pnpm `11.7.0`; Node `^22.19.0 || >=24.0.0`. |
| Explicitly out | Store surface; forking official Jobs; auto-installing titanwings Host; crash-app in the web profile. |

## Dependency edges

```text
ADR 0006 windowing system
  -> Stage 1 AppBoundary + locale + crash-app fixture
    -> Stage 2 authoring guide + lazy reference-app
      -> Gate A usage candidates -> Stage 4a dsh-usage-app
      -> Gate B automations candidates -> Stage 4b dsh-automations-app
        -> Stage 5 demo script + drafts
```

## Phase gates

| Phase | Status | Deliverables | Stop/go |
| --- | --- | --- | --- |
| 1. Failure domain | Completed | `AppBoundary`; crashed/retry/loading locale; Jobs lazy body; crash-app; e2e isolation | GO — throw stays inside the window |
| 2. Authoring | Completed | `docs/guides/app-authoring.md`; reference-app lazy template | GO — contract is copyable |
| Gate A | Completed | [usage-app-candidates.md](../research/usage-app-candidates.md) | GO — 最小自建 |
| Gate B | Completed | [automations-app-candidates.md](../research/automations-app-candidates.md) | GO — 适配移植 titanwings v0.1.5 |
| 4a. Usage App | Completed | panel, lazy body, 100% unit, tarball, web profile | GO — local activity, not vendor balances |
| 4b. Automations App | Completed | panel, lazy body, Host-missing empty, 100% unit, tarball, web profile | GO — no titanwings auto-install |
| 5. Demo + drafts | Completed | demo script, awesome/Discussion/npm drafts, this plan, HANDOFF | GO — drafts only |

## Public contract additions

`AppOutlet` wraps the keyed body in `AppBoundary`. Locale keys `crashedTitle`, `crashedDescription`, `retry`, and `loading` exist in zh and en.

Client bundles that use `React.lazy` must set tsdown `outputOptions.codeSplitting: false`. Async chunks are not Loader-compatible.

## Evidence

Command results belong in [phase-0.4-verification.md](../evidence/phase-0.4-verification.md).
