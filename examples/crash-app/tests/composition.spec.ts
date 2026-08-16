import { afterEach, describe, expect, it, vi } from 'vitest'

import { apply, inject, name } from '../src/client/index.js'
import { CrashApp } from '../src/client/CrashApp.js'

describe('crash App composition', () => {
  afterEach(() => vi.restoreAllMocks())

  it('registers metadata, locale, and the keyed crashing body in one effect', () => {
    const unregisterPage = vi.fn()
    const unregisterLocale = vi.fn()
    const unregisterApp = vi.fn()
    const pageRegister = vi.fn(() => unregisterPage)
    const localeRegister = vi.fn(() => unregisterLocale)
    const slotRegister = vi.fn(() => unregisterApp)
    const slotInject = vi.fn((_name: string, callback: () => (() => void)) => callback())
    const cleanups: Array<() => void> = []
    const effect = vi.fn((execute: () => () => void) => {
      cleanups.push(execute())
    })
    const ctx = {
      pages: { register: pageRegister },
      locale: { register: localeRegister },
      slots: { inject: slotInject, register: slotRegister },
      effect,
    }

    apply(ctx as never)

    expect(name).toBe('@dshapps/webpage-crash-app')
    expect(inject).toEqual(['pages', 'slots', 'locale'])
    expect(effect).toHaveBeenCalledOnce()
    expect(pageRegister).toHaveBeenCalledWith(expect.objectContaining({
      id: 'dshapps.crash',
      label: 'Crash App',
    }))
    expect(localeRegister).toHaveBeenCalledWith('crash', expect.objectContaining({ zh: expect.any(Object), en: expect.any(Object) }))
    expect(slotInject).toHaveBeenCalledWith('webpage.app', expect.any(Function))
    expect(slotRegister).toHaveBeenCalledWith({
      name: 'webpage.app',
      key: 'dshapps.crash',
      locale: 'crash',
    }, CrashApp)

    cleanups[0]()
    expect(unregisterApp).toHaveBeenCalledOnce()
    expect(unregisterPage).toHaveBeenCalledOnce()
    expect(unregisterLocale).toHaveBeenCalledOnce()
  })
})
