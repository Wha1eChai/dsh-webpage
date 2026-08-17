# DSH Webpage

DSH Webpage is the domain in which DSH plugins contribute addressable Web applications for humans and agents. It defines application-facing concepts while preserving the existing DSH plugin model as the delivery and lifecycle boundary.

## Delivery and composition

**Plugin**:
The existing DSH unit of installation, versioning, dependency, trust, activation, and disposal.
_Avoid_: Webpage package, App plugin type

**Contribution**:
A named application-facing capability or surface supplied by a Plugin to a host-defined registry.
_Avoid_: Plugin type, package type

**Pack**:
A curated selection of Plugins and configuration that produces a coherent experience while retaining each Plugin's identity and lifecycle.
_Avoid_: Super-plugin, App package manager

## Application surface

**App**:
An addressable user experience assembled from one or more Contributions and identified by a stable App ID. An App owns one route subtree but is not independently installable.
_Avoid_: Plugin, bundle, website

**App ID**:
A stable, globally namespaced identity for an App from which its default route mount is derived.
_Avoid_: Display name, arbitrary URL

**Address**:
The URL `/apps/<app-id>/*` on the host that is serving the Web UI. A person can bookmark it or send it. A session agent passes it to `open_app`. Any other agent that can reach the same host can open it and see the same state.
_Avoid_: Ephemeral chat card, widget without a path

**Page**:
A navigable view within an App's owned route subtree.
_Avoid_: App, installable page

**App Extension**:
A Contribution that augments an App through an extension point explicitly declared by that App.
_Avoid_: Route takeover, monkey patch

**Extension Point**:
An App-owned, named location or capability at which authorized App Extensions may contribute behavior or UI.
_Avoid_: Global hook, implicit child route

**App Outlet**:
The host-owned surface that selects and displays the App addressed by the current browser URL while leaving the DSH conversation surface mounted. Chrome follows the App's declared surface (overlay, panel, or modal).
_Avoid_: Router, replacement shell, plugin host

**App Surface**:
A metadata enum on the App descriptor that selects Outlet chrome. It is not a second router and not a React component.
_Avoid_: Layout slot, theme, window type

**App Launcher**:
The global discovery panel opened from the sidebar Apps control. It lists registered Apps, filters them, and calls `pages.open()`. It is not the Inspector.
_Avoid_: Command-only empty palette, plugin manager

**App Inspector**:
A read-only App that reports installed App contributions and their declared composition topology. Its panes are list-slot contributions; it is not a plugin manager, marketplace, or control plane.

## Resources and authority

**Resource**:
A persistent domain object owned by an App and accessible through the App's authoritative operations. UI state and rendered markup are not Resources.
_Avoid_: Page state, DOM content

**Principal**:
An independently identifiable human, agent, application, or remote node that may request operations on Resources.
_Avoid_: Session string, caller-provided identity

**Grant**:
An explicit authorization allowing a Principal to perform specified operations on a Resource or Resource scope.
_Avoid_: Hidden menu, transport trust

**Space**:
A collaboration boundary that groups Principals, Resources, Grants, and lifecycle policy.
_Avoid_: Folder, shared URL

**Node**:
An independently operated DSH host that may expose selected Apps, Resources, or agent capabilities to another Node.
_Avoid_: Browser tab, session
