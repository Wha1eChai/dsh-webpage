import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-runtime/client'

/** Stable metadata contributed by an ordinary DSH plugin. */
export interface AppDescriptor {
  id: string
  label: string
  description?: string
  order?: number
  categories?: readonly string[]
}

/** Descriptor plus diagnostic provenance derived from the calling Cordis fiber. */
export interface RegisteredApp extends AppDescriptor {
  sourcePlugin?: string
}

/** Metadata-only App registry exposed as `ctx.pages`. */
export interface PagesService {
  register(descriptor: AppDescriptor): () => void
  get(id: string): RegisteredApp | undefined
  readonly list: ObservableSnapshot<readonly RegisteredApp[]>
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    pages: PagesService
  }
}

/** One parsed root-deployment Webpage route. */
export interface AppRoute {
  appId: string
  appPath: string
  search: string
  hash: string
}

/** Options for App-local navigation. Omitted query or fragment clears it. */
export interface AppNavigateOptions {
  replace?: boolean
  search?: string
  hash?: string
}

/** Immutable props supplied by the Webpage Outlet to one keyed App entry. */
export interface AppOwnerProps extends AppRoute {
  navigate(appPath: string, options?: AppNavigateOptions): void
  close(options?: { replace?: boolean }): void
}

/** Minimal browser location input accepted by the pure route parser. */
export interface LocationLike {
  pathname: string
  search: string
  hash: string
}

/** Browser dependencies used by RouteController and replaced by unit fixtures. */
export interface RouteEnvironment {
  readonly location: LocationLike
  readonly history: Pick<History, 'pushState' | 'replaceState'>
  addEventListener(type: 'popstate', listener: () => void): void
  removeEventListener(type: 'popstate', listener: () => void): void
}

/** Observable native-History controller used by the Outlet. */
export interface RouteControllerContract {
  readonly current: ObservableSnapshot<AppRoute | undefined>
  open(appId: string, appPath?: string, options?: AppNavigateOptions): void
  navigate(appPath: string, options?: AppNavigateOptions): void
  close(options?: { replace?: boolean }): void
  dispose(): void
}
