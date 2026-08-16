# ADR 0004: Inspector panes are list-slot contributions

Status: Accepted for dsh-webpage 0.2.

## Context

The v0.1 Inspector was a single core component: catalog cards and topology tree lived in one file, and the `webpage.app` registration declared no children. Other plugins could not add diagnostics, filters, or “open in…” actions. The Inspector is App *management*, so it stays in the Webpage kernel, but its body must follow the same contribution rules as any App.

## Decision

The Inspector App `dshapps.inspector` declares a list child slot `webpage.inspector.pane` (`kind: list`, `scope: root`, owner `{ appPath: string }`). The Inspector shell only renders chrome and `renderSlot('webpage.inspector.pane', owner)`. Default catalog and topology views are in-tree pane contributions registered by the core plugin. The Inspector remains read-only: panes cannot install, enable, disable, or mutate plugins.

The sidebar launcher does not render a private catalog. After ADR 0005 it opens a list+filter launch panel; Inspector is an ordinary row in that panel, not the launcher destination.

## Consequences

A later plugin can add an Inspector pane through `ctx.slots.inject('webpage.inspector.pane', …)` without forking Webpage. Extracting the Inspector to a third repository is not required for this slice.

## Rejected alternatives

| Alternative | Reason rejected |
| --- | --- |
| A Webpage-owned inspector framework | Duplicates DSH list slots. |
| Mutation UI (enable/disable/install) | `pluginInventory` is read-only; install stays on `dsh plugin`. |
| Replacing the Inspector keyed occupant from another plugin while core is loaded | Duplicate App IDs remain errors. |
