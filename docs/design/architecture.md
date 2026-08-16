# dsh-webpage architecture

Status: v0.1 accepted. Phase 0.2 accepted. Phase 0.3 accepted. Phase 0.4 accepted (failure domain). Phase 0.5 rebuilds the Usage App as a local ledger plus provider cards; standalone cron is not a Webpage product ([ADR 0007](../adr/0007-automations-are-trigger-to-agent-loop.md)). This document describes an out-of-tree DSH Bundle. It does not require or imply any change to the DeepSeek Harness repository. Gateway product work is paused.

## Scope and ownership

The bundle gives ordinary DSH plugins a small, addressable App surface. DSH remains the installation, dependency, trust, and lifecycle system. An App is a contribution made by a plugin; it is not an installable plugin, package type, or second runtime.

The approved workspace is a private root workspace with one future-publishable core at `packages/webpage` and private fixtures at `examples/reference-app`, `examples/reference-extension`, `examples/reference-pack`, and `examples/crash-app`. Only the core may become publishable. The compatibility target is exactly DSH `0.1.0-rc.6`; a target upgrade requires a separate compatibility pass.

Phase 0 consumes no generic Resource, ACL, Space, Link, Supervisor, federation, marketplace, or second extension-registry abstraction. Those concerns are outside this architecture.

## Ownership inventory

What this bundle actually owns, stated as "remove it and what breaks", because the optional `/ui` kit is routinely mistaken for the substance:

| Owned | Removing it costs |
| --- | --- |
| Registry and identity: ID grammar, duplicate detection, deterministic ordering, immutable snapshots, provenance, withdrawal on dispose | The catalog. Launcher, Inspector, and any agent-facing enumeration lose their source of truth. This is what makes "App" a noun in the system |
| Address space: `/apps/<id>/*`, one History controller, deep links surviving refresh, explicit non-App classification | There is no place to go: no deep link, no agent-initiated open, no shareable location |
| Mounting and slot topology: one `shell.overlay` occupant, the keyed `webpage.app` declaration, URL-driven selection, owner props, App-declared extension points with enforcement | A registered component has no way to become a mounted window |
| Failure domain: per-App error boundary plus lazy body | One bad App takes the desktop with it |
| Chrome and the preservation guarantee: surfaces, Escape, History close, dialog semantics, and the conversation staying mounted with its state | Apps become full-screen interruptions instead of windows |
| Shared human/agent address space: `open_app` plus an inert suggestion card over the same `PagesService` | Agents can describe a destination but cannot take anyone there |
| The authoring contract: types, versioned guide, executable checks, template, skill | Every App reinvents the idioms and breaks independently on the next upstream bump |
| The optional `/ui` kit | Apps look inconsistent. Nothing else |

The negative space is part of the definition. This bundle owns no store or installer ([ADR 0006](../adr/0006-webpage-is-a-windowing-system-not-a-store.md)), no scheduler ([ADR 0007](../adr/0007-automations-are-trigger-to-agent-loop.md)), no runtime wrapper over Cordis ([ADR 0008](../adr/0008-contract-over-wrapper.md)), no proxy for foreign origins ([ADR 0009](../adr/0009-apps-do-not-proxy-foreign-origins.md)), no process supervision, no persistence or resource model, no authorization, and no second router.

**The removability test.** The question that decides whether a contribution oversteps is not "did it add a layer" but "does removing it leave DSH unchanged". Removing this bundle from a profile leaves the harness running exactly as before; Apps that depended on it simply stay inactive, which is Cordis's designed behavior for a missing dependency, not an invention of this project. Two concrete corollaries, both of which this project violated once and corrected: a plugin must not make its own dependencies a precondition for someone else's boot (no hard Host `inject` of optional peers), and it must not statically import an optional package on the boot path.

Failure-domain ownership follows the same line. This bundle owns the failure domain of UI it renders — a React boundary around components inside its own subtree. It does not own plugin failure: a throwing `apply()`, a client module that fails to import, or a fiber that settles FAILED belongs to Cordis and surfaces in the harness's own boot report.

`/apps` is a claimed namespace, and the claim is recorded here rather than left implicit: no upstream mechanism grants a plugin a top-level SPA path, so a future collision with an upstream `/apps` would be this project's problem to resolve. The prefix is one parser constant today; after publication it becomes a breaking change for saved links, agent conventions, and documentation.

## Public metadata contract

The browser service is exposed as `ctx.pages`. It is a dsh-webpage-owned Cordis service, not an upstream DSH service. Its public data contract is metadata-only:

