# ADR 0003: Publish App navigation on `ctx.pages`

Status: Accepted for dsh-webpage 0.2.

## Context

v0.1 kept `RouteController.open` / `close` / `current` inside the core client `apply()` closure. Only the Inspector inject and the sidebar launcher could navigate. Third-party Apps, header actions, and later Host remotes had no public operate API without importing a private controller or forcing a full document load.

`ctx.pages.register()` must remain metadata-only. Navigation is a separate operate surface on the same service, not a second router and not a React callback on `register()`.

## Decision

Extend the public `PagesService` with:

- `current`: the existing RouteController snapshot;
- `open(appId, appPath?, options?)`: the existing controller `open`;
- `close(options?)`: the existing controller `close`.

There is still one native-History controller and one `/apps/<id>/*` grammar. `register()` still rejects components, routers, and caller-supplied `sourcePlugin`. App-local `navigate()` remains on `AppOwnerProps` and cannot change App ID.

## Consequences

Any plugin that injects `pages` can open or close an App without importing Webpage internals. Scene-local controls and the ADR 0005 launch panel both call `ctx.pages.open(id)`. Host remotes and model tools can wrap this later; they are out of this slice.

## Rejected alternatives

| Alternative | Reason rejected |
| --- | --- |
| A second `ctx.route` service | Splits App catalog from App navigation and duplicates disposal. |
| Putting `open` on `register()` | Couples discovery to routing and reintroduces callbacks in metadata. |
| History monkey-patch | Breaks the v0.1 controller contract. |
| Replacing `root` / `sidebar` | DSH additive-slot rule. |
