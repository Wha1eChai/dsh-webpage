import { afterEach, describe, expect, it, vi } from 'vitest'

import { apply, inject, name } from '../src/client/index.js'
import { ReferenceApp } from '../src/client/ReferenceApp.js'

describe('reference App composition', () => {
  afterEach(() => vi.restoreAllMocks())

  it('registers metadata, locale, and the declared child slot in one effect', () => {
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

    expect(name).toBe('@wha1echai/dsh-webpage-reference-app')
    expect(inject).toEqual(['pages', 'slots', 'locale'])
    expect(effect).toHaveBeenCalledOnce()
    expect(pageRegister).toHaveBeenCalledWith(expect.objectContaining({
      id: 'wha1echai.reference',
      label: 'Reference App',
    }))
    expect(localeRegister).toHaveBeenCalledWith('reference', expect.objectContaining({ zh: expect.any(Object), en: expect.any(Object) }))
    expect(slotInject).toHaveBeenCalledWith('webpage.app', expect.any(Function))
    expect(slotRegister).toHaveBeenCalledWith({
      name: 'webpage.app',
      key: 'wha1echai.reference',
      locale: 'reference',
      children: {
        'wha1echai.reference.actions': { kind: 'list', scope: 'root' },
      },
    }, ReferenceApp)

    cleanups[0]()
    expect(unregisterApp).toHaveBeenCalledOnce()
    expect(unregisterPage).toHaveBeenCalledOnce()
    expect(unregisterLocale).toHaveBeenCalledOnce()
  })
})
