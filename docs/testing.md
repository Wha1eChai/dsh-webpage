# dsh-webpage v0.1 testing

## Purpose and evidence status

This document defines the evidence required for the 0.1 Addressable Apps release and links completed phase records. A command's presence does not imply a pass; only a matching evidence section may change a row from `PLANNED / UNVERIFIED`.

The release environment is DSH `0.1.0-rc.6`, pnpm `11.7.0`, and Node `^22.19.0 || >=24.0.0`. The supported deployment is the root path (`/`). A non-root base path is a required negative case and is not a release target.

Use these evidence labels consistently:

- `PLANNED / UNVERIFIED`: required, but the command has not yet produced an accepted artifact.
- `COMPLETED`: command ran in the pinned environment and its output/artifact is linked. This label must never be inferred from code inspection.
- `PARTIAL`: a phase-scoped artifact is accepted, but a later required browser, HMR, profile, or release artifact is still missing.
- `BLOCKED`: the command could not run or the environment is unavailable; preserve the exact error and next retry command.

## Root command contract

The exact root scripts are:

```text
build
typecheck
lint
test:unit
test:integration
test:browser
test:hmr
pack:verify
verify
```

The commands below use those scripts. If a runner supports a focused selector, record the exact selector alongside the full root command; do not invent a new root script or treat a mocked substitute as equivalent evidence.

## Required lanes

| Lane | Command(s) | Required evidence | Status |
| --- | --- | --- | --- |
| Static and package integrity | `pnpm typecheck`; `pnpm lint`; `pnpm build` | Clean type/lint/build output; generated output is not used as a substitute for source checks | COMPLETED — included in the passing Phase 5 aggregate |
| Unit and per-file coverage | `pnpm test:unit` | Test report plus coverage report showing 100% per-file coverage for the owned implementation (statements, branches, functions, and lines, or the repository’s explicitly equivalent metrics) | COMPLETED through Phase 4 — core 44 tests; App 5; extension 2; Pack validator passed |
| Slot lifecycle integration | `pnpm test:integration` | Real SlotRegistry/Loader evidence for keyed `webpage.app`, one `shell.overlay` Outlet declaration, extension-point enforcement, disposal, declaration collapse, and reactivation | COMPLETED through Phase 4 — actual rc.6 Loader lane recorded |
| Real Loader | `pnpm test:integration` and `pnpm pack:verify` | A test log/artifact proving the bundle was loaded through the actual pinned DSH client-module and Cordis Loader path, then registered and disposed an App; mocks alone do not satisfy this row | COMPLETED — Phase 4 built-entry lifecycle plus Phase 5 real external profile, Pack install, and `dump-config` |
| Real Web shell, route, and UI | `pnpm test:browser` | Browser artifact for navigation, nested route, direct deep link, refresh, App switch, Inspector, conversation-DOM/state preservation, and the fixed-viewport keyless UI snapshot | COMPLETED — Phase 5 real Web and Chromium lane |
| Negative base path | `pnpm test:browser` | At `/dsh/apps/<id>`, assert that dsh-webpage classifies the URL as non-App, does not mount the outlet, and does not rewrite the URL. The upstream shell may render through its SPA fallback; that is explicitly not subpath support | COMPLETED — URL preserved and no App outlet mounted |
| HMR lifecycle | `pnpm test:hmr` | Before/after evidence for replacement without duplicate registration, stale slot content, or restart of unrelated Apps | COMPLETED — Phase 5 real client HMR lane; shared Cordis HMR remains disabled |
| Packed install | `pnpm pack:verify` | Package artifact plus clean-install/load evidence from the packed bundle, including the reference App and Pack example through the real Loader | COMPLETED — exact Phase 4 payloads plus real external rc.6 CLI, isolated profile, one top-level Pack install, ordered `dump-config`, and repository-external package roots |
| Aggregate release gate | `pnpm verify` | Aggregate output linking or embedding every required lane above; any skipped lane is a failed release gate until explicitly resolved | COMPLETED — full aggregate and focused independent re-review passed |

## Phase 1 evidence — workspace and build gate

The durable evidence record is [docs/evidence/phase1-verification.md](evidence/phase1-verification.md).

Run on Windows 11 with Node `v24.11.1`, pnpm `11.7.0`, and exact direct DSH dependencies at `0.1.0-rc.6`:

| Evidence | Command | Result |
| --- | --- | --- |
| Reproducible install | `pnpm install --frozen-lockfile` | COMPLETED — lockfile accepted; no install-script approval was required; exact-version release-age exceptions cover the newly published rc.6 closure |
| Types and source/package invariants | `pnpm typecheck`; `pnpm lint` | COMPLETED |
| Four workspace package skeletons | `pnpm build` | COMPLETED — core, reference App, reference extension, and reference Pack built |
| Node/client export and Loader handoff checks | `pnpm test:unit` | COMPLETED — Node namespace is named `apply` only; root, invariant, and client exports resolve |
| Actual core tarball payload | `pnpm pack:verify` | COMPLETED — exact equality with 12 allowlisted files, including client source map; no additional payload accepted |
| Phase 1 aggregate | `pnpm verify` | COMPLETED |

These results prove only the Phase 1 build/package gate. Slot/Loader composition, browser, HMR, and repository-external packed installation were supplied by the later phase records.

## Phase 2 evidence — Registry and RouteController gate

The durable evidence record is [docs/evidence/phase2-verification.md](evidence/phase2-verification.md).

| Evidence | Command | Result |
| --- | --- | --- |
| Frozen dependency graph | `pnpm install --frozen-lockfile` | COMPLETED |
| Contract and source types | `pnpm typecheck` | COMPLETED |
| Registry and route behavior | `pnpm test:unit` | COMPLETED — 24 tests across three files, including URL canonicalization and listener-failure isolation |
| Per-file coverage | `pnpm test:unit` | COMPLETED — 100% statements, branches, functions, and lines for every Registry and route implementation file |
| Static/package regression | `pnpm lint`; `pnpm build`; `pnpm pack:verify` | COMPLETED — exact 19-file core payload after adding public declaration files |
| Phase 2 aggregate | `pnpm verify` | COMPLETED for all required Phase 1–2 lanes currently included by `verify` |

The route unit suite proves that `/dsh/apps/<id>` is classified as non-App. Phase 5 browser evidence now completes T-11's mounted-outlet assertion; the later phase records also cover real Loader, browser UI, HMR, and repository-external installation.

## Phase 3 evidence — DSH client integration gate

The durable evidence record is [docs/evidence/phase3-verification.md](evidence/phase3-verification.md).

| Evidence | Command | Result |
| --- | --- | --- |
| Frozen dependency graph | `pnpm install --frozen-lockfile` | COMPLETED — 377 lockfile entries passed supply-chain policy verification |
| Product and integration types | `pnpm typecheck` | COMPLETED — workspace project references and isolated Loader test project passed |
| Core client behavior | `pnpm test:unit` | COMPLETED — 43 tests across eight files |
| Per-file coverage | `pnpm test:unit` | COMPLETED — every included executable core client file reached 100% statements, branches, functions, and lines |
| Real built-entry lifecycle | `pnpm test:integration` | COMPLETED — core, two Apps, duplicate conflict, child extension, unload, collapse, and reactivation passed through `ClientModuleSystem` and Cordis Loader |
| Static/package regression | `pnpm lint`; `pnpm build`; `pnpm pack:verify` | COMPLETED — exact 24-file core payload |
| Phase 3 aggregate | `pnpm verify` | COMPLETED for all required Phase 1–3 lanes currently included by `verify` |

This evidence completes the Phase 3 client/Loader and slot-lifecycle boundary only. Phase 5 evidence supplies the real Web shell, browser routing, conversation preservation, keyless UI snapshot, HMR candidate replacement, profile/dump-config, reference Pack, and repository-external installation results.

## Phase 4 evidence — reference App, extension, and Pack gate

The durable evidence record is [docs/evidence/phase4-verification.md](evidence/phase4-verification.md).

| Evidence | Command | Result |
| --- | --- | --- |
| Frozen dependency graph | `pnpm install --frozen-lockfile` | COMPLETED — workspace is reproducible under pnpm `11.7.0` with the pinned rc.6 dependency graph |
| Product and integration types | `pnpm typecheck` | COMPLETED — workspace, integration, and public-contract TypeScript checks passed |
| Core and fixture unit behavior | `pnpm test:unit` | COMPLETED — core 44 tests; 100% coverage at 315/315 statements, 226/226 branches, 91/91 functions, and 258/258 lines; reference App 5; reference extension 2; Pack validator passed |
| Real built-entry lifecycle | `pnpm test:integration` | COMPLETED — 2 files / 2 tests through the actual rc.6 `ClientModuleSystem` and Cordis Loader, covering built core/App/extension, early wait, shell declaration, keyed entries, child extension, App removal collapse, one-time recreation, and extension removal |
| Exact packed payloads and disposable profile | `pnpm pack:verify` | COMPLETED for Phase 4 artifact verification — core 24 files, App 9, extension 9, Pack 5; workspace ranges rewritten; all tarballs and the Pack patch resolve under a repository-external disposable synthetic profile |
| Aggregate Phase 4 gate | `pnpm verify` | COMPLETED — current typecheck, lint, build, unit/coverage, real Loader integration, and packed-artifact/profile lanes passed; independent re-review returned Standards PASS, Spec PASS, and Phase 4 GO |

