# Phase 0.1 — Addressable Apps execution plan

## Status and release boundary

| Item | Decision |
| --- | --- |
| Plan status | v0.1 complete, accepted, and prepared for public release. |
| Code status | Phases 0–4 accepted; Phase 5 real CLI/Web/HMR implementation lanes are individually verified and included in the passing aggregate. |
| Release | Private, out-of-tree `dsh-webpage` bundle; no upstream DSH changes. |
| Pinned toolchain | DSH `0.1.0-rc.6`; pnpm `11.7.0`; Node `^22.19.0 || >=24.0.0`. |
| Deployment | Root path only. Non-root base paths are a negative verification case, not a supported release target. |

The 0.1 slice establishes the shared Web application substrate. It includes a metadata-only `ctx.pages` contribution/discovery surface, the reserved `/apps/<app-id>/*` route namespace, the keyed `webpage.app` slot, one Webpage outlet in the existing `shell.overlay` slot, a read-only inspector, reference examples, and the verification lanes in [testing.md](../testing.md).

It does not include Resources or persistence, Principals or Grants, Spaces, remote federation, marketplace installation, sandboxing, or a second package manager/plugin system.

## Dependency edges

The implementation must preserve these edges; a later phase may not bypass an earlier contract:

```text
DSH plugin/runtime + stock Web profile
  -> bundle/Loader composition
    -> metadata-only ctx.pages registry
      -> validation, duplicate diagnostics, lifecycle disposal
        -> /apps/<app-id>/* route adapter
          -> keyed webpage.app slot
            -> Webpage App Outlet in shell.overlay
              -> AppFrame, inspector, and example Apps
```

Supporting edges:

- Cordis lifecycle and disposal are the authority for registration, withdrawal, and HMR replacement.
- The existing SPA fallback and History API must preserve a deep link on refresh; the bundle must not claim a second server fallback.
- App route ownership is namespaced by App ID. App Extensions may contribute only through extension points declared by the target App.
- The real DSH Loader and profile/bundle composition are required for integration and packed-install evidence; mocks alone cannot satisfy those gates.
- Root-path handling is an explicit release constraint. A non-root base-path attempt must produce the documented negative result and must not be reported as supported.

## Phase gates

| Phase | Status | Depends on | Deliverables | Stop/go gate |
| --- | --- | --- | --- | --- |
| 0. Documentation baseline | Complete | Approved 0.1 scope, README, CONTEXT, dependency map, ADR | Scope boundary, architecture, package topology, dependency edges, acceptance matrix, evidence template, test lanes, HANDOFF | **GO** after this accepted baseline is committed and pushed without implementation scaffolding. **STOP** on an unresolved contract or a request for upstream changes. |
| 1. Workspace and buildable Bundle | Complete | Phase 0 | pnpm workspace; core and private example package skeletons; local client-build preset; exact manifests, exports, bundle patch, locale/style foundations | **GO** when frozen install, build, typecheck, manifest/exports, and Loader-handoff checks pass. **STOP** on an adjacent-checkout build dependency, floating DSH version, broad install-script approval, or accidental default export. |
| 2. Contract, Registry, and RouteController | Complete | Phase 1 | Metadata-only `ctx.pages`; descriptor and ID validation; stable observable list; deterministic duplicate diagnostics; fiber disposal; native-History route parser/controller | **GO** when registry and route unit suites reach per-file 100% coverage and disposal, unknown App, query/hash, and root-path-only cases pass. **STOP** on silent replacement, UI values in metadata, or a router dependency. |
| 3. DSH client integration | Complete | Phase 2 | Service installation; keyed `webpage.app`; one `shell.overlay` outlet; Apps launcher; App chrome; unavailable view; read-only Inspector; real Loader integration | **GO** — two independent plugins contribute Apps, conflicts are diagnostic, early `slots.inject` waits correctly, and unload removes metadata, App slot, and child extensions. |
| 4. Reference App, Extension, and Pack | Complete | Phase 3 | `wha1echai.reference` with `/` and `/details` local routes plus local unavailable state; `wha1echai.reference.actions` child slot; extension-only contribution; ordinary `dsh.bundle` Pack; Inspector topology | **GO** — unit, real Loader, packed-artifact/profile, aggregate, and independent re-review evidence pass. |
| 5. Web, HMR, and packed-install acceptance | Complete | Phase 4 | Disposable isolated profile; tarball install; dump-config evidence; real Web browser, conversation-preservation and keyless UI snapshot; HMR runs; final docs and aggregate verification | **GO** — every required lane is green, packed install is repository-external, `pnpm verify` passes, and focused Standards/Spec re-review has zero STOP findings. |

