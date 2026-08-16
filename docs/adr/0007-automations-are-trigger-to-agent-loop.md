# ADR 0007: Automations are trigger → agent loop, not a cron App

Status: Accepted for dsh-webpage 0.5 planning.

## Context

Phase 0.4 shipped `dsh-automations-app` as a Webpage panel over `titanwings/dsh-automation` `#v0.1.5`. The panel lists/pauses/runs-now only if that Host is installed; the App itself does not start an Agent. A follow-up plan proposed replacing the remote with a first-party once/interval/daily/weekly scheduler that mints a new Session per due time.

Jobs App and the session/job-count Usage App were already judged to have no practical value. Standalone scheduled tasks were judged the same way. A first-party check of Codex, Claude Code, and Cursor agrees.

DSH already has three clock-adjacent surfaces:

| Surface | What fires | What runs |
| --- | --- | --- |
| Official `@deepseek-ai/dsh-schedule` | Timer | `followup` on the **same live** Agent; cold sessions are silent |
| `titanwings/dsh-automation` | Timer / run-now | New Session + unattended loop (community Host) |
| `Sev7een/dsh-plugin-automations` | Timer + valley hours | New Session, thinner, no LICENSE file |

Webpage wrapping any of these as “the Automations App” would be a fourth cron UI, not a product.

## Decision

1. **Webpage does not own a scheduler.** No first-party cron store, no third `every_seconds ≥ 5min` pump, no titanwings remote as a flagship App. Module install of community schedulers stays with `dsh plugin` and markets ([ADR 0006](0006-webpage-is-a-windowing-system-not-a-store.md)).

2. **If a later phase ships an Automations App, the contract is a recipe, not a cadence.** The object is: trigger + prompt + tool/permission boundary → **new Session** running the existing Host loop (`agents.create` / `followup` / `whenIdle`). A clock is an optional trigger. The first cut must not be an interval form.

3. **The first cut of that future App, if any, is closer to “run now” / event dispatch than to cron.** Manual dispatch and DSH-native events beat `once` / `daily` / `weekly`. Official Schedule remains the same-session reminder product; do not re-skin it.

4. **This phase does not build that App.** Phase 0.5 rebuilds Usage (local ledger + provider cards) and records this decision. `dsh-automations-app` stays in its sibling repo as history and is removed from the web profile so the empty titanwings window is not the demo.

## Consequences

Flagship proof that Webpage is a windowing system moves to Usage: a panel that needs a Host half (keys and a durable ledger never belong in the browser) and still composes through `pages.register()` + `webpage.app`.

A future Automations App can start from this ADR and the research note. It will need a Host plugin for unattended identity (`withoutInitiator`, non-user `MessageSource`, `approval: never`). Browser `session.prompt` is the wrong spawn path: it stamps `kind: 'user'` and inherits human approval.

Community schedulers remain installable. Webpage will not vendor them, will not auto-add `github:titanwings/dsh-automation`, and will not present their absence as a broken App.

## Rejected alternatives

| Alternative | Reason rejected |
| --- | --- |
| Self-built once/interval/daily/weekly MVP | Copies the weakest peer surface (Claude `/loop`, Codex trigger-half). Body of work approaches titanwings without the inbox, isolation, or event triggers that make the peers useful. |
| Keep `dsh-automations-app` as a titanwings remote | Empty without a Host the profile must not auto-install. Demonstrates a remote, not an App. |
| Skin official `dsh-schedule` as an App | Same-session reminders; cold sessions do not fire. Not “trigger → new Session.” |
| Event catalog in this phase (git / Slack / webhook) | DSH has no first-party trigger plane yet. Building the catalog before the recipe/runtime is another empty window. |