```ts
interface AppDescriptor {
  id: string
  label: string
  description?: string
  order?: number
  categories?: readonly string[]
  surface?: 'overlay' | 'panel' | 'modal'
}

interface RegisteredApp extends AppDescriptor {
  sourcePlugin?: string
}

interface ObservableSnapshot<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
}

interface PagesService {
  register(descriptor: AppDescriptor): () => void
  get(id: string): RegisteredApp | undefined
  readonly list: ObservableSnapshot<readonly RegisteredApp[]>
  readonly current: ObservableSnapshot<AppRoute | undefined>
  open(appId: string, appPath?: string, options?: AppNavigateOptions): void
  close(options?: { replace?: boolean }): void
}
```

`register()` accepts only an `AppDescriptor`. It never accepts a React component, `ReactNode`, UI factory, route handler, callback, slot definition, or caller-supplied `sourcePlugin`. `surface` is an optional metadata enum (`overlay` | `panel` | `modal`); omitted values resolve to `overlay`, and any other value throws before publish. `open` / `close` / `current` wrap the single native-History `RouteController`; they are not a second router. The caller's active Cordis fiber supplies `sourcePlugin` for diagnostics when the service creates the `RegisteredApp` record. That value is provenance text, not a security identity, authorization principal, or trust decision.

The optional `@wha1echai/dsh-webpage/ui` export is a source-level kit. Importing it does not register an App and is not part of `PagesService`.

Every current browser client entry exports the standard DSH client plugin `name` for provenance and slot diagnostics: the core is `@wha1echai/dsh-webpage`, the reference App is `@wha1echai/dsh-webpage-reference-app`, and the reference extension is `@wha1echai/dsh-webpage-reference-extension`. These names do not grant authority or become an ACL identity. Aside from public type exports, the core `/client` runtime surface is `apply`, `inject`, and `name`; internal validators and route parsers remain absent. Each `dsh.client` package also exports `./package.json`, which external rc.6 `clientModules` uses to resolve the package manifest during client discovery. The packed verifier and real profile gate this compatibility requirement; it is not a new runtime abstraction or an ADR.

An App ID is a globally namespaced, lower-case ASCII URL path segment. The v0.1 grammar has at least two dot-separated segments: each segment starts and ends with `[a-z0-9]` and may contain interior hyphens. IDs therefore contain no slash, query, fragment, whitespace, uppercase character, or percent-encoded routing syntax. `wha1echai.webpage` is reserved for the read-only Inspector.

Registration validates the ID and all supplied string fields, rejects non-finite `order` values, and rejects a duplicate live ID. Missing `order` sorts as `0`; `list.getSnapshot()` is sorted by ascending order and then ascending code-unit ID. The service does not silently replace an existing contributor.

Every published snapshot is immutable. The `list` source object is stable for the service lifetime, and its snapshot reference stays stable until a real registration or withdrawal changes the contents. A successful mutation publishes the new snapshot before queuing a microtask notification. Notifications are pull-based and coalesced within a microtask; subscribers re-read `list.getSnapshot()`. A failed registration publishes nothing. The disposer returned by `register()` is idempotent and withdraws exactly its own record.

## Slot topology and UI composition

App UI is separate from metadata and composes only through DSH slots:

```text
DSH root (single, shell-rendered)
└── shell.overlay (additive list, root-scoped)
    └── dsh-webpage AppOutlet
        └── webpage.app (keyed, root-scoped, declared by AppOutlet)
            └── App component selected by App ID
                └── App-declared child slots
```

`AppOutlet` is one additive entry in the existing `shell.overlay` slot. It does not replace `root`, `ui-layout`, or the conversation surface. The outlet declares the keyed `webpage.app` child slot and renders the entry whose key equals the known App ID. A visible App plugin performs two separate contributions in one Cordis effect: it registers its descriptor with `ctx.pages`, and it registers its component in `webpage.app` with the same ID. If the declaration is not yet available, the plugin uses the DSH slot declaration-injection path; it does not bypass the slot ledger with a direct undeclared registration.

The core contributes one Apps launcher action to the existing `sidebar.footer.action` list slot. Activating it opens an anchored launch panel that lists every registered App and filters as the user types. A row click calls `ctx.pages.open(id)`. Inspector is one of those rows. The launcher does not replace the sidebar, expose plugin mutation, or maintain a second navigation registry. Scene-local controls (header actions, future slot contributions) are equally valid entries and must call the same `pages.open()`.

The Inspector App declares the list child slot `webpage.inspector.pane`. Default catalog and topology panes are in-tree contributions. Other plugins may add read-only panes through `ctx.slots.inject`; they cannot mutate the plugin tree.