Phase status is not evidence status. Phase 4 was accepted for its reference-package, Loader, and synthetic packed-profile boundary. Phase 5 has individually passed real packed-profile, browser, client-HMR, and App-crash lanes plus a passing aggregate and focused re-review.

## Phase 0 evidence

```text
Phase: 0
Status: Complete
Implementation refs: none (documentation-only gate)
Evidence refs: README.md; CONTEXT.md; HANDOFF.md; docs/plan/phase-0.1-addressable-apps.md;
  docs/design/{architecture,dependency-map,package-topology}.md; docs/testing.md; ADR 0001/0002
Commands: PowerShell relative-link and trailing-whitespace checks; rg contract consistency scan;
  pnpm view for rc.6 artifact existence; independent read-only Luna gate review
Observed result: all required docs and relative links present; no completed runtime claims;
  review findings on extension lifecycle, provenance, HMR rollback, base path, and navigation were resolved
Open risks/decisions: rc.6 installed-artifact compatibility remains a Phase 1 gate; local source checkout is rc.5
Gate decision: GO
```

```text
Phase: 1
Status: Complete
Implementation refs: package.json; pnpm-workspace.yaml; pnpm-lock.yaml; tsdown.client.ts;
  packages/webpage; examples/reference-{app,extension,pack}; scripts/phase1-check.mjs
Evidence refs: docs/evidence/phase1-verification.md; docs/testing.md “Phase 1 evidence”
Commands: pnpm install --frozen-lockfile; pnpm typecheck; pnpm lint; pnpm build;
  pnpm test:unit; pnpm pack:verify; pnpm verify; git diff --check
Observed result: all commands passed; actual tarball contains 12 allowlisted files; core Node namespace
  exposes named apply only; client Loader handoff, source map, CSS Modules, purity gate, and invariant companion verified
Open risks/decisions: business integration lanes remain unverified and are owned by Phases 2–5;
  the initial review findings on exact payload equality and durable evidence were resolved
Gate decision: GO — independent Luna re-review passed Standards and Spec with no new STOP findings
```

```text
Phase: 2
Status: Complete
Implementation refs: packages/webpage/src/client/{contract,registry,route};
  packages/webpage/tests/unit/{registry,route-parser,route-controller}.spec.ts; vitest.config.ts
Evidence refs: docs/evidence/phase2-verification.md; docs/testing.md “Phase 2 evidence”
Commands: pnpm install --frozen-lockfile; pnpm typecheck; pnpm lint; pnpm build;
  pnpm test:unit; pnpm pack:verify; pnpm verify; git diff --check
Observed result: 24 tests passed; every Registry and route source file reached 100% statements,
  branches, functions, and lines; actual tarball contains exactly 19 allowlisted files
Open risks/decisions: initial review STOP findings on browser URL canonicalization and subscriber
  failure isolation are resolved; client installation/Loader and browser base-path proof remain later work
Gate decision: GO — independent Luna re-review passed Standards and Spec with no residual findings
```

```text
Phase: 3
Status: Complete
Implementation refs: packages/webpage/src/client/{index,slots,outlet,launcher,inspector};
  packages/webpage/tests/unit; tests/{integration,fixtures/phase3-loader}; vitest.integration.config.ts
Evidence refs: docs/evidence/phase3-verification.md; docs/testing.md “Phase 3 evidence”
Commands: pnpm install --frozen-lockfile; pnpm typecheck; pnpm lint; pnpm build;
  pnpm test:unit; pnpm test:integration; pnpm pack:verify; pnpm verify; git diff --check
Observed result: 43 unit tests passed with every owned core client file at 100% statements,
  branches, functions, and lines; one real Loader scenario passed; actual core tarball contains
  exactly 24 allowlisted files
Open risks/decisions: real Web,
  browser preservation, HMR candidate replacement, profile composition, and external install stay later work
Gate decision: GO — initial review STOP findings on public runtime exports and phase-lane ambiguity
  were fixed; the same Luna reviewer returned Standards PASS, Spec PASS, and no residual findings
```

