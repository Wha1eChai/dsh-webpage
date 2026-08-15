import { describe, expect, it } from 'vitest'

import { isAppId, isOpenAppPath } from '../../src/app-id.js'

describe('App ID grammar', () => {
  it('accepts two-or-more lower-case dotted segments with interior hyphens', () => {
    expect(isAppId('acme.catalog')).toBe(true)
    expect(isAppId('acme-tools.catalog-v2')).toBe(true)
    expect(isAppId('wha1echai.usage')).toBe(true)
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

describe('open_app path grammar', () => {
  it('accepts strings that start with /', () => {
    expect(isOpenAppPath('/')).toBe(true)
    expect(isOpenAppPath('/today')).toBe(true)
    expect(isOpenAppPath('//odd')).toBe(true)
  })

  it('rejects missing, empty, or relative paths', () => {
    expect(isOpenAppPath('')).toBe(false)
    expect(isOpenAppPath('today')).toBe(false)
    expect(isOpenAppPath(' /today')).toBe(false)
    expect(isOpenAppPath(1)).toBe(false)
    expect(isOpenAppPath(undefined)).toBe(false)
  })
})
