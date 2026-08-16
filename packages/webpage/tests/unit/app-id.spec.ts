import { describe, expect, it } from 'vitest'

import { isAppId, isValidAppPath } from '../../src/app-id.js'

describe('App ID grammar', () => {
  it('accepts two-or-more lower-case dotted segments with interior hyphens', () => {
    expect(isAppId('acme.catalog')).toBe(true)
    expect(isAppId('acme-tools.catalog-v2')).toBe(true)
    expect(isAppId('dshapps.usage')).toBe(true)
    expect(isAppId('a.b.c')).toBe(true)
  })

  it('rejects values outside the App ID grammar', () => {
    const invalid = [
      '',
      'acme',
      '.acme.catalog',
      'acme.catalog.',
      'acme..catalog',
      'Acme.catalog',
      '-acme.catalog',
      'acme-.catalog',
      42,
      undefined,
      null,
    ]
    for (const value of invalid) {
      expect(isAppId(value), String(value)).toBe(false)
    }
  })
})

describe('App path grammar', () => {
  it('accepts the same absolute in-app routes as the client router', () => {
    expect(isValidAppPath('/')).toBe(true)
    expect(isValidAppPath('/today')).toBe(true)
    expect(isValidAppPath('/settings/')).toBe(true)
  })

  it('rejects Host-loose strings that the client router would throw on', () => {
    const invalid = ['//odd', '/a/../b', '/x?tab=1', '', 'today', ' /today', 1, undefined]
    for (const value of invalid) {
      expect(isValidAppPath(value), String(value)).toBe(false)
    }
  })
})
