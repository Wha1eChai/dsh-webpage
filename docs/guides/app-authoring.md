# Authoring a Webpage App

An App is an addressable contribution made by an ordinary DSH plugin. Installation, versioning, trust, and lifecycle stay with the plugin. This page is the operational contract; [ADR 0001](../adr/0001-apps-are-plugin-contributions.md) and [ADR 0006](../adr/0006-webpage-is-a-windowing-system-not-a-store.md) are the norms.

Target: DSH `0.1.0-rc.6`. Peer `@wha1echai/dsh-webpage` at `0.1.0`.
Contract version: 1. A DSH target bump raises this number; re-run the conformance checks instead of re-reading kernel source ([ADR 0008](../adr/0008-contract-over-wrapper.md)).

## 1. Register metadata only

```ts
ctx.pages.register({
  id: 'acme.usage',
  label: 'Usage',
  description: 'Provider usage and balances.',
  order: 20,
  categories: ['ops'],
  surface: 'panel',
})
```

`register()` accepts only this descriptor. It does not take a React component, factory, or `sourcePlugin`. Contribute the body separately on the keyed `webpage.app` slot with the same `id` as `key`.

App IDs are two-or-more lower-case dotted segments (`acme.usage`). Duplicate live IDs throw.

## 2. Pick one surface

`surface` is `'overlay' | 'panel' | 'modal'`. Omitted means `overlay`.

| Surface | When |
| --- | --- |
| `panel` | Conversation should stay visible (Jobs, usage, boards). |
| `overlay` | Full-frame work (Inspector, large workbenches). |
| `modal` | Short confirmation or picker. |

The Outlet owns chrome, Escape, History `close()`, and `role="dialog"`. Do not add a second "Close app" control inside the body.

## 3. Lazy body

Register a `React.lazy` body so the App module is not required to run at boot:

```ts
const UsageApp = lazy(async () => {
  const module = await import('./UsageApp.js')
  return { default: module.UsageApp }
})

ctx.slots.inject('webpage.app', () => ctx.slots.register({
  name: 'webpage.app',
  key: 'acme.usage',
  locale: 'usage',
}, UsageApp))
```

The DSH client bundle is a single Loader factory (`lib/client.js`). tsdown must set `codeSplitting: false` so the dynamic import stays inside that file. Async chunks are not Loader-compatible. `React.lazy` is still the source contract: Webpage wraps the body in `Suspense` and an error boundary.

## 4. Failure domain

A throwing App body degrades to "App crashed" with Retry. Chrome, the conversation, and other Apps stay up. `componentDidCatch` logs the App ID and `sourcePlugin`. DSH's slot renderer may catch first and leave `data-slot-error`; Webpage still shows the same crash face.

This is the promise: a crashed App is a closed window, not a bricked desktop. Do not throw from `apply()` or from a boot-path plugin. Throw only from the lazy body, after `register()` has succeeded.

## 5. Pack hygiene

The App's `cordis.patch.yml` inserts **only its own row**:

```yaml
- insert:
    - id: usage-app
      name: '@acme/dsh-usage-app'
```

Do not override `webpage`, `ui-layout`, or any official core loader id. Do not insert `@wha1echai/dsh-webpage` from an App pack (that duplicates `id: webpage`). Webpage is a file dependency plus override, not a second bundle row from the App.

## 6. Locale and kit

Register Chinese and English dictionaries through `ctx.locale`. Chinese is the default.

`@wha1echai/dsh-webpage/ui` is optional (`AppPage`, `AppList` / `AppRow`, `AppEmpty`, `AppFields`, `AppActions`). Import it as a value; every other `@wha1echai/dsh-webpage` specifier stays type-only. The kit is not an argument to `register()`.

## 7. Host half

An App may ship a Host half (loopback HTTP routes, ledgers, keys). Keys and durable state never go to the browser.

Reading `ctx.webServer` as a property without declaring `inject` throws `cannot get property "webServer" without inject`. Soft-read host services with `ctx.get('name')` inside try/catch instead:

```ts
function webServerOf(ctx: UsageHostContext): WebServerFace | undefined {
  try {
    const value = ctx.get?.('webServer')
    return isWebServer(value) ? value : undefined
  } catch {
    return undefined
  }
}
```

Do not hard-export `inject = ['webServer', …]` of host peers from the Node entry. A missing peer leaves the whole plugin pending. Client-side `inject = ['pages', 'slots', 'locale']` is different: those are the hard dependency on the webpage graph and are correct.

A one-shot `ctx.get('webServer')` races the server's `listen()`. Wait with `ctx.inject(['webServer'], inner => { … })` inside `apply()`:

```ts
export function apply(ctx?: UsageHostContext): void {
  if (ctx === undefined) return
  try {
    if (typeof ctx.inject === 'function') {
      ctx.inject(['webServer'], inner => {
        registerUsageRoutes(inner)
      })
      return
    }
  } catch (error) {
    ctx.logger?.warn(`wha1echai-usage: inject webServer failed: ${String(error)}`)
  }
  registerUsageRoutes(ctx)
}
```

No-op without `ctx`. Try `inject`, then fall back to direct registration. Never throw. `apply()` never throws; see [§4](#4-failure-domain).

The loopback fence and JSON helpers in `dsh-usage-app/src/http.ts` are a reference implementation, not part of the contract. One consumer; rule of three per [ADR 0008](../adr/0008-contract-over-wrapper.md).

## 8. Heavy service Apps

An App that manages a local binary or daemon splits into two halves that never merge:

| Half | Owns |
| --- | --- |
| Host | Install, start, stop, credentials, readiness, allowlisted loopback routes or Typert remotes |
| Window | Current state, the next action, a linear first run — not a vendor management console |

First run is App-internal state, not a new `surface`. Shape it as a stepper in `/ui` (see [ui-kit-gaps](../research/ui-kit-gaps.md)): install/start → authenticate → apply configuration → one probe that proves the service works → dismiss. Advanced pages come later and separately. A wizard layered on an existing multi-page console is a symptom, not a fix ([heavy-service-apps](../research/heavy-service-apps.md)).

### Host-to-window transport

Pick by criteria, not by mandate:

| Channel | Prefer when | Tradeoffs |
| --- | --- | --- |
| Typert Remote | Typed, closed-set RPC; mutations with structured errors | Code generation; couples to the remote registry; scope creep shows up as remote count |
| Host `webServer.register` + loopback fence | Read-heavy JSON, streaming, plain `fetch` from the browser | App writes its own fence; see `dsh-usage-app/src/http.ts` + `src/index.ts` (**reference**, not contract — rule of three) |

Many remotes for a short golden path is a scope problem, not a transport problem.

### Agent tools

The kernel ships one platform tool: `open_app` in `packages/webpage/src/tools.ts`. Tools registered on the Host land in the global agent catalog every session sees. Do not mint per-App tool sets; ask for a kernel capability instead ([heavy-service-apps](../research/heavy-service-apps.md), consensus item 6).

### Foreign origins

An App must not proxy or mount a foreign HTTP server into the DSH origin — not a managed subprocess console, not a remote service. Host-owned routes only. See [ADR 0009](../adr/0009-apps-do-not-proxy-foreign-origins.md).

Cordis traps for the Host half stay in [§7](#7-host-half).

## 9. Run the conformance checks

Every App repo carries `--lint` / `--pack` checks (today `scripts/check.mjs`, being extracted to `@wha1echai/dsh-app-check`, whose major version tracks this contract version). `--pack` asserts the packed tarball equals an exact allowlist. The allowlist is per-repo config, not doctrine.

`packageManager` is pinned `pnpm@11.7.0`. Nested `pnpm run` on some machines resolves pnpm `11.0.9`; the check scripts fall back through Corepack. Do not produce release tarballs with a mismatched pnpm.

Testing:

- Vitest needs the `stub-plain-css` pre-plugin (plain `.css` → `export default {}`).
- Set `server.deps.inline` for `@deepseek-ai/dsh-client-ui-primitives`, `katex`, and `@wha1echai/dsh-webpage/ui`. Importing DSH primitives pulls katex CSS.
- Coverage thresholds are the App's own choice, not contract.

```ts
plugins: [{
  name: 'stub-plain-css',
  enforce: 'pre',
  resolveId(source) {
    if (source.endsWith('.css') && !source.includes('.module.css')) return '\0stub-plain-css'
  },
  load(id) {
    if (id === '\0stub-plain-css') return 'export default {}'
  },
}],
test: {
  server: {
    deps: {
      inline: ['@deepseek-ai/dsh-client-ui-primitives', 'katex', '@wha1echai/dsh-webpage/ui'],
    },
  },
},
```

## 10. Publish checklist

- No `prepare` / install build script on the published package if you can avoid it (`allowBuilds` friction).
- Manifest declares `dsh.client.platform: web`, `dsh.bundle.patch`, and `exports["./package.json"]`.
- `files` allowlist is explicit; do not ship `src`.
- README states the App ID, surface, and that the pack inserts only this plugin.
- Peer DSH packages pinned to `0.1.0-rc.6`.
- Client bundle is one `lib/client.js` Loader factory; no extra chunks.
- Removing the package removes the launcher row and nothing else.
