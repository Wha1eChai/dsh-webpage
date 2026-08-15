const segment = '[a-z0-9](?:[a-z0-9-]*[a-z0-9])?'
const appIdPattern = new RegExp(`^(?:${segment}\\.)+${segment}$`)
const ENCODED_SEPARATOR = /%(?:2f|5c)/i

/** Return whether a value is a valid root-deployment App ID. */
export function isAppId(value: unknown): value is string {
  return typeof value === 'string' && appIdPattern.test(value)
}

/**
 * Shared Host + client App-path grammar. Absolute in-app routes only:
 * no `//` prefix, query, hash, backslash, encoded separators, or `.` / `..`.
 */
export function isValidAppPath(value: unknown): value is string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return false
  if (/[\\?#]/.test(value) || ENCODED_SEPARATOR.test(value)) return false

  for (const segment of value.split('/')) {
    if (segment === '.' || segment === '..') return false
    let decoded: string
    try {
      decoded = decodeURIComponent(segment)
    } catch {
      return false
    }
    if (decoded === '.' || decoded === '..') return false
  }
  return true
}
