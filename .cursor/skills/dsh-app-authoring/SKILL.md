---
name: dsh-app-authoring
description: >-
  Orient agents working on dsh-webpage or building a Webpage App: what the
  App platform offers, the authoring contract, and the conformance workflow.
  Use when creating or modifying a DSH Webpage App, registering pages/slots,
  writing an App Host half, packing an App tarball, or when the user mentions
  Webpage Apps, pages.register, App surfaces, cordis.patch.yml, dsh-app-check,
  or the /apps address space.
---

# Authoring DSH Webpage Apps

dsh-webpage is a windowing system for the DeepSeek Harness, not a store and not a second plugin runtime. An App is a contribution made by an ordinary DSH plugin: it owns `/apps/<app-id>/*`, opens from the launcher, and can be suggested by session agents through the `open_app` tool. Humans and agents share the same address space.

**Single source of truth:** [docs/guides/app-authoring.md](../../../docs/guides/app-authoring.md) — the versioned authoring contract (currently contract version 1, DSH `0.1.0-rc.6`). This skill routes; the guide rules. If they disagree, the guide wins.

## Decide your path

- **Building or changing an App** (usually a sibling repo like `../dsh-usage-app`) → follow the workflow below.
- **Changing the kernel** (`packages/webpage`) → higher bar: 100% per-file coverage, boot-path safety, exact packed allowlists in `scripts/phase1-check.mjs` and `scripts/phase4-pack-verify.mjs`. Read [docs/design/architecture.md](../../../docs/design/architecture.md) first.
- **Just exploring what the platform can do** → read the capability menu, then [docs/plan/roadmap-2026-08.md](../../../docs/plan/roadmap-2026-08.md).

## Capability menu

| The platform gives an App | How |
| --- | --- |
| A stable address `/apps/<id>` surviving refresh and deep links | `ctx.pages.register(descriptor)` — metadata only |
| A launcher row and Inspector entry | Same registration; no extra work |
| Window chrome: `overlay` / `panel` / `modal`, Escape, History close | `surface` field on the descriptor |
| Crash isolation: a crashed App is a closed window | Automatic (`AppBoundary`); never throw from `apply()` |
| Agent reach: session agents suggest opening the App via a card | `open_app` tool ships with the kernel; nothing to do per App |
| Cross-App links | `pages.open(id, path)` — the URL is the data channel |
| UI kit | optional `@wha1echai/dsh-webpage/ui` value import |
| Extension points for other plugins | App-declared child slots |

The platform deliberately owns **no** store, scheduler, resource model, or runtime HTTP helpers (ADR [0006](../../../docs/adr/0006-webpage-is-a-windowing-system-not-a-store.md), [0007](../../../docs/adr/0007-automations-are-trigger-to-agent-loop.md), [0008](../../../docs/adr/0008-contract-over-wrapper.md)). App Host halves talk to DSH host services directly.

## Do not reinvent wheels

An App's own job is **design tokens and layout**. Widget internals are someone else's job. Agents default to hand-rolling; resist it in this order.

**1. Platform primitives — always, for anything they cover.** `@deepseek-ai/dsh-client-ui-primitives` exports `Button` (`ButtonVariant`), `Pill`, `Input`, `StateDot` (`StateDotState`), `Tooltip`, `HoverCard`, `Modal`, `Menu`, `DisclosureRow`, `JsonTree`, `CodeBlock`, `MarkdownText`, and an icon set. Structure comes from `@wha1echai/dsh-webpage/ui` (`AppPage`, `AppList`/`AppRow`, `AppEmpty`, `AppFields`/`AppField`). Both are Loader externals: zero bundle cost and automatic theme fidelity. Verify prop shapes in `deepseek-harness/packages/client/ui-primitives/src/*.tsx`. A hand-rolled button, dot, pill, or tooltip is a defect, not a style choice.

**2. Theme tokens, never literal colors.** Only `--dsw-alias-*` names defined in `deepseek-harness/packages/client/ui-theme/src/styles/design-platform.css`. Read the dark-theme block too — every choice must hold in both. Semantic families: `state-business-primary` / `-tertiary` (accent), `state-success-primary`, `state-error-primary` / `-secondary`, `label-primary` / `-secondary` / `-tertiary` / `-caption` / `-dimmed`, `border-l1`..`l4`, `interactive-bg-hover` / `-active` / `-hover-danger`. Trap: in the light theme `bg-layer-1`, `-layer-2`, and `-layer-3` all resolve to the same white — depth must come from borders and spacing, never from swapping layer tokens.

