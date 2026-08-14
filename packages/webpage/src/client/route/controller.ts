import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-runtime/client'

import type {
  AppNavigateOptions,
  AppRoute,
  RouteControllerContract,
  RouteEnvironment,
} from '../contract.js'
import { isAppId } from '../registry/validation.js'
import { isValidAppPath, isValidHash, isValidSearch, parseAppRoute } from './parser.js'

type RouteState = AppRoute | undefined

class RouteSnapshot implements ObservableSnapshot<RouteState> {
  private readonly listeners = new Set<() => void>()
  private snapshot: RouteState

  constructor(initial: RouteState) {
    this.snapshot = initial
  }

  getSnapshot(): RouteState {
    return this.snapshot
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  publish(next: RouteState): void {
    if (sameRoute(this.snapshot, next)) return
    this.snapshot = next
    for (const listener of [...this.listeners]) {
      try {
        listener()
      } catch (error) {
        console.error('[dsh-webpage] route subscriber failed:', error)
      }
    }
  }
}

function sameRoute(left: RouteState, right: RouteState): boolean {
  if (left === right) return true
  if (left === undefined || right === undefined) return false
  return (
    left.appId === right.appId &&
    left.appPath === right.appPath &&
    left.search === right.search &&
    left.hash === right.hash
  )
}

function readOptions(options: AppNavigateOptions | undefined): {
  replace: boolean
  search: string
  hash: string
} {
  if (options === undefined) return { replace: false, search: '', hash: '' }
  if (typeof options !== 'object' || options === null) throw new TypeError('Invalid navigation options')
  if (options.replace !== undefined && typeof options.replace !== 'boolean') {
    throw new TypeError('Invalid navigation options')
  }

  const search = options.search === undefined ? '' : options.search
  const hash = options.hash === undefined ? '' : options.hash
  if (!isValidSearch(search)) throw new TypeError('Invalid search')
  if (!isValidHash(hash)) throw new TypeError('Invalid hash')
  return { replace: options.replace ?? false, search, hash }
}

function readCloseOptions(options: { replace?: boolean } | undefined): boolean {
  if (options === undefined) return false
  if (typeof options !== 'object' || options === null || (options.replace !== undefined && typeof options.replace !== 'boolean')) {
    throw new TypeError('Invalid close options')
  }
  return options.replace ?? false
}

function locationHref(environment: RouteEnvironment): string {
  const { pathname, search, hash } = environment.location
  return `${pathname}${search}${hash}`
}

function canonicalRoute(appId: string, appPath: string, search: string, hash: string): {
  href: string
  route: AppRoute
} {
  const path = appPath === '/' ? '' : appPath
  const url = new URL(`/apps/${appId}${path}${search}${hash}`, 'https://dsh-webpage.invalid')
  // The ID, App path, search, and hash were validated before this constructor;
  // serializing them cannot leave the root-scoped App grammar.
  const route = parseAppRoute(url) as AppRoute
  return { href: `${url.pathname}${url.search}${url.hash}`, route }
}

/** Native-History route observation and App-relative navigation. */
export class RouteController implements RouteControllerContract {
  readonly current: ObservableSnapshot<RouteState>

  private readonly snapshot: RouteSnapshot
  private readonly environment: RouteEnvironment
  private readonly onPopState = (): void => {
    const next = parseAppRoute(this.environment.location)
    if (next === undefined) this.lastNonAppUrl = locationHref(this.environment)
    this.snapshot.publish(next)
  }
  private lastNonAppUrl: string
  private disposed = false

  constructor(environment: RouteEnvironment) {
    this.environment = environment
    const initial = parseAppRoute(environment.location)
    this.lastNonAppUrl = initial === undefined ? locationHref(environment) : '/'
    this.snapshot = new RouteSnapshot(initial)
    this.current = this.snapshot
    environment.addEventListener('popstate', this.onPopState)
  }

  open(appId: string, appPath = '/', options?: AppNavigateOptions): void {
    if (typeof appId !== 'string' || !isAppId(appId)) throw new TypeError('Invalid App ID')
    if (!isValidAppPath(appPath)) throw new TypeError('Invalid App path')
    const parsedOptions = readOptions(options)
    const next = canonicalRoute(appId, appPath, parsedOptions.search, parsedOptions.hash)
    this.commit(next.route, next.href, parsedOptions.replace)
  }

  navigate(appPath: string, options?: AppNavigateOptions): void {
    const current = this.snapshot.getSnapshot()
    if (current === undefined) throw new Error('RouteController.navigate() requires an active App')
    if (!isValidAppPath(appPath)) throw new TypeError('Invalid App path')
    const parsedOptions = readOptions(options)
    const next = canonicalRoute(current.appId, appPath, parsedOptions.search, parsedOptions.hash)
    this.commit(next.route, next.href, parsedOptions.replace)
  }

  close(options?: { replace?: boolean }): void {
    const replace = readCloseOptions(options)
    if (this.snapshot.getSnapshot() === undefined) return
    this.commit(undefined, this.lastNonAppUrl, replace)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.environment.removeEventListener('popstate', this.onPopState)
  }

  private commit(next: RouteState, href: string, replace: boolean): void {
    if (sameRoute(this.snapshot.getSnapshot(), next)) return
    const write = replace ? this.environment.history.replaceState : this.environment.history.pushState
    write.call(this.environment.history, null, '', href)
    this.snapshot.publish(next)
  }
}

export function createRouteController(environment: RouteEnvironment): RouteControllerContract {
  return new RouteController(environment)
}
