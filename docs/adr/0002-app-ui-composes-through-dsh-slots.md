# ADR 0002: App UI composes through DSH slots

Status: Accepted for dsh-webpage v0.1.

## Context

An App needs two related but different contributions: metadata for navigation, discovery, ordering, classification, and the read-only Inspector; and UI for the App's route. DSH already provides a Cordis lifecycle and a typed slot registry. A second UI registry inside `ctx.pages` would create a competing ownership path and would make the metadata service depend on React.

The dsh-webpage bundle is private and out of tree. Its public registration API must remain usable by metadata-only consumers and must not require a UI runtime, while App UI must still be removed with the contributing plugin during disposal and HMR.

## Decision

`ctx.pages` is metadata-only. Its `register()` operation accepts exactly an `AppDescriptor`:

```ts
interface AppDescriptor {
  id: string
  label: string
  description?: string
  order?: number
  categories?: readonly string[]
}
```

`register()` does not accept a component, `ReactNode`, UI factory, route handler, callback, slot definition, or `sourcePlugin`. The service derives optional `sourcePlugin` provenance from the caller's Cordis fiber when it builds `RegisteredApp`; provenance is diagnostic metadata and is not a security identity.

App UI is registered separately through the official DSH slot service in the same Cordis effect that registers metadata. The App component occupies the root-scoped keyed `webpage.app` slot under the App ID and receives `AppOwnerProps` from the outlet. `AppOutlet` is an additive entry in the existing `shell.overlay` slot, so the App covers the AppFrame without replacing the DSH root or unmounting conversation. If the keyed slot is not declared yet, the plugin uses DSH slot declaration injection.

An App may declare child slots as part of its own DSH slot registration. Extensions contribute only to those declared child slots. This is the only App extension mechanism; dsh-webpage does not add a second extension registry.

`RouteController` remains separate from metadata registration. It uses native History API calls and `popstate` without monkey-patching browser history, handles only `/apps/<app-id>/*` at the origin root, and preserves unknown URLs. The Inspector is the read-only App `wha1echai.webpage`.

## Consequences

The metadata API can be consumed by navigation, catalog, and diagnostics without importing React or mounting UI. The UI path inherits DSH's slot typing, declaration ownership, error reporting, and fiber disposal. Metadata and UI contributions share one plugin lifetime, so disposal and HMR remove both and do not leave stale App IDs or keyed entries.

The separation also makes incomplete composition visible: metadata can exist without a keyed UI entry, and the outlet does not invent a fallback component. A plugin author must keep the descriptor ID and keyed slot ID aligned, and must use declaration injection when App activation order is independent from the outlet. This is an intentional assembly obligation rather than an implicit registry rule.

App components receive route data plus App-relative `navigate()` and shell-returning `close()` operations through `AppOwnerProps`, not through registration-time callbacks. These owner-supplied operations cannot register UI or claim another App's route, and they do not change the metadata contract. A valid App URL for an unavailable App remains unchanged while the outlet displays an unavailable state; non-App URLs remain the host's concern.

The design intentionally excludes generic Resources, ACLs, Spaces, Links, Supervisor integration, and untrusted-code isolation. Those abstractions would add authority or persistence semantics that v0.1 does not need.

## Rejected alternatives

| Alternative | Reason rejected |
| --- | --- |
| `ctx.pages.register(descriptor, Component)` | Couples discovery to React, creates one registry with two lifecycles, and prevents metadata-only consumers. DSH slots already own UI composition and disposal. |
| A ReactNode, render function, or UI callback in `register()` | Hides composition and route ownership in an imperative callback, weakens slot typing, and makes HMR/disposal harder to audit. |
| A route handler or router object in `register()` | Makes `ctx.pages` a second router and lets individual Apps claim arbitrary URLs. v0.1 has one native-History controller and one `/apps/<id>/*` root namespace. |
| A global App extension registry | Duplicates DSH's slot authority and permits contributions to undeclared surfaces. App-owned child slots already express declaration, render authorization, and lifecycle. |
| Replacing `root` or `ui-layout` with an App shell | Breaks additive integration and couples every App to the shipped shell. `shell.overlay` provides the required AppFrame coverage while keeping conversation mounted. |
| Treating `sourcePlugin` as an identity or ACL principal | A fiber name is useful for diagnostics but does not establish caller authority, authentication, or trust. Those decisions remain outside this metadata contract. |
