// @vitest-environment jsdom

import { Context, Service } from '@deepseek-ai/cordis'
import type { AppRoute, RegisteredApp } from '../../src/client/contract.js'
import { apply, inject, name } from '../../src/client/index.js'
import { afterEach, describe, expect, it } from 'vitest'

interface FakeEntry {
  options: Record<string, unknown>
  component: unknown
}

class FakeSlots extends Service {
  private readonly declarations = new Set(['shell.overlay', 'sidebar.footer.action'])
  private readonly registered = new Set<FakeEntry>()
  private readonly waiters = new Map<string, Set<() => void>>()

  constructor(ctx: Context) {
    super(ctx, 'slots')
  }

  inject(name: string, callback: () => (() => void)): () => void {
    let registrationDisposer: (() => void) | undefined
    const activate = (): void => { registrationDisposer ??= callback() }
    const pending = (): void => activate()
    if (this.declarations.has(name)) activate()
    else {
      const listeners = this.waiters.get(name) ?? new Set<() => void>()
      listeners.add(pending)
      this.waiters.set(name, listeners)
    }
    return this.ctx.effect(() => () => {
      this.waiters.get(name)?.delete(pending)
      registrationDisposer?.()
    }, `fake slots.inject(${name})`)
  }

  register(options: Record<string, unknown>, component: unknown): () => void {
    const entry = { options, component }
    this.registered.add(entry)
    const children = options.children as Record<string, unknown> | undefined
    for (const name of Object.keys(children ?? {})) {
      this.declarations.add(name)
      for (const activate of [...(this.waiters.get(name) ?? [])]) activate()
    }
    this.changed()
    let active = true
    return () => {
      if (!active) return
      active = false
      this.registered.delete(entry)
      for (const name of Object.keys(children ?? {})) this.declarations.delete(name)
      this.changed()
    }
  }

  snapshot(name: string): unknown[] {
    if (!this.declarations.has(name)) return []
    return [{
      name,
      kind: name === 'webpage.app' ? 'keyed' : 'list',
      scope: 'root',
      occupants: this.entries(name).map(entry => ({
        key: entry.options.key,
        id: entry.options.id,
        priority: 0,
        active: true,
      })),
      children: [],
    }]
  }

  entry(name: string): FakeEntry {
    const entry = this.entries(name)[0]
    if (entry === undefined) throw new Error(`missing fake slot entry ${name}`)
    return entry
  }

  entries(name: string): FakeEntry[] {
    return [...this.registered].filter(entry => entry.options.name === name)
  }

  spec(name: string): object | undefined {
    return this.declarations.has(name) ? {} : undefined
  }

  private changed(): void {
    void this.ctx.emit('slots/changed')
  }
}

class FakeLocale {
  readonly registrations = new Map<string, unknown>()

  register(namespace: string, dictionaries: unknown): () => void {
    this.registrations.set(namespace, dictionaries)
    return () => { this.registrations.delete(namespace) }
  }
}

describe('client apply composition', () => {
  it('exports a stable Cordis plugin name for diagnostics', () => {
    expect(name).toBe('@wha1echai/dsh-webpage')
  })

  afterEach(() => window.history.replaceState(null, '', '/'))

  it('wires metadata, all slot surfaces, route callbacks, and fiber disposal', async () => {
    window.history.replaceState(null, '', '/')
    const ctx = new Context()
    const slots = new FakeSlots(ctx)
    const locale = new FakeLocale()
    ctx.provide('locale', locale as never)

    const fiber = ctx.plugin({ inject, apply })
    await fiber.await()
    const pages = (ctx as Context & { pages: {
      list: { getSnapshot(): readonly RegisteredApp[] }
      get(id: string): RegisteredApp | undefined
    } }).pages

    expect(locale.registrations.has('webpage')).toBe(true)
    expect(pages.list.getSnapshot().map(app => app.id)).toEqual(['wha1echai.webpage'])
    expect(slots.entry('shell.overlay').options.children).toEqual({
      'webpage.app': { kind: 'keyed', scope: 'root' },
    })
    expect(slots.entry('webpage.app').options.key).toBe('wha1echai.webpage')
    expect(slots.entry('sidebar.footer.action').options.id).toBe('webpage.apps')

    const launcherFace = (slots.entry('sidebar.footer.action').options.inject as () => {
      openApps(): void
    })()
    launcherFace.openApps()
    expect(window.location.pathname).toBe('/apps/wha1echai.webpage')

    const outletFace = (slots.entry('shell.overlay').options.inject as () => {
      hooks: { route: { getSnapshot(): AppRoute | undefined } }
      navigate(path: string, options?: { search?: string; hash?: string }): void
      close(options?: { replace?: boolean }): void
    })()
    expect(outletFace.hooks.route.getSnapshot()?.appId).toBe('wha1echai.webpage')
    outletFace.navigate('/nested', { search: '?tab=all', hash: '#top' })
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`)
      .toBe('/apps/wha1echai.webpage/nested?tab=all#top')
    outletFace.close({ replace: true })
    expect(window.location.pathname).toBe('/')

    const inspectorFace = (slots.entry('webpage.app').options.inject as () => {
      openApp(id: string): void
    })()
    inspectorFace.openApp('wha1echai.webpage')
    expect(window.location.pathname).toBe('/apps/wha1echai.webpage')

    await fiber.dispose()
    expect(pages.get('wha1echai.webpage')).toBeUndefined()
    expect(slots.entries('shell.overlay')).toEqual([])
    expect(slots.entries('webpage.app')).toEqual([])
    expect(slots.entries('sidebar.footer.action')).toEqual([])
    expect(locale.registrations.size).toBe(0)
  })
})
