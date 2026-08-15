# ADR 0006: Webpage is a windowing system, not a store

Status: Accepted for dsh-webpage 0.4 planning.

## Context

By 2026-08-15 the community had built a dozen plugin storefronts in two days. Official discovery remains the GitHub topic `dsh-plugin`; the reusable installable feed is awesome-dsh-plugin's `plugins.json` (548 entries); most in-app "Plugin Market" UIs are skins of that feed, and every honest one ultimately re-invokes `dsh plugin add` ([ecosystem synthesis](../research/dsh-plugin-ecosystem-2026-08-15.md)).

The pressure on this project was to become another catalog: index community plugins, list them as Apps, add badges. The ecosystem research shows that would duplicate existing storefronts, inherit topic spam (~3,000 tagged repos, many not plugins), and turn Webpage into a second plugin manager — the exact failure ADR 0001 forbids.

Separately, the sharpest operational pain in the ecosystem is boot-path fragility: a bundle that overrides a core loader row (`webpage`, `ui-layout`), or a client `apply()` that throws at startup, can brick the next `dsh web` boot. Whether a package is official or community does not matter; being on the boot path does.

## Decision

The role split is fixed as four layers, and Webpage owns exactly one of them:

| Layer | Analogy | Owner |
| --- | --- | --- |
| DSH harness | kernel + package manager | official (`dsh plugin` / pnpm / profiles) |
| Plugin markets | app store / package source | community (dsh-market and siblings) |
| **dsh-webpage** | **windowing system / desktop** | **this project** |
| Apps | programs (exe) | anyone, out of tree |

1. **The launcher is a Start menu, not a catalog.** It lists exactly the Apps registered through `ctx.pages.register()` in the running profile. Webpage never indexes the GitHub topic, never reads market feeds, never mints a launcher row for a plugin that did not register an App.

2. **No store surface, ever.** No Webpage-owned installer, crawler, scanner, "verified App" badge, or writes to `allowBuilds` / `dsh.profile.bundles` / loader `disabled` flags. Module discovery and install stay with markets and `dsh plugin`.

3. **Apps must live in a shallower failure domain than boot-path plugins.** `register()` stays metadata-only (already true). The App body must be loaded lazily on open and be wrapped in an error boundary: a throwing App degrades to the existing unavailable state while the shell, the conversation, and other Apps keep running.

4. **Pack hygiene is part of the App contract.** An App's bundle patch inserts only its own rows. Overriding core loader ids (`webpage`, `ui-layout`, official core rows) is a contract violation, documented in the authoring guide; mechanical enforcement is a later host-side concern.

5. **First-party Apps stay minimal.** The kernel ships with Jobs (exemplar) and Inspector (a row, not the entry). Integrating community modules into user-facing programs is App-author work, out of tree.

## Consequences

Adoption is supply-side: the project grows by making the App contract cheap to adopt (kit, reference app, a one-page authoring guide), not by enumerating the ecosystem. Users encounter Webpage through Apps that carry their own value; markets remain where modules are installed.

A crashed App is a closed window, not a broken desktop. Removing an App package removes launcher rows and nothing else.

## Rejected alternatives

| Alternative | Reason rejected |
| --- | --- |
| Index community catalogs in the launcher | Recreates the topic dump inside Apps; duplicate of existing storefronts; spam inheritance. |
| Webpage-owned install/enable/disable | A second plugin manager; observed markets doing this are already brick-prone (duplicate ids, unpinned HEAD, allowBuilds writes). |
| "Verified App" badge | Every existing badge is signal theater (README inspection, manifest presence, regex scans); none are signatures. Another badge adds theater, not trust. |
| Shipping a first-party App suite | Centralizes what the ecosystem should own; contradicts the exe/module split and ADR 0001. |