```text
Phase: 4
Status: Complete
Implementation refs: examples/reference-app; examples/reference-extension;
  examples/reference-pack; packages/webpage/src/client/index.tsx;
  tests/integration/phase4-reference-loader.spec.ts; scripts/phase4-pack-verify.mjs
Evidence refs: docs/evidence/phase4-verification.md; docs/testing.md “Phase 4 evidence”
Commands: pnpm install --frozen-lockfile; pnpm typecheck; pnpm test:unit;
  pnpm test:integration; pnpm pack:verify; pnpm verify
Observed result: frozen install and typecheck passed; core unit suite passed 44 tests at
  100% (315/315 statements, 226/226 branches, 91/91 functions, 258/258 lines); reference
  App passed 5 tests; reference extension passed 2; Pack validator passed; integration passed
  2 files / 2 tests through the rc.6 ClientModuleSystem and Cordis Loader; exact packed payloads
  are core 24, App 9, extension 9, Pack 5; workspace ranges were rewritten and a disposable
  repository-external synthetic profile resolved all tarballs and the Pack patch under temp.
Open risks/decisions: Phase 4's synthetic profile was intentionally bounded; Phase 5
  supplies the real external rc.6 CLI/profile and Web/HMR evidence below.
Gate decision: GO — the initial runtime-component export finding was fixed and focused
  re-review returned no residual findings, Standards PASS, and Spec PASS. Phase 5 is the
  successor acceptance record and now closes the overall private v0.1 release gate.
```

```text
Phase: 5
Status: Complete
Implementation refs: scripts/phase5-packed-install.mjs; tests/phase5/packed-profile.mjs;
  scripts/phase5-browser.mjs; tests/browser/phase5-web.e2e.mjs;
  scripts/phase5-hmr.mjs; tests/browser/phase5-hmr.e2e.mjs;
  client package manifest exports required by rc.6 clientModules
Evidence refs: docs/evidence/phase5-verification.md;
  tests/browser/__snapshots__/phase5-web.snapshot.txt
Commands: pnpm pack:verify; pnpm test:browser; pnpm test:hmr; pnpm verify
Observed result: pack verification passed exact Phase 4 payloads plus real external DSH
  0.1.0-rc.6 CLI, isolated DSH_HOME, one top-level Reference Pack, base → Web App → Pack
  bundle order, repository-external package roots, and one ordered core/App/extension
  dump-config row. Browser acceptance passed real Web/Chromium startup HTTP 200, semantic
  onboarding handling, launcher/Inspector, App/details, deep-link reload, back/forward,
  unknown App, same-document conversation identity, unsupported /dsh/apps negative case,
  and fixed 1680x1000 en-US keyless snapshot. Client HMR passed with changed content;
  the final aggregate run rebuilt copied-source fixtures and observed successful replacement
  3262fc0e1ea5 → 97f6418cc432 followed by the render-crash candidate
  97f6418cc432 → f09b24fcbb3b; URL/document/conversation identity was retained,
  no reload occurred, registrations remained singular, and only the expected crash diagnostics appeared.
  A frozen install and full pnpm verify passed.
Open risks/decisions: HMR hashes are run-specific evidence, not cross-run constants; rc.6
  cached boot-revision URL behavior is expected. Compatibility remains rc.6-only, deployment
  remains root-path-only and shared Cordis HMR remains disabled. No npm publication is claimed.
Gate decision: GO — implementation, aggregate, focused review, commit, and private push complete.
```

## Per-phase execution record

Each phase owner fills this record before requesting its gate. Keep links to source, tests, and artifacts concrete; do not replace an absent artifact with a prose assertion.

```text
Phase: <0 / 1 / 2 / 3 / 4 / 5>
Status: <Planned / In progress / Blocked / Complete>
Implementation refs: <files, exported contracts, or example entries>
Evidence refs: <test files, report paths, screenshots/logs, or package artifact>
Commands: <exact commands run>
Observed result: <pass/fail, counts, and relevant diagnostic>
Open risks/decisions: <none or explicit item>
Gate decision: <STOP / GO>
```

For Phase 0, the implementation refs are intentionally `none`; the evidence refs are the accepted contract documents. Phases 4 and 5 have populated and accepted records above.

## Acceptance matrix

