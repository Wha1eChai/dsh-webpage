import { isValidAppPath } from '../../app-id.js'
import { isAppId } from '../registry/validation.js'
import type { AppRoute, LocationLike } from '../contract.js'

export { isValidAppPath }

const APP_ROUTE_PREFIX = '/apps/'

/** Validate the browser query component without normalizing it. */
export function isValidSearch(value: unknown): value is string {
  return typeof value === 'string' && !value.includes('#') && (value === '' || value.startsWith('?'))
}

/** Validate the browser fragment component without normalizing it. */
export function isValidHash(value: unknown): value is string {
  return typeof value === 'string' && (value === '' || value.startsWith('#'))
}

/** Parse only the root-deployment App route namespace. */
export function parseAppRoute(location: LocationLike): AppRoute | undefined {
  if (
    typeof location.pathname !== 'string' ||
    !isValidSearch(location.search) ||
    !isValidHash(location.hash) ||
    !location.pathname.startsWith(APP_ROUTE_PREFIX)
  ) {
    return undefined
  }

  const remainder = location.pathname.slice(APP_ROUTE_PREFIX.length)
  const separator = remainder.indexOf('/')
  const appId = separator === -1 ? remainder : remainder.slice(0, separator)
  const appPath = separator === -1 ? '/' : remainder.slice(separator)
  if (!isAppId(appId) || !isValidAppPath(appPath)) return undefined

  return Object.freeze({
    appId,
    appPath,
    search: location.search,
    hash: location.hash,
  })
}
