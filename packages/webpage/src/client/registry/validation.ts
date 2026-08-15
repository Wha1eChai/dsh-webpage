import { isAppId } from '../../app-id.js'
import { APP_SURFACES, type AppDescriptor, type AppSurface } from '../contract.js'

export { isAppId }

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

  if ('surface' in descriptor && descriptor.surface !== undefined) {
    if (!isAppSurface(descriptor.surface)) {
      throw new TypeError('invalid App descriptor: surface must be overlay, panel, or modal')
    }
  }
}

/** Return whether a value is one of the three Outlet surfaces. */
export function isAppSurface(value: unknown): value is AppSurface {
  return typeof value === 'string' && (APP_SURFACES as readonly string[]).includes(value)
}

function assertNonEmptyString(field: string, value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`invalid App descriptor: ${field} must be a nonempty string`)
  }
}