**3. A mature third-party component only for a non-trivial widget the platform lacks** (charts, heatmaps, virtualized lists). It must pass every criterion: MIT/BSD/Apache-2.0 with attribution in `NOTICE` (add it to `files` and to `packedAllowlist`); React 18.3.1 with no peers beyond react/react-dom; small and dependency-light; themeable through our tokens with no CSS-in-JS runtime; able to carry the App's `data-*` test hooks; and **not** `@mui/*`, `tailwindcss`, or `react-router` — the checker's `noForbiddenUi` flag hard-fails those.

Mechanics: add it as a **devDependency**. The tsdown preset inlines anything outside `CLIENT_EXTERNALS` into the single `lib/client.js`, so consumers never install it, `dsh.client.inject` / `expectedClientInject` stay untouched (those are for DSH client-plugin graph modules only), and `--pack` still passes because a correctly inlined library emits no `require()`.

**4. If nothing passes the gate, keep plain markup.** Tokens plus layout on plain elements beat a bespoke mini-framework.

## App workflow

```
Progress:
- [ ] 1. Read the contract: docs/guides/app-authoring.md (all sections)
- [ ] 2. Copy a working shape
- [ ] 3. Client half: descriptor + lazy body, dual registration
- [ ] 4. Host half (only if you need keys/ledgers/routes): follow guide §7 exactly
- [ ] 5. Wire dsh-app-check and make --lint / --pack green
- [ ] 6. Unit tests green; pack the tarball
```

**Step 2 — exemplars (sibling checkouts):**

- `../dsh-usage-app` — full App with a real Host half (loopback HTTP, credentials, incremental fold). The canonical Host-half reference.
- `../dsh-jobs-app` — client-only App, already migrated to `dsh-app-check`; the strictest config.
- `examples/reference-app` — in-repo client skeleton (acceptance fixture, `private: true`; copy patterns, do not publish it).

**Step 5 — conformance feedback loop:**

```bash
node scripts/check.mjs --lint   # thin wrapper over @wha1echai/dsh-app-check
node scripts/check.mjs --pack   # packs and diffs against the exact allowlist
```

Fix and re-run until green. Per-repo config lives in `dsh-app-check.config.mjs` (name, expectedClientInject, packedAllowlist, require flags). Kit major version = contract version.

## Traps that burn agents

| Trap | Rule |
| --- | --- |
| `ctx.webServer` read as a property without `inject` **throws** | Soft-read host services with `ctx.get('name')` in try/catch |
| One-shot `ctx.get('webServer')` races `listen()` | Wait with `ctx.inject(['webServer'], inner => { … })` inside `apply()` |
| Hard `export const inject = ['webServer', …]` on the Node entry | Never — a missing peer leaves the whole plugin pending. Client `inject = ['pages', 'slots', 'locale']` is correct and different |
| Static Host import of an optional DSH package | Load lazily via dynamic `import()` in the registration path; missing package must warn and skip, not fail module load |
| Async chunks in the client bundle | `codeSplitting: false` in tsdown; one `lib/client.js` Loader factory |
| Patch overrides core rows | `cordis.patch.yml` INSERTs only your own row; never touch `webpage` / `ui-layout` / official ids |
| Throwing from `apply()` | Never; throw only from the lazy body after registration |
| Nested `pnpm run` resolves pnpm 11.0.9 | Use `corepack pnpm@11.7.0` or `node scripts/…`; never pack releases with a mismatched pnpm |
| GNU tar (Git) rejects `C:\…` absolute paths | List archives from their directory with basename (the kit already does) |
| Vitest pulls katex CSS via DSH primitives | stub plain `.css` + `server.deps.inline` for primitives/katex/`/ui` |
| Inline type imports from `react` break the coverage remapper | Use separate `import type { … } from 'react'` files/forms the repo already uses |

## Verification bar

An App ships when: unit tests pass with the repo's declared coverage thresholds, `--lint` and `--pack` are green, the tarball installs into a profile, and the App opens from the launcher with the conversation still mounted. Evidence conventions: [docs/testing.md](../../../docs/testing.md).

## Deeper references (read when relevant)

- Agent tool surface and Host↔browser seams: [docs/research/agent-tool-surface-rc6.md](../../../docs/research/agent-tool-surface-rc6.md)
- Host API shapes (webServer / credentials / sessionPersistence): [docs/evidence/phase-0.5-usage-api-spike.md](../../../docs/evidence/phase-0.5-usage-api-spike.md)
- Kit extraction and per-repo config schema: [docs/research/conformance-kit-extraction.md](../../../docs/research/conformance-kit-extraction.md)
- Domain language (App, Contribution, Pack, Surface…): [CONTEXT.md](../../../CONTEXT.md)
