import type { AppDescriptor } from '../contract.js'

const segment = '[a-z0-9](?:[a-z0-9-]*[a-z0-9])?'
const appIdPattern = new RegExp(`^(?:${segment}\\.)+${segment}$`)

/** Return whether a value is a valid root-deployment App ID. */
export function isAppId(value: unknown): value is string {
  return typeof value === 'string' && appIdPattern.test(value)
}

/** Assert the canonical App-ID grammar shared by the registry and router. */
export function assertAppId(value: unknown): asserts value is string {
  if (!isAppId(value)) {
    throw new TypeError(`invalid App ID ${String(value)}`)
  }
}

/** Assert the metadata-only descriptor contract before registry mutation. */
export function assertAppDescriptor(value: unknown): asserts value is AppDescriptor {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('invalid App descriptor: expected an object')
  }

  const descriptor = value as Record<string, unknown>
  assertAppId(descriptor.id)
  assertNonEmptyString('label', descriptor.label)

  if ('description' in descriptor && descriptor.description !== undefined) {
    assertNonEmptyString('description', descriptor.description)
  }

  if ('order' in descriptor && descriptor.order !== undefined) {
    if (typeof descriptor.order !== 'number' || !Number.isFinite(descriptor.order)) {
      throw new TypeError('invalid App descriptor: order must be finite')
    }
  }

  if ('categories' in descriptor && descriptor.categories !== undefined) {
    if (!Array.isArray(descriptor.categories)) {
      throw new TypeError('invalid App descriptor: categories must be an array')
    }
    for (const category of descriptor.categories) {
      assertNonEmptyString('category', category)
    }
  }
}

function assertNonEmptyString(field: string, value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`invalid App descriptor: ${field} must be a nonempty string`)
  }
}
