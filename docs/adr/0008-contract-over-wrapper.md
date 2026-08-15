# ADR 0008: Contract over wrapper — the platform ships discipline, not a runtime

Status: Accepted for dsh-webpage 0.6 planning.

## Context

The DSH plugin ecosystem programs against raw Cordis seams. Phase 0.5 hit the sharp edges first-hand: reading `ctx.webServer` without `inject` throws, a one-shot `ctx.get('webServer')` races `listen()`, `codeSplitting: false` is required for the Loader, and a bad boot-path patch bricks `dsh web`. Community usage plugins (Ychris, Make, cost-meter) and our own three sibling Apps each rewrite the same loopback-fence / credentials / route-registration idioms.

The tempting response is a Webpage runtime layer that wraps Cordis so Apps "cannot break". That is a shadow kernel: it leaks, it lags every upstream rc, and it converts per-App breakage into whole-ecosystem breakage. The Minecraft loader history is the cautionary precedent — the heavyweight patch layer (Forge) stalled the ecosystem for months on every kernel bump; the thin loader (Fabric) ported in days. CONTEXT.md already frames Packs as modpacks; the loader-layer lesson applies to us directly.

Three sibling repos (`dsh-usage-app`, `dsh-jobs-app`, `dsh-automations-app`) carry structurally identical `scripts/check.mjs`, `tsdown` client presets, and vitest CSS-stub configs, differing only in per-repo config (package name, inject list, packed allowlist). The rule of three is satisfied for the build-time checker. No runtime helper has three consumers.

## Decision

1. **The authoring contract has four carriers, in priority order, none on the runtime path:**
   - **Types**, published from the implementing package (`@wha1echai/dsh-webpage`). Illegal states stay unrepresentable: `register()` accepts metadata only; slots and locales are declared through `declare module` map augmentation. Types are erased at runtime and add zero failure surface.
   - **One official template** embedding the idiom lore as working code: lazy App body, `codeSplitting: false`, soft-`get` of host services, `ctx.inject(['webServer'], …)` waiting, INSERT-only bundle patch.
   - **An executable conformance kit** App authors run in their own repos: manifest pins, source hygiene, Node export shape, client externals, packed-payload allowlist, patch hygiene. Extracted from the three existing `check.mjs` copies.
   - **A thin runtime**: the `/ui` kit and the `AppBoundary` failure domain only. No HTTP helpers, no scheduler, no store.
2. **Runtime helpers follow the rule of three.** A helper is extracted only after three independent consumers demonstrate the same shape. The conformance kit qualifies today; loopback-route helpers (two consumers) do not.
3. **The contract is versioned.** The authoring guide carries a contract version. An upstream DSH target bump (rc.6 → rc.7) is a contract version bump plus a kit update; App authors re-run the kit instead of re-reading kernel source.
4. **Agents are first-class users of the address space.** The same `PagesService` list/open surface backs human launcher rows and agent-facing tools (`list_apps` / `open_app` or equivalent). Authoring documentation must stay agent-legible: types to read, checks to run, a template to copy — no knowledge that only lives in a chat channel.
5. **Ownership boundaries are unchanged.** No store (ADR 0006), no scheduler (ADR 0007), no Resource/Grant/Space scaffolding ahead of DSH host primitives.

## Consequences

- Kernel churn cost concentrates in the kit and the template, not in every App. A Cordis change breaks loudly in CI hours after the bump, not silently in user boots.
- The onboarding metric becomes measurable: a fresh developer — human or agent session — ships a conformant App in one day using only the public template, types, and kit. Agent sessions double as repeatable usability tests.
- The ecosystem's first App-author cohort is expected to include agents. The contract carriers (types, executable checks) are exactly the artifacts agents consume best.
- No Webpage layer sits between Apps and Cordis at runtime, so there is nothing of ours to crash under someone else's App.

## Rejected alternatives

| Alternative | Reason rejected |
| --- | --- |
| Wrapper runtime / shadow kernel over Cordis | Leaks, lags every upstream rc, converts per-App breakage into ecosystem-wide breakage; the Forge failure mode. |
| A DSL or second plugin model | ADR 0001. Authors would learn it in addition to Cordis and React, not instead of them. |
| Early runtime helpers (HTTP fence, route registration) | Two consumers today. Premature abstraction locks the shape before the third consumer proves it. |
| Waiting for upstream API stability before ecosystem work | The rc target is pinned and churn is a given; versioned contract plus conformance kit is how the ecosystem survives churn now. |