The keyed slot receives immutable `AppOwnerProps` from the outlet:

```ts
interface AppOwnerProps {
  appId: string
  appPath: string
  search: string
  hash: string
  navigate(appPath: string, options?: {
    replace?: boolean
    search?: string
    hash?: string
  }): void
  close(options?: { replace?: boolean }): void
}
```

`appPath` is `/` at the App root. `navigate()` accepts only an absolute-within-App path that starts with one `/`. It rejects a second leading slash, backslashes, query or fragment delimiters in `appPath`, encoded slash/backslash, and literal or encoded `.`/`..` segments. A valid trailing slash is preserved. `search` is empty or starts with `?` and cannot contain a raw `#`; `hash` is empty or starts with `#`; omitted values clear the corresponding part. Accepted path/query/fragment input is serialized through the browser URL implementation before History and the route snapshot are updated, so the snapshot always matches the address bar (for example, spaces become `%20`). `navigate('/')` writes `/apps/<app-id>`. Invalid input throws without changing History. The operation cannot select another App or an arbitrary origin URL. `close()` returns to the most recently observed non-App DSH location, falling back to `/` after a direct App deep link.

The owner share contains no registration callback or component factory. An App declares child slots in the `children` table of its own `webpage.app` registration and renders them only through the resulting `renderSlot` capability. A public child-slot name is globally namespaced below its App ID, for example `wha1echai.reference.actions`; `webpage.*` is reserved for the core package. The reference App's contract is `kind: list`, `scope: root`, and owner `{ appPath: string }`. The App exports the SlotMap declaration as TypeScript contract, and an extension plugin uses the exact name through `ctx.slots.inject(childName, () => ctx.slots.register(...))`. If the App is not loaded, injection waits. App unload collapses the declaration, removes active extension entries, and leaves the extension waiting for a later declaration; extension unload cancels either state. A setup failure retires that injection and remains fail-loud. There is no second extension registry, global React registry, or implicit child route.

## Route data flow

`RouteController` owns only browser route observation and navigation. It reads the initial `window.location`, listens to `popstate`, and calls the native `history.pushState()` or `history.replaceState()` when a host launcher requests navigation. It never monkey-patches either History method and does not install a competing router. Controller-owned writes publish synchronously after History accepts the write; an identical route is a no-op. The Registry separately coalesces its pull-based subscriber notifications in one microtask.

The supported route grammar is root-scoped `/apps/<app-id>/*`. The App ID is the canonical path segment; the remaining path is delivered as the App-local path. Query and hash data are preserved. The controller publishes its current route as an observable snapshot, and the outlet follows this flow:

```text
location / native history
  → RouteController snapshot (also ctx.pages.current)
  → AppOutlet parses the root App route
  → ctx.pages.get(appId)
  → webpage.app keyed render with AppOwnerProps
```

Third-party plugins call `ctx.pages.open(appId, appPath)` instead of importing the controller.

For a syntactically valid App route, the outlet contributes through `shell.overlay` while the conversation remains mounted. The shell shape follows the App's `surface`: `overlay` covers the frame, `panel` slides from the side, and `modal` centers a dialog. All three use `role="dialog"`, Escape, and History `close()`. A known App renders its keyed entry. An unknown or withdrawn App ID keeps the URL unchanged and renders the Webpage unavailable view in the default overlay; it is never redirected to another App. A non-App URL renders no outlet. Leaving the App removes only the outlet contribution; it does not unmount or reset the conversation.

This release supports deployment at the origin root only. It does not infer or consume a reverse-proxy prefix such as `/dsh`; `/apps/<id>/*` is the complete supported public route namespace. Consequently `/dsh/apps/<id>` is deterministically classified as a non-App URL: dsh-webpage does not mount its outlet, rewrite the URL, or emit a runtime error. The upstream SPA fallback may still serve the DSH shell at that path, but that behavior is not subpath support.

## Lifecycle, disposal, and HMR

Metadata registration and the matching slot contribution are owned by the caller's Cordis fiber. Disposing that fiber withdraws the `RegisteredApp` record and removes the `webpage.app` entry. An extension entry is owned by its own fiber; when an App's declaration collapses, DSH removes the declared child slots and their contributions as one slot lifecycle. No contribution survives its owner.

The Inspector's topology observable is also lifecycle-owned. Its context cache entry is removed on disposal, so a core unload/reload on the same browser context receives a fresh subscription source rather than a disposed HMR relic.

