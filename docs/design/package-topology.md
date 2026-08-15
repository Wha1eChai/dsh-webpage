# Package topology

This document freezes the Webpage kernel workspace and publish boundary. Phase 5 verified the v0.1 reference package artifacts through a real external rc.6 profile. Phase 0.2 does not add first-party Apps to this repository: the Jobs App is an independent public plugin that peers on `@wha1echai/dsh-webpage`.

## Workspace

```text
dsh-webpage/
├── packages/
│   └── webpage/                 # @wha1echai/dsh-webpage
│       ├── src/client/registry/ # metadata service and canonical validation
│       ├── src/client/route/    # pure parser and native-History controller
│       └── tests/unit/          # package-level Registry and route suites
├── examples/
│   ├── reference-app/           # private fixture plugin
│   ├── reference-extension/     # private fixture plugin
│   ├── reference-pack/          # private dsh.bundle fixture
│   └── crash-app/               # private failure-domain demo; not a product App
├── tests/                       # cross-package Loader and packed-artifact harnesses
├── docs/
├── package.json                 # private workspace and verification scripts
├── pnpm-workspace.yaml
└── pnpm-lock.yaml
```

Only `packages/webpage` is eligible for a future public release. The root and every package under `examples/` remain `private: true`; examples are executable acceptance fixtures, not independent product packages. Ecosystem Apps are not added under `packages/` or `examples/`; they are separate repositories that depend on the published kernel contract. The Phase 0.5 flagship is the sibling checkout `dsh-usage-app`. `dsh-jobs-app` and `dsh-automations-app` remain sibling history and are not in the web profile. `examples/crash-app` is a private failure-domain fixture and must not enter the web profile.

## Runtime entries

`@wha1echai/dsh-webpage` has two runtime halves, one optional UI library, and one declarative bundle layer:

| Surface | Source | Published artifact | Module shape |
| --- | --- | --- | --- |
| Node loader | `src/index.ts` | `lib/index.js` and declarations | ESM, named `apply` only |
| Invariant companion | `src/invariant.ts` | `lib/invariant.js` and declarations | ESM, named Cordis companion exports |
| Browser client | `src/client/index.tsx` | `lib/client.js` and source map | Loader-compatible CJS factory exporting standard `apply`, `inject`, and `name` runtime values |
| Optional UI kit | `src/ui/index.ts` | `lib/ui.js` and declarations | Browser ESM wrapping DSH primitives; not a Loader factory and not part of `register()` |
| Bundle patch | `cordis.patch.yml` | unchanged package file | `dsh.bundle.patch` manifest target |

The package root exports the Node half. `exports["./client"]` resolves the built browser entry consumed by the DSH client module graph. `exports["./ui"]` is an optional kit for App authors; a consumer that imports it must keep `@deepseek-ai/dsh-client-ui-primitives` as a Loader external. An accidental default export is a package-gate failure because Loader unwrapping would change the plugin surface. Every `dsh.client` package in the accepted reference composition also exports `./package.json`; rc.6 `clientModules` resolves that manifest path while discovering the client entry.

The manifest must declare:

- `dsh.client.platform = "web"`;
- `dsh.bundle.patch = "./cordis.patch.yml"`;
- an explicit `files` allowlist containing only runtime artifacts, declarations, the patch, locale/style assets required at runtime, README, and LICENSE;
- exact DSH `0.1.0-rc.6` compatibility dependencies for the first milestone;
- Node `^22.19.0 || >=24.0.0` and `pnpm@11.7.0` at the workspace boundary.

## Build boundary

The repository owns a local tsdown client preset. It may reproduce the public artifact contract of the DSH client build but must not import build helpers from the adjacent `deepseek-harness` checkout or depend on that checkout at runtime.

The preset produces a closure bundle that hands itself to:

```ts
window.__ModuleLoader__.load({
  id: '@wha1echai/dsh-webpage',
  factory: (require) => {
    // bundled client module
    return module.exports
  },
})
```

Shared DSH modules remain external so the browser receives the shell's singleton React, Cordis, slot, runtime, and UI modules. The allowlist distinguishes static Web seeds from graph rows:

- `react`, `react/jsx-runtime`, `react-dom`, `react-dom/client`;
- `@deepseek-ai/cordis`;
- `@deepseek-ai/dsh-client-ui-slots`;
- `@deepseek-ai/dsh-client-web-react`;
- `@deepseek-ai/dsh-client-ui-primitives`;
- `@deepseek-ai/dsh-client-ui-attachment`;
- `@deepseek-ai/dsh-client-schema-form`.

