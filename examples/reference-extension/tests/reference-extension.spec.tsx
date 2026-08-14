// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apply, inject, name } from '../src/client/index.js'
import { ReferenceAction } from '../src/client/ReferenceAction.js'
import { ACTION_ID, ACTION_SLOT, en, LOCALE_NAMESPACE, zh } from '../src/client/locales.js'

interface Registration {
  options: Record<string, unknown>
  component: unknown
}

class TracedSlots {
  readonly injections: string[] = []
  readonly registrations: Registration[] = []

  inject(name: string, callback: () => () => void): () => void {
    this.injections.push(name)
    const dispose = callback()
    return () => dispose()
  }

  register(options: Record<string, unknown>, component: unknown): () => void {
    this.registrations.push({ options, component })
    return () => undefined
  }
}

afterEach(() => cleanup())

describe('reference extension', () => {
  it('renders the owner appPath supplied by the App child slot', () => {
    render(<ReferenceAction appPath="/nested/reports" t={(key) => key} />)

    expect(screen.getByTestId('reference-action-app-path').textContent).toBe('/nested/reports')
    expect(screen.getByText('pathLabel:')).toBeTruthy()
  })

  it('registers one traced contribution for the App-owned action slot', () => {
    const slots = new TracedSlots()
    const locales: Array<{ namespace: string; dictionaries: unknown }> = []
    const effects: string[] = []
    const ctx = {
      slots,
      locale: {
        register(namespace: string, dictionaries: unknown) {
          locales.push({ namespace, dictionaries })
          return () => undefined
        },
      },
      effect(effect: () => () => void, label?: string) {
        effects.push(label ?? '')
        return effect()
      },
    }

    apply(ctx as never)

    expect(name).toBe('@wha1echai/dsh-webpage-reference-extension')
    expect(inject).toEqual(['slots', 'locale'])
    expect(effects).toEqual(['dsh-webpage-reference-extension: dictionaries'])
    expect(locales).toEqual([{ namespace: LOCALE_NAMESPACE, dictionaries: { zh, en } }])
    expect(slots.injections).toEqual([ACTION_SLOT])
    expect(slots.registrations).toEqual([{
      component: ReferenceAction,
      options: { name: ACTION_SLOT, id: ACTION_ID, locale: LOCALE_NAMESPACE },
    }])
  })
})