Client HMR follows the rc.6 `@deepseek-ai/dsh-client-hmr` replacement lifecycle: invalidate the old module record, prefetch and register the candidate factory while the old fiber is still serving, then remove the old Loader runtime, drain its fiber, remove its owned styles, and refresh the entry. A prefetch failure happens before teardown and therefore leaves the old fiber running. After teardown, a materialization/import failure leaves the entry fiberless and an apply failure leaves a failed fiber; rc.6 explicitly has no rollback policy, so dsh-webpage must not claim that the previous App is restored. A successful replacement removes the old metadata and slot entry before the new fiber registers rather than accumulating stale entries. v0.1 does not invent state-preserving React refresh semantics. Duplicate IDs remain errors during HMR, exposing a stale-lifecycle bug instead of silently shadowing it. Phase 5 verifies only real client HMR; shared Cordis HMR remains disabled. Under rc.6, a no-cache client refetch may use the cached boot-revision URL, so acceptance is based on rebuilt bundle content, the visible replacement marker, and retained URL/document/conversation identity rather than a stable candidate hash or a hash-bearing second URL.

## Diagnostics and failure behavior

- Invalid descriptors, malformed IDs, and duplicate IDs throw at registration before publishing a snapshot. Diagnostics include the App ID and available `sourcePlugin` provenance.
- Registry and route observable notifications isolate subscriber failures: one faulty listener is diagnosed through `console.error` and cannot suppress later listeners or make a committed History write appear to fail.
- The registry never uses `sourcePlugin` as authorization, identity, or trust. Installation and access policy remain DSH concerns and are not inferred from a fiber name.
- A direct registration into an undeclared slot, a duplicate child declaration, or another DSH slot contract violation fails through the official slot machinery. Declaration injection is the supported late-binding path.
- A component render failure is isolated by `AppBoundary` around the App body. Chrome, conversation, and other Apps stay mounted. The body degrades to a crashed state with Retry; `componentDidCatch` logs the App ID and `sourcePlugin` (or `unknown`). DSH's slot renderer has a closer error boundary and leaves `data-slot-error` after it abdicates a keyed entry; `AppBoundary` treats that marker as the Outlet-owned crash face. dsh-webpage does not silently replace a crashed App with another contributor. A lazy App body may suspend; the same boundary shows a loading state until it resolves.
- A known metadata record without a live keyed UI entry renders the unavailable state rather than inventing a fallback App body. The Inspector still reports the metadata and slot mismatch.
- The Inspector at `wha1echai.webpage` is read-only. It consumes `ctx.pages.list` and `ctx.slots.snapshot('webpage.app')`, and cannot register, dispose, enable, disable, or mutate contributions. It displays `sourcePlugin` when present and the literal diagnostic value `unknown` when absent. Multiple Apps contributed by one fiber show the same provenance; no uniqueness or authorization meaning is inferred. The slot snapshot supplies declaration state, occupant state, registrant diagnostics, and the recursively declared extension topology.

## Boundaries

DSH owns Cordis fibers and effects, client module loading, HMR, the root slot, the shell layout, `shell.overlay`, and the slot registry. dsh-webpage owns the metadata registry, App ID validation and ordering, `RouteController` exposed through `ctx.pages`, `AppOutlet`, the `webpage.app` declaration, the Inspector shell, and default Inspector panes. Each App owns its route subtree and explicitly declared child slots. Ecosystem Apps such as Usage live in their own plugins and peer on this package. Jobs and Automations sibling repos are history and are not in the web profile. The crash-app fixture is a private demo only; it is not a product App and is not installed in the web profile.

No App route can take over the shell root, replace the conversation, intercept arbitrary URLs, or create a new extension authority. The package remains a normal external DSH Bundle and does not patch upstream source.

## Compatibility evidence and open risk

The audited DSH source documents the platform mechanisms used here, while this workspace installs exact `0.1.0-rc.6` client artifacts from the registry with a frozen lockfile. Phase 1 verified manifests, seeded/graph browser modules, Loader handoff, and package exports; Phase 2 exercised the installed Cordis `4.0.1` traced-service and fiber-disposal behavior. Phase 3 loaded built client entries through the rc.6 `ClientModuleSystem` and real Cordis Loader; Phase 4 adds the named reference App/extension entries and verifies their early-wait, child-slot collapse/recreation, and removal behavior through that same Loader. Phase 5 verifies fresh builds before exact tarball payloads, a real external rc.6 CLI/profile, one top-level Pack install, ordered `dump-config`, repository-external package roots, real Web/Chromium behavior, copied-source client-HMR replacement, and render-crash containment. Focused Standards/Spec re-review returned zero STOP findings. Compatibility remains limited to rc.6.