The Phase 4 Pack verification profile was synthetic and disposable; the Phase 5 evidence record supersedes that boundary with a real external rc.6 CLI `plugin add` and `dump-config` run. The independent reviewer found and the implementation removed an accidental runtime React-component re-export from the extension client entry; the focused Phase 4 re-review returned no residual findings, Standards PASS, Spec PASS, and Phase 4 GO. Phase 5 aggregate verification and focused Standards/Spec re-review pass.

## Phase 5 evidence — Web, client HMR, and packed-install acceptance

The durable evidence record is [docs/evidence/phase5-verification.md](evidence/phase5-verification.md).

| Evidence | Command | Result |
| --- | --- | --- |
| Real packed profile and CLI | `pnpm pack:verify` | COMPLETED — fresh pinned workspace build before packing; exact Phase 4 payloads; external DSH `0.1.0-rc.6`; isolated `DSH_HOME`; one top-level Reference Pack; bundle order base → Web App → Pack; repository-external package roots; one ordered core/App/extension row in `dump-config` |
| Package manifest discovery | `pnpm pack:verify` | COMPLETED — core, reference App, and reference extension export `./package.json`, satisfying rc.6 `clientModules` resolution; the packed and real-profile gates regress this requirement |
| Real Web and Chromium browser | `pnpm test:browser` | COMPLETED — HTTP 200 startup, semantic onboarding handling, launcher/Inspector, App/details, deep-link reload, back/forward, unknown App, same-document conversation identity, unsupported `/dsh/apps` negative case, and fixed `1680x1000` `en-US` keyless snapshot |
| Real client HMR and App crash | `pnpm test:hmr` | COMPLETED — copied-source fixtures rebuilt with TypeScript/tsdown; success hash `3262fc0e1ea5` → `97f6418cc432`, crash hash `97f6418cc432` → `f09b24fcbb3b`; no reload, URL/document/conversation identity retained, singular registrations, and only the expected crash-boundary diagnostics |
| Phase 5 aggregate | `pnpm verify` | COMPLETED — main-thread full verify and focused independent re-review passed |

The HMR content hashes are per-run evidence, not cross-run constants: a rebuild can produce different hashes. rc.6 may refetch the client bundle through its cached boot-revision URL, so the acceptance criterion is rebuilt/changed fetched content plus the visible marker, isolated crash diagnostics, and retained URL/document/conversation identity—not a candidate hash embedded in the second request URL. Shared Cordis HMR remains disabled; only real client HMR is accepted. The final environment setup evidence is Windows 11, Node `v24.11.1`, pnpm `11.7.0`, DSH `0.1.0-rc.6`, date 2026-08-14, revision scope after `9b12462` through the commit containing the Phase 5 evidence, with frozen install passing.

`pnpm install --frozen-lockfile` is the environment setup prerequisite when a lockfile exists. Record its result and the output of `node --version` and `pnpm --version` with the lane evidence. Do not claim a completed package check if the install was not reproducible.

## Behavioral evidence matrix

