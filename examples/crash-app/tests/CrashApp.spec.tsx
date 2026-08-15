import { describe, expect, it } from 'vitest'

import { CrashApp } from '../src/client/CrashApp.js'

describe('CrashApp', () => {
  it('throws the intentional crash used by the failure-domain demo', () => {
    expect(() => CrashApp({
      appId: 'wha1echai.crash',
      appPath: '/',
      search: '',
      hash: '',
      navigate: () => {},
      close: () => {},
    })).toThrow('intentional crash')
  })
})
