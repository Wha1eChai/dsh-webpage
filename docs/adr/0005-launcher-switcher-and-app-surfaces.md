# ADR 0005: Launcher is a switcher; surfaces are metadata; `/ui` is optional

Status: Accepted for dsh-webpage 0.3.

## Context

v0.2 made the sidebar Apps control open the Inspector (`ctx.pages.open('wha1echai.webpage')`). That is the wrong user model for an OS-like module host: the global entry should discover and switch Apps, not dump the operator into a diagnostic page. Inspector remains a first-class App; it is no longer the launcher destination.

Apps also need more than one chrome shape. A job list should keep the conversation visible; a full-screen diagnostic can cover it. The container is an App property, not a second router.

Third-party Apps were assembling one-off layout chrome on `--dsw-*` tokens. The kernel should offer an optional component kit so Jobs and later Apps can look native without putting React into `register()`.

## Decision

1. **Switcher, not Inspector.** The sidebar Apps control opens an anchored launch panel: the full App list is visible immediately, a filter box narrows it, and a row click calls `ctx.pages.open(id)`. Inspector is an ordinary row. Scene-local entries (for example the Jobs header button) remain valid and also call `pages.open()`. Cmd+K and action contributions are later slices; the panel shape already accepts them.

2. **`surface` is descriptor metadata.** `AppDescriptor.surface` is `'overlay' | 'panel' | 'modal'`, default `'overlay'`. `register()` stays metadata-only. `AppOutlet` reads the live route plus the registered descriptor and selects one of three shells. All three share the single `RouteController`, History close, Escape, and `role="dialog"`. Unknown Apps keep the default overlay unavailable state. Conversation `[data-conversation-scroll]` stays mounted.

3. **`@wha1echai/dsh-webpage/ui` is optional.** The kit (`AppPage`, `AppList` / `AppRow`, `AppEmpty`, `AppFields`, `AppActions`) wraps DSH primitives and `--dsw-*` tokens. It is not an argument to `register()`, not a second slot system, and not required to contribute an App. Inspector panes and the launch panel are the first in-tree consumers.

This revises the ADR 0004 sentence that the launcher only opens Inspector, and the ADR 0003 sentence that the launcher is `pages.open('wha1echai.webpage')`.

## Consequences

Humans discover Apps through the launch panel or a scene-local control; both paths hit the same operate API. An App author picks a surface with one string. Visual consistency is opt-in through `/ui`.

## Rejected alternatives

| Alternative | Reason rejected |
| --- | --- |
| Empty command palette that waits for typing | With 2–5 Apps there is nothing to search; a default-full list is the menu. |
| One overlay-only container | Jobs and similar tools need the conversation visible. |
| Surface as a React prop or slot child | Would put UI into `register()` or split chrome from metadata. |
| A required design system in `register()` | Breaks the metadata-only red line; kit use stays a source import. |
