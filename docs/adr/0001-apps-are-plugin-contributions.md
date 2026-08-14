# Apps are plugin contributions

DSH plugins remain the sole installation, versioning, dependency, trust, and lifecycle unit. `dsh-webpage` defines an App as an addressable contribution made by an ordinary plugin, rather than introducing a Webpage package type or a second plugin manager; this keeps the project compatible with DSH profiles, bundles, Loader entries, and the emerging plugin marketplace.

An App owns a namespaced route subtree such as `/apps/<app-id>/*`. One plugin may contribute multiple Apps, and other plugins may extend an App only through extension points declared by its owner. Packs are declarative compositions of plugins and configuration, not executable super-plugins.

The implementation remains out of tree and composes only through public DSH plugin surfaces. Upstream adoption of the convention may happen later, but is neither a prerequisite nor a runtime dependency.
