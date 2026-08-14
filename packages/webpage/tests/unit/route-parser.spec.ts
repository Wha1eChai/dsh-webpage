import { describe, expect, it } from 'vitest'

import {
  isValidAppPath,
  isValidHash,
  isValidSearch,
  parseAppRoute,
} from '../../src/client/route/parser.js'

describe('parseAppRoute', () => {
  it('parses root and nested App routes while preserving query, hash, and trailing slash', () => {
    expect(parseAppRoute({ pathname: '/apps/acme.tools', search: '', hash: '' })).toEqual({
      appId: 'acme.tools',
      appPath: '/',
      search: '',
      hash: '',
    })
    expect(parseAppRoute({ pathname: '/apps/acme.tools/', search: '?tab=home', hash: '#top' })).toEqual({
      appId: 'acme.tools',
      appPath: '/',
      search: '?tab=home',
      hash: '#top',
    })
    expect(parseAppRoute({ pathname: '/apps/acme.tools/settings/', search: '?q=1', hash: '#part' })).toEqual({
      appId: 'acme.tools',
      appPath: '/settings/',
      search: '?q=1',
      hash: '#part',
    })
  })

  it('returns undefined for non-App, base-prefixed, malformed, and encoded-ID routes', () => {
    const locations = [
      { pathname: '/', search: '', hash: '' },
      { pathname: '/settings', search: '', hash: '' },
      { pathname: '/dsh/apps/acme.tools', search: '', hash: '' },
      { pathname: '/apps/acme', search: '', hash: '' },
      { pathname: '/apps/acme.tools//page', search: '', hash: '' },
      { pathname: '/apps/acme%2etools', search: '', hash: '' },
      { pathname: '/apps/acme.tools%2Fother', search: '', hash: '' },
      { pathname: '/apps/acme.tools?query', search: '', hash: '' },
      { pathname: '/apps/acme.tools#hash', search: '', hash: '' },
      { pathname: '/apps/acme.tools', search: 'query', hash: '' },
      { pathname: '/apps/acme.tools', search: '', hash: 'hash' },
    ]

    for (const location of locations) expect(parseAppRoute(location)).toBeUndefined()
  })

  it('rejects unsafe App-local paths and accepts valid paths including trailing slash', () => {
    const validPaths = ['/', '/settings', '/settings/', '/a%20b', '/question%3Fmark']
    const invalidPaths = [
      '',
      '//settings',
      '/settings\\details',
      '/settings?tab=1',
      '/settings#part',
      '/settings/%2Fchild',
      '/settings/%5Cchild',
      '/.',
      '/..',
      '/settings/./child',
      '/settings/../child',
      '/settings/%2e/child',
      '/settings/%2E%2E/child',
      '/settings/%2e./child',
      '/settings/.%2E/child',
      '/settings/%invalid/child',
    ]

    for (const path of validPaths) expect(isValidAppPath(path), path).toBe(true)
    for (const path of invalidPaths) expect(isValidAppPath(path), path).toBe(false)
  })

  it('validates search and hash inputs without changing their values', () => {
    expect(isValidSearch('')).toBe(true)
    expect(isValidSearch('?')).toBe(true)
    expect(isValidSearch('?tab=home')).toBe(true)
    expect(isValidSearch('tab=home')).toBe(false)
    expect(isValidSearch('?tab=#home')).toBe(false)

    expect(isValidHash('')).toBe(true)
    expect(isValidHash('#')).toBe(true)
    expect(isValidHash('#part')).toBe(true)
    expect(isValidHash('part')).toBe(false)
  })
})
