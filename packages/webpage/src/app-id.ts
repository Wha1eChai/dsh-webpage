const segment = '[a-z0-9](?:[a-z0-9-]*[a-z0-9])?'
const appIdPattern = new RegExp(`^(?:${segment}\\.)+${segment}$`)

/** Return whether a value is a valid root-deployment App ID. */
export function isAppId(value: unknown): value is string {
  return typeof value === 'string' && appIdPattern.test(value)
}

/** Return whether a value is an `open_app` path: a string that starts with `/`. */
export function isOpenAppPath(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('/')
}