| ID | Case | Lane | Minimum assertion/artifact | Status |
| --- | --- | --- | --- | --- |
| T-01 | Metadata contract | Unit | Valid metadata registers; invalid descriptors are rejected; `ctx.pages` exposes metadata rather than mount/runtime objects | COMPLETED — Phase 2 unit evidence |
| T-02 | Duplicate and withdrawal | Unit + real Loader | Duplicate App IDs produce deterministic diagnostics; dispose withdraws only the owning contribution | COMPLETED — Phase 2 unit + Phase 3 Loader evidence |
| T-03 | Two-plugin discovery | Real Loader + browser | Two unrelated plugins appear in the registry/navigation and both can be opened | COMPLETED — real Loader and packed browser evidence |
| T-04 | Nested deep link | Browser | `/apps/<app-id>/*` selects the expected nested Page after direct navigation and root-path refresh | COMPLETED — direct details URL and real reload passed |
| T-05 | Slot ownership | Slot integration + browser | App UI enters keyed `webpage.app`; exactly one Webpage outlet contributes to `shell.overlay`; no global route takeover | COMPLETED — Loader topology and browser Inspector/App evidence |
| T-06 | Conversation preservation | Browser | Leaving an App hides the outlet while the conversation remains mounted and retains its local state | COMPLETED — same conversation element retained across transitions and reload setup |
| T-07 | Extension boundary | Slot integration + browser | Early injection waits; declared extension renders; undeclared registration fails; App declaration collapse removes the entry and a later declaration reactivates it; extension unload cancels both waiting and active states | COMPLETED — Phase 4 lifecycle plus browser extension action and HMR singularity |
| T-08 | Inspector read model | Unit + browser | Inspector is read-only and shows App route, status, categories, source Plugin or `unknown`, and the live `webpage.app` extension tree | COMPLETED — browser semantic assertions and keyless snapshot |
| T-09 | HMR replacement and render failure | HMR + real Loader + browser | A rebuilt fixture replaces the owning contribution exactly once without reloading the document; a render-time App crash lands in DSH's per-entry slot boundary without unmounting the conversation. rc.6's upstream no-rollback import/apply failure policy is documented rather than redefined | COMPLETED for the accepted real client-HMR and App-crash lanes; shared Cordis HMR remains disabled |
| T-10 | Reference examples | Browser + packed install | Reference App, extension example, and declarative Pack example activate through existing DSH composition | COMPLETED — real external profile, `dump-config`, and browser evidence |
| T-11 | Unsupported base path | Browser | `/dsh/apps/<id>` remains unchanged, produces a non-App route snapshot, and mounts no Webpage outlet even if the upstream shell is served | COMPLETED — URL unchanged and no App outlet mounted |
| T-12 | UI snapshot stability | Slot integration or browser | A deterministic keyless UI snapshot covers the App outlet/inspector path without requiring a manually supplied runtime key; snapshot artifact is linked | COMPLETED — fixed viewport/locale snapshot linked in Phase 5 evidence |

## Coverage and snapshot bars

The unit lane must report 100% coverage per implementation file, not merely a project-wide average. Unless the repository defines an equivalent metric in its test configuration, require 100% statements, branches, functions, and lines for each owned source file. Generated files, fixtures, and test-only helpers may be excluded only when the coverage report states the exclusion.

The UI snapshot must be keyless and deterministic: it must exercise the App outlet or inspector without depending on an ad hoc component key, generated identifier, wall clock, or network response. If the test framework serializes a framework-generated key, document that serializer behavior and keep the application contract keyless. A snapshot diff or a missing snapshot artifact leaves the lane unverified.

## Evidence record template

Create one record per lane in the phase evidence area or CI artifact index:

```text
Lane/ID: <for example: real Loader / T-03>
Status: <PLANNED / UNVERIFIED | COMPLETED | BLOCKED>
Environment: DSH 0.1.0-rc.6; Node <version>; pnpm 11.7.0; OS <value>
Command: <exact command, including supported selector if used>
Result: <pass/fail/blocked and relevant counts or diagnostic>
Artifact: <log/report/screenshot/package path or link>
Date/revision: <date and source revision; no commit is required for this planning phase>
Notes: <known flake, exclusion, or follow-up>
```

Completed evidence must be reproducible from the recorded command and artifact. For a blocked lane, preserve the exact blocker and add the next concrete retry command. Never convert `BLOCKED` or `PLANNED / UNVERIFIED` to `COMPLETED` based on review alone.

## Release decision

The v0.1 verification gate is green only when:

- static/package checks, unit tests, slot integration, real Loader, browser, HMR, and packed-install lanes are `COMPLETED`;
- the behavioral cases cover the acceptance matrix in [phase-0.1-addressable-apps.md](plan/phase-0.1-addressable-apps.md);
- every owned implementation file meets the per-file 100% coverage bar;
- the keyless UI snapshot is stable and linked;
- the negative base-path result is explicit and does not expand the supported deployment contract; and
- `pnpm verify` passes with no skipped required lane.

Those implementation, aggregate, and independent-review conditions are evidenced. The public v0.1 source-release decision is `GO`; npm publication remains out of scope.
