# ADR 0009: Apps do not proxy foreign origins

Status: Accepted for dsh-webpage 0.7 planning.

## Context

A heavy-service consumer — an App that manages a local binary with its own HTTP server and its own management console — asked whether the App address space could host that server directly: either a deeper URL hierarchy (`/dsh/webpage/<vendor>.com`) or a reverse proxy from the DSH web server to the managed process, so the vendor's existing console could be reused inside the shell.

The mechanics make this look available. The App address space is `/apps/<app-id>/<appPath>`, root-mounted only, and non-root prefixes are already classified as non-App ([ADR 0001](0001-apps-are-plugin-contributions.md), route parser). But `ctx.webServer` genuinely does let any Host plugin register exact or prefix routes on the same port that serves the SPA, and the Usage App already does exactly that for four loopback GET routes. So the question is not whether a prefix route could be pointed at another server. It is what the shared origin means.

An origin is a permission boundary, not a path prefix. Everything served from the DSH origin shares one cookie jar, one storage partition, and one script context with the shell. A management API mounted there is reachable by any script that runs in the shell — including a compromised or buggy client plugin — and it arrives pre-authenticated by whatever ambient credential the Host attached. That is the confused-deputy shape the connection plugin's own trust fence exists to prevent.

Reusing a vendor console also fails on its own terms: it assumes its own origin, base path, cookie scope, and asset URLs, so path rewriting breaks it in ways that surface as intermittent UI bugs rather than clean failures.

## Decision

1. **An App may serve its own Host-owned routes** on the DSH web server: paths it implements, under a name it owns, with its own fence. Usage's `/api/wha1echai-usage/*` is the reference shape. This is the App's surface, not someone else's.

2. **An App must not proxy or mount a foreign HTTP server into the DSH origin.** Not its own managed subprocess, not a remote service, not a vendor console — no reverse proxy, no path mount, no request forwarding that makes another server answer on this origin.

3. **Embedding a foreign management console in an iframe is discouraged, for product reasons rather than as a same-origin hole.** Browser origin isolation still holds, so this is not the same class of risk as item 2. But it makes the App a launcher for an unrestricted control plane it does not own and cannot version, and it contradicts the entry-not-console principle below.

4. **The URL grammar stays closed.** No second public namespace, no virtual-host segment, no App-defined top-level path. `open_app(id, path)` and in-App routes are the whole addressing story.

5. **The window is an entry, not a console.** For a heavy service, the Host owns the process, the credentials, and the lifecycle; the window owns first run, current state, and the next action. Everything the vendor console does beyond that stays with the vendor's own tooling.

## Consequences

A heavy service integrates as two halves that never merge: a Host half that installs, starts, authenticates, and exposes a small allowlisted surface, and a window that shows state and drives the linear first run. Model or data traffic does not pass through the browser at all — it goes through the Host service the harness already provides.

Nothing here is new capability denial: an App that wants the vendor console can still tell the user where it runs. What it may not do is make the DSH origin answer for it.

The authoring contract carries the operational form of this decision: transport selection criteria for the Host-to-window channel, the first-run shape, and the norm that agent tools are a platform-level footprint rather than a per-App one.

## Rejected alternatives

| Alternative | Reason rejected |
| --- | --- |
| Deeper URL hierarchy so an App can own a site-like path | Renames the problem. The grammar change buys nothing without item 2, which is the part that is unsafe. |
| Reverse proxy the managed service under a Host prefix | Puts an unrestricted management API on the shell's origin, collides with the connection plugin's `/api` prefix and the SPA fallback, and breaks the vendor UI's own path and cookie assumptions. |
| Same-origin proxy restricted to a read-only subset | An allowlist of foreign endpoints is just item 1 with extra indirection and a second place for the allowlist to drift. Implement the routes. |
| Let Webpage supply a generic proxy so every heavy service stops writing one | That is the store/control-plane shape [ADR 0006](0006-webpage-is-a-windowing-system-not-a-store.md) refuses, and the wrapper shape [ADR 0008](0008-contract-over-wrapper.md) refuses. |
