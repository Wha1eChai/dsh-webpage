import { afterEach, describe, expect, it, vi } from 'vitest'

import { apply, inject, name, ReferenceAppBody } from '../src/client/index.js'

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

    expect(name).toBe('@dshapps/webpage-reference-app')
    expect(inject).toEqual(['pages', 'slots', 'locale'])
    expect(effect).toHaveBeenCalledOnce()
    expect(pageRegister).toHaveBeenCalledWith(expect.objectContaining({
      id: 'dshapps.reference',
      label: 'Reference App',
    }))
    expect(localeRegister).toHaveBeenCalledWith('reference', expect.objectContaining({ zh: expect.any(Object), en: expect.any(Object) }))
    expect(slotInject).toHaveBeenCalledWith('webpage.app', expect.any(Function))
    expect(slotRegister).toHaveBeenCalledWith({
      name: 'webpage.app',
      key: 'dshapps.reference',
      locale: 'reference',
      children: {
        'dshapps.reference.actions': { kind: 'list', scope: 'root' },
      },
    }, ReferenceAppBody)

    cleanups[0]()
    expect(unregisterApp).toHaveBeenCalledOnce()
    expect(unregisterPage).toHaveBeenCalledOnce()
    expect(unregisterLocale).toHaveBeenCalledOnce()
  })
})