`@deepseek-ai/dsh-client-runtime/client` is a separate immediately-prefetched graph-row external, not a static seed. The client build purity gate rejects any other `@deepseek-ai/*` value import unless it is an explicitly inline-safe wire module, vendored library, or generated `/remote` contribution.

Every addition to this list requires evidence that the module is seeded by the compatible DSH Web platform. CSS Modules are bundled with Lightning CSS and injected under the owning plugin identity. Product copy is supplied through DSH locale, with Chinese as the default and English as the secondary locale. Styling uses CSS Modules and `--dsw-*` semantic tokens only.

## Dependency policy

- Use `workspace:` ranges only between packages in this repository.
- Pin all `@deepseek-ai/*` packages to `0.1.0-rc.6` for v0.1; do not use caret, tilde, `next`, or `latest` ranges.
- Keep React and DSH browser-platform packages external and express their compatibility in the package manifest rather than bundling duplicate runtimes.
- Do not add a router, component library, Tailwind, persistence layer, ACL library, CRDT, Supervisor dependency, or a second plugin resolver.
- Allow dependency install scripts one package at a time. A broad pnpm build-script approval is forbidden.
- The launch-window `minimumReleaseAgeExclude` entries are exact package-and-version exceptions for the newly published rc.6 dependency closure. They do not authorize install scripts and should be removed once the configured age window expires.
- Root-only Vitest and `@vitest/coverage-v8` `4.1.8` are verification dependencies. They are absent from the publishable core manifest and tarball.

## Example composition

The reference App registers `wha1echai.reference` metadata and its keyed `webpage.app` UI entry in the same Cordis effect. It renders `/` and `/details`, plus a local unavailable/not-found state, and its exported SlotMap contract declares `wha1echai.reference.actions` as `kind: list`, `scope: root`, with owner `{ appPath: string }`. The reference extension exports its standard client `name` and waits for and contributes only to that exact child slot through `ctx.slots.inject()`. The core and reference App also export standard client `name` values for provenance/slot diagnostics; these names are not security identities. The reference Pack is an ordinary `dsh.bundle` patch that composes the core, App, and extension plugin rows; it has no runtime registry, super-plugin, or dependency resolver.

## Build and publication gates

Phase 1 proved frozen installation, build, typecheck, manifest/exports invariants, Loader handoff, and the initial exact `pnpm pack` payload before business implementation. Phase 2 added public contract declarations plus per-file 100% Registry/route coverage and updated the exact payload allowlist to 19 files. Phase 3 added the public slot/UI declarations and kept the core tarball at an exact 24-file allowlist; Loader fixtures build into disposable system-temporary directories and never enter the publish payload. Phase 4 verified the exact payloads below, workspace-range rewriting, and repository-external resolution through a disposable synthetic profile. Phase 5 extends that evidence with a fresh pinned workspace build before packing, a real external DSH `0.1.0-rc.6` CLI, isolated profile, `dsh plugin add`, ordered `dump-config`, and `./package.json` discovery for every client package. The HMR lane separately copies the Reference App source/config into the disposable profile and rebuilds each candidate with the pinned TypeScript/tsdown toolchain. Tests fail if a packed artifact resolves through a workspace path, an adjacent source checkout, stale `lib` output, or a missing client manifest export.

## Phase 4 packaging evidence

`pnpm pack:verify` passed exact tarball comparisons with these payload sizes:

| Package | Exact files |
| --- | ---: |
| `@wha1echai/dsh-webpage` | 24 |
| `@wha1echai/dsh-webpage-reference-app` | 9 |
| `@wha1echai/dsh-webpage-reference-extension` | 9 |
| `@wha1echai/dsh-webpage-reference-pack` | 5 |

The packed manifests rewrite `workspace:*` ranges. The Phase 5 real profile resolves all four tarballs and the Reference Pack patch under disposable repository-external temporary storage, installs only the top-level Reference Pack, preserves base → Web App → Pack bundle order, and reports one ordered core/App/extension row in `dump-config`. The core, reference App, and reference extension manifests export `./package.json` for rc.6 client-module discovery. This compatibility export is required by the package contract and does not warrant an ADR.