| ID | Acceptance outcome | Implementation surface | Required evidence | Status |
| --- | --- | --- | --- | --- |
| A-01 | Two unrelated plugins can contribute Apps and both appear in navigation. | Registry, route catalog, launcher/example composition | Unit + real Loader + browser navigation evidence | Complete — real Loader and packed browser evidence |
| A-02 | `ctx.pages` contains metadata only and invalid or duplicate contributions produce deterministic diagnostics. | Contribution contract and registry validation | Unit report with valid, invalid, duplicate, withdrawal, and disposal cases | Complete — Phase 2 unit evidence |
| A-03 | `/apps/<app-id>/*` owns nested pages and a direct URL renders after root-path refresh. | History API adapter, AppFrame, SPA fallback integration | Browser deep-link and refresh artifact | Complete — direct details URL and real reload passed |
| A-04 | The App surface mounts through keyed `webpage.app` and one `shell.overlay` outlet. | Slot contribution and Webpage App Outlet | Slot integration plus keyless UI snapshot | Complete — Loader topology and browser Inspector/App evidence |
| A-05 | Leaving an App reveals the still-mounted conversation without resetting unrelated local state. | Outlet visibility and route transition behavior | Browser transition evidence | Complete — same conversation element retained across transitions |
| A-06 | Disabling or reloading a plugin withdraws/replaces its App without restarting unrelated Apps. | Cordis disposal and HMR replacement | Real Loader lifecycle + HMR logs/browser result | Complete — copied-source rebuild, successful replacement, render-crash containment, no reload, and no duplicate registration |
| A-07 | An extension plugin contributes only through a globally namespaced child slot declared and rendered by the target App; wait, collapse, re-declare, and extension-unload lifecycles are deterministic. | Keyed App slot/child declaration and example | Integration/browser lifecycle evidence; negative undeclared-extension case | Complete — Phase 4 lifecycle plus browser extension action and HMR singularity |
| A-08 | The read-only inspector identifies source Plugin (or `unknown`), route, status, categories, slot state, and recursive extension topology. | Inspector read model and UI | Unit read-model check + browser snapshot/interaction artifact | Complete — browser semantic assertions and keyless snapshot |
| A-09 | The reference App and declarative Pack example activate through existing DSH profile/bundle mechanics. | Examples, Loader entry, Pack descriptor | Packed-install and real Loader evidence | Complete — real external profile, `dump-config`, and browser evidence |
| A-10 | The supported root path is explicit; `/dsh/apps/<id>` is classified as non-App, leaves the URL unchanged, and mounts no Webpage outlet. | Route parser and browser fixture | Unit parser evidence plus browser negative-base-path artifact | Complete — URL unchanged and no App outlet mounted |

## Stop conditions and decisions

Stop implementation and record the blocker if any of the following occurs:

- an upstream DSH change appears necessary rather than an additive public-surface composition;
- a descriptor needs runtime behavior in `ctx.pages`, or App ownership cannot be derived from a stable App ID;
- duplicate IDs, disposal, or HMR replacement can silently replace another contribution;
- a route or slot requires taking over the stock shell, adding a second SPA fallback, or unmounting conversation state;
- the real Loader, packed install, or root-path browser environment is unavailable;
- evidence is flaky, incomplete, or cannot be tied to the exact toolchain pins.

Required decision record for a deviation:

```text
Decision: <short title>
Reason: <why the approved plan is insufficient>
Impact: <scope, API, compatibility, and evidence impact>
Owner/date: <name and date>
Plan/ADR update: <link or “required before implementation continues”>
```

## Documentation-update discipline

1. Treat this plan, [testing.md](../testing.md), the ADR, and the dependency map as the contract set. Before code changes, resolve contradictions here; do not silently reinterpret them in source.
2. After each phase, update its status, implementation refs, evidence refs, gate decision, and open risks in this plan. For Phases 1–5, `Complete` requires the commands and artifacts listed in the matching testing lane; Phase 0 completes by review acceptance of these documents.
3. Keep `testing.md` and the acceptance matrix synchronized. Adding or removing a behavior requires updating both the matrix row and its lane/evidence requirement.
4. Mark evidence `Planned / unverified` until a command has actually run. A green claim must include the exact command, pinned environment, result, and artifact path. A failed or unavailable command remains visible as `Blocked` or `Unverified`.
5. Record scope changes and decisions before implementation proceeds. Do not broaden 0.1 to Resources, authorization, federation, installation, or upstream modifications without an explicit approved decision.
6. Keep docs concise and link to source/test artifacts rather than duplicating implementation details. At every gate, update this plan, architecture, testing evidence, limitations, and `HANDOFF.md` to match reality; update `CONTEXT.md` only when the domain language changes, and add an ADR only for a hard-to-reverse decision.
