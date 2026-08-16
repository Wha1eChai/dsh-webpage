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
  private readonly declarations = new Set(['shell.overlay', 'sidebar.footer.action', 'tool.call.toolview'])
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
    expect(name).toBe('@dshapps/webpage')
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
      open(id: string, path?: string): void
      close(options?: { replace?: boolean }): void
      current: { getSnapshot(): AppRoute | undefined }
    } }).pages

    expect(locale.registrations.has('webpage')).toBe(true)
    expect(pages.list.getSnapshot().map(app => app.id)).toEqual(['dshapps.inspector'])
    expect(slots.entry('shell.overlay').options.children).toEqual({
      'webpage.app': { kind: 'keyed', scope: 'root' },
    })
    expect(slots.entry('webpage.app').options.key).toBe('dshapps.inspector')
    expect(slots.entry('webpage.app').options.children).toEqual({
      'webpage.inspector.pane': { kind: 'list', scope: 'root' },
    })
    expect(slots.entry('sidebar.footer.action').options.id).toBe('webpage.apps')
    expect(slots.entries('webpage.inspector.pane').map(entry => entry.options.id)).toEqual([
      'webpage.inspector.catalog',
      'webpage.inspector.topology',
    ])

    const launcherFace = (slots.entry('sidebar.footer.action').options.inject as () => {
      hooks: { apps: { getSnapshot(): readonly RegisteredApp[] } }
      openApp(id: string): void
    })()
    expect(launcherFace.hooks.apps.getSnapshot().map(app => app.id)).toEqual(['dshapps.inspector'])
    launcherFace.openApp('dshapps.inspector')
    expect(window.location.pathname).toBe('/apps/dshapps.inspector')

    const outletFace = (slots.entry('shell.overlay').options.inject as () => {
      hooks: { route: { getSnapshot(): AppRoute | undefined } }
      navigate(path: string, options?: { search?: string; hash?: string }): void
      close(options?: { replace?: boolean }): void
    })()
    expect(outletFace.hooks.route.getSnapshot()?.appId).toBe('dshapps.inspector')
    outletFace.navigate('/nested', { search: '?tab=all', hash: '#top' })
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`)
      .toBe('/apps/dshapps.inspector/nested?tab=all#top')
    outletFace.close({ replace: true })
    expect(window.location.pathname).toBe('/')

    const catalogFace = (slots.entries('webpage.inspector.pane')[0]!.options.inject as () => {
      openApp(id: string): void
    })()
    catalogFace.openApp('dshapps.inspector')
    expect(window.location.pathname).toBe('/apps/dshapps.inspector')

    const topologyFace = (slots.entries('webpage.inspector.pane')[1]!.options.inject as () => {
      hooks: { topology: unknown }
    })()
    expect(topologyFace.hooks.topology).toBeDefined()

    expect(slots.entry('tool.call.toolview').options.key).toBe('open_app')
    const openAppFace = (slots.entry('tool.call.toolview').options.inject as (sessionId: string) => {
      resolveApp(id: string): RegisteredApp | undefined
      openApp(id: string, path?: string): void
    })('session-1')
    expect(openAppFace.resolveApp('dshapps.inspector')?.label).toBe('Webpage')
    expect(openAppFace.resolveApp('missing.app')).toBeUndefined()
    openAppFace.openApp('dshapps.inspector', '/inspect')
    expect(window.location.pathname).toBe('/apps/dshapps.inspector/inspect')

    const other = ctx.plugin({
      name: 'otherLauncher',
      inject: ['pages'],
      apply(pluginCtx) {
        pluginCtx.pages.open('dshapps.inspector', '/')
      },
    })
    await other.await()
    expect(window.location.pathname).toBe('/apps/dshapps.inspector')
    await other.dispose()

    await fiber.dispose()
    expect(pages.get('dshapps.inspector')).toBeUndefined()
    expect(slots.entries('shell.overlay')).toEqual([])
    expect(slots.entries('webpage.app')).toEqual([])
    expect(slots.entries('webpage.inspector.pane')).toEqual([])
    expect(slots.entries('sidebar.footer.action')).toEqual([])
    expect(slots.entries('tool.call.toolview')).toEqual([])
    expect(locale.registrations.size).toBe(0)
  })
})
