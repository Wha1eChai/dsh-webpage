import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import type { LocationLike, RouteEnvironment } from '../../src/client/contract.js'
import { PagesService } from '../../src/client/registry/service.js'
import { resolveAppSurface } from '../../src/client/contract.js'
import { assertAppDescriptor, assertAppId, isAppId, isAppSurface } from '../../src/client/registry/validation.js'
import { createRouteController } from '../../src/client/route/controller.js'

function createContext(): Context {
  const ctx = new Context()
  new PagesService(ctx)
  return ctx
}

async function flushMicrotasks(): Promise<void> {
  await new Promise<void>(resolve => queueMicrotask(resolve))
}

describe('PagesService registration', () => {
  it('exposes metadata through ctx.pages and derives the calling plugin name', async () => {
    const ctx = createContext()

    const fiber = ctx.plugin(function catalogPlugin(pluginCtx) {
      pluginCtx.pages.register({
        id: 'acme.catalog',
        label: 'Catalog',
        description: 'Product catalog',
        order: 2,
        categories: ['commerce'],
        surface: 'panel',
      })
    })
    await fiber

    expect(ctx.pages.get('acme.catalog')).toEqual({
      id: 'acme.catalog',
      label: 'Catalog',
      description: 'Product catalog',
      order: 2,
      categories: ['commerce'],
      surface: 'panel',
      sourcePlugin: 'catalogPlugin',
    })
    expect(ctx.pages.get('acme.catalog')).not.toHaveProperty('component')

    await fiber.dispose()
    expect(ctx.pages.get('acme.catalog')).toBeUndefined()
    await ctx.fiber.dispose()
  })

  it('uses root as provenance for direct registration and supports exact lookup', async () => {
    const ctx = createContext()
    const dispose = ctx.pages.register({ id: 'acme.root', label: 'Root' })

    const record = ctx.pages.get('acme.root')
    expect(record).toMatchObject({ id: 'acme.root', label: 'Root', sourcePlugin: 'root' })
    expect(ctx.pages.get('acme')).toBeUndefined()
    expect(ctx.pages.get('acme.root')).toBe(record)

    dispose()
    dispose()
    expect(ctx.pages.get('acme.root')).toBeUndefined()
    await ctx.fiber.dispose()
  })

  it('ignores caller-supplied provenance and freezes the stored metadata', async () => {
    const ctx = createContext()
    const categories = ['catalog']
    const descriptor = {
      id: 'acme.immutable',
      label: 'Immutable',
      description: 'Read-only metadata',
      order: 1,
      categories,
      sourcePlugin: 'spoofed-caller-value',
    } as AppDescriptorWithSource

    const dispose = ctx.pages.register(descriptor)
    categories.push('mutated-input')

    const record = ctx.pages.get('acme.immutable')!
    expect(record).toEqual({
      id: 'acme.immutable',
      label: 'Immutable',
      description: 'Read-only metadata',
      order: 1,
      categories: ['catalog'],
      sourcePlugin: 'root',
    })
    expect(record).not.toHaveProperty('component')
    expect(record).not.toHaveProperty('sourcePlugin', 'spoofed-caller-value')
    expect(Object.isFrozen(record)).toBe(true)
    expect(Object.isFrozen(record.categories)).toBe(true)
    expect(Object.isFrozen(ctx.pages.list.getSnapshot())).toBe(true)
    expect(() => {
      ;(record as MutableRecord).label = 'changed'
    }).toThrow(TypeError)
    expect(() => {
      ;(record.categories as string[]).push('changed')
    }).toThrow(TypeError)

    dispose()
    await ctx.fiber.dispose()
  })

  it('sorts snapshots by finite order and then code-unit App ID', async () => {
    const ctx = createContext()
    ctx.pages.register({ id: 'zeta.zero', label: 'Zero' })
    ctx.pages.register({ id: 'acme.negative', label: 'Negative', order: -1 })
    ctx.pages.register({ id: 'acme.alpha', label: 'Alpha', order: 0 })
    ctx.pages.register({ id: 'acme.later', label: 'Later', order: 2 })

    const list = ctx.pages.list
    expect(ctx.pages.list).toBe(list)
    expect(list.getSnapshot().map(app => app.id)).toEqual([
      'acme.negative',
      'acme.alpha',
      'zeta.zero',
      'acme.later',
    ])
    expect(list.getSnapshot()[1]).toBe(ctx.pages.get('acme.alpha'))

    await ctx.fiber.dispose()
  })

  it('publishes immediately, batches notifications in one microtask, and supports idempotent unsubscribe', async () => {
    const ctx = createContext()
    const listener = vi.fn()
    const unsubscribe = ctx.pages.list.subscribe(listener)
    const initial = ctx.pages.list.getSnapshot()

    const disposeA = ctx.pages.register({ id: 'acme.a', label: 'A' })
    const disposeB = ctx.pages.register({ id: 'acme.b', label: 'B' })
    const afterRegistration = ctx.pages.list.getSnapshot()
    expect(afterRegistration).not.toBe(initial)
    expect(listener).not.toHaveBeenCalled()

    await flushMicrotasks()
    expect(listener).toHaveBeenCalledTimes(1)

    disposeA()
    disposeA()
    disposeB()
    expect(ctx.pages.list.getSnapshot()).toHaveLength(0)
    expect(listener).toHaveBeenCalledTimes(1)
    await flushMicrotasks()
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    unsubscribe()
    ctx.pages.register({ id: 'acme.after', label: 'After' })
    await flushMicrotasks()
    expect(listener).toHaveBeenCalledTimes(2)
    await ctx.fiber.dispose()
  })

  it('isolates a failing subscriber and continues notifying the remaining subscribers', async () => {
    const ctx = createContext()
    const failure = new Error('broken pages subscriber')
    const report = vi.spyOn(console, 'error').mockImplementation(() => {})
    const reached = vi.fn()
    ctx.pages.list.subscribe(() => { throw failure })
    ctx.pages.list.subscribe(reached)

    ctx.pages.register({ id: 'acme.notifications', label: 'Notifications' })
    await flushMicrotasks()

    expect(report).toHaveBeenCalledWith('[dsh-webpage] pages subscriber failed:', failure)
    expect(reached).toHaveBeenCalledOnce()
    report.mockRestore()
    await ctx.fiber.dispose()
  })

  it('changes nothing for invalid or duplicate registration', async () => {
    const ctx = createContext()
    const listener = vi.fn()
    const unsubscribe = ctx.pages.list.subscribe(listener)
    const dispose = ctx.pages.register({ id: 'acme.stable', label: 'Stable' })
    await flushMicrotasks()
    const snapshot = ctx.pages.list.getSnapshot()
    listener.mockClear()

    expect(() => ctx.pages.register({ id: 'acme.invalid/id', label: 'Invalid' })).toThrow()
    expect(ctx.pages.list.getSnapshot()).toBe(snapshot)
    expect(listener).not.toHaveBeenCalled()

    const owner = ctx.plugin(function ownerPlugin(pluginCtx) {
      pluginCtx.pages.register({ id: 'acme.owned', label: 'Owned' })
    })
    await owner
    await flushMicrotasks()
    const ownedSnapshot = ctx.pages.list.getSnapshot()
    listener.mockClear()

    const contender = ctx.plugin(function contenderPlugin(pluginCtx) {
      pluginCtx.pages.register({ id: 'acme.owned', label: 'Duplicate' })
    })
    await expect(contender).rejects.toThrow(
      'duplicate App ID "acme.owned": existing sourcePlugin <ownerPlugin>; incoming sourcePlugin <contenderPlugin>',
    )
    expect(ctx.pages.list.getSnapshot()).toBe(ownedSnapshot)
    expect(listener).not.toHaveBeenCalled()

    unsubscribe()
    dispose()
    await contender.dispose()
    await owner.dispose()
    await ctx.fiber.dispose()
  })

  it('withdraws a registration on fiber unload and keeps a later disposer harmless', async () => {
    const ctx = createContext()
    let disposeRegistration!: () => void
    const fiber = ctx.plugin(function unloadablePlugin(pluginCtx) {
      disposeRegistration = pluginCtx.pages.register({ id: 'acme.unloadable', label: 'Unloadable' })
    })
    await fiber
    expect(ctx.pages.get('acme.unloadable')).toBeDefined()

    await fiber.dispose()
    expect(ctx.pages.get('acme.unloadable')).toBeUndefined()
    disposeRegistration()
    disposeRegistration()
    expect(ctx.pages.get('acme.unloadable')).toBeUndefined()
    await ctx.fiber.dispose()
  })
})

describe('App metadata validation', () => {
  it('exports the canonical App-ID predicate and assertion', () => {
    expect(isAppId('acme.catalog')).toBe(true)
    expect(isAppId('acme-tools.catalog-v2')).toBe(true)
    expect(isAppId('acme')).toBe(false)
    expect(isAppId(42)).toBe(false)
    expect(() => assertAppId('Acme.catalog')).toThrow('invalid App ID Acme.catalog')
    assertAppId('acme.catalog')
  })

  it('rejects routing syntax and malformed App-ID segments', () => {
    const invalidIds = [
      '',
      '.acme.catalog',
      'acme.catalog.',
      'acme..catalog',
      'acme/catalog',
      'acme\\catalog',
      'acme?catalog',
      'acme#catalog',
      'acme catalog',
      'Acme.catalog',
      'acme.%63atalog',
      '-acme.catalog',
      'acme-.catalog',
      'acme._catalog',
    ]
    for (const id of invalidIds) {
      expect(isAppId(id), id).toBe(false)
      expect(() => assertAppId(id)).toThrow(`invalid App ID ${id}`)
    }
  })

  it('validates the descriptor object, supplied strings, categories, and finite order', () => {
    const invalidDescriptors: unknown[] = [
      null,
      [],
      'descriptor',
      {},
      { id: 'acme.valid', label: '' },
      { id: 'acme.valid', label: 42 },
      { id: 'acme.valid', label: '   ' },
      { id: 'acme.valid', label: 'Valid', description: '' },
      { id: 'acme.valid', label: 'Valid', description: 42 },
      { id: 'acme.valid', label: 'Valid', order: Number.NaN },
      { id: 'acme.valid', label: 'Valid', order: Number.POSITIVE_INFINITY },
      { id: 'acme.valid', label: 'Valid', order: '1' },
      { id: 'acme.valid', label: 'Valid', categories: null },
      { id: 'acme.valid', label: 'Valid', categories: 'catalog' },
      { id: 'acme.valid', label: 'Valid', categories: [42] },
      { id: 'acme.valid', label: 'Valid', categories: [''] },
      { id: 'acme.valid', label: 'Valid', categories: ['   '] },
      { id: 'acme.valid', label: 'Valid', surface: 'window' },
      { id: 'acme.valid', label: 'Valid', surface: 1 },
    ]
    for (const descriptor of invalidDescriptors) {
      expect(() => assertAppDescriptor(descriptor)).toThrow()
    }

    assertAppDescriptor({
      id: 'acme.valid',
      label: 'Valid',
      description: undefined,
      order: undefined,
      categories: undefined,
    })
    assertAppDescriptor({ id: 'acme.valid', label: 'Valid', categories: [] })
    assertAppDescriptor({ id: 'acme.valid', label: 'Valid', surface: 'panel' })
    expect(isAppSurface('overlay')).toBe(true)
    expect(isAppSurface('drawer')).toBe(false)
    expect(resolveAppSurface(undefined)).toBe('overlay')
    expect(resolveAppSurface('modal')).toBe('modal')
  })
})

type AppDescriptorWithSource = {
  id: string
  label: string
  description: string
  order: number
  categories: string[]
  sourcePlugin: string
}

type MutableRecord = { label: string }

class FakeHistoryEnvironment implements RouteEnvironment {
  readonly location: LocationLike
  readonly listeners = new Set<() => void>()
  href: string

  readonly history = {
    pushState: (_state: unknown, _title: string, url?: string | URL | null): void => {
      this.href = String(url)
      this.syncLocation()
    },
    replaceState: (_state: unknown, _title: string, url?: string | URL | null): void => {
      this.href = String(url)
      this.syncLocation()
    },
  }

  constructor(initial: string) {
    this.href = initial
    this.location = { pathname: '/', search: '', hash: '' }
    this.syncLocation()
  }

  addEventListener(type: 'popstate', listener: () => void): void {
    expect(type).toBe('popstate')
    this.listeners.add(listener)
  }

  removeEventListener(type: 'popstate', listener: () => void): void {
    expect(type).toBe('popstate')
    this.listeners.delete(listener)
  }

  private syncLocation(): void {
    const url = new URL(this.href, 'http://127.0.0.1')
    this.location.pathname = url.pathname
    this.location.search = url.search
    this.location.hash = url.hash
  }
}

describe('PagesService navigation', () => {
  it('fails loud when no RouteController is bound', async () => {
    const ctx = createContext()
    expect(ctx.pages.current.getSnapshot()).toBeUndefined()
    expect(ctx.pages.current.subscribe(() => {})()).toBeUndefined()
    expect(() => ctx.pages.open('acme.catalog')).toThrow('pages navigation is unavailable')
    expect(() => ctx.pages.close()).toThrow('pages navigation is unavailable')
    await ctx.fiber.dispose()
  })

  it('opens and closes Apps through a bound RouteController without exporting the controller', async () => {
    const environment = new FakeHistoryEnvironment('/')
    const route = createRouteController(environment)
    const ctx = new Context()
    new PagesService(ctx, route)

    expect(ctx.pages.current.getSnapshot()).toBeUndefined()
    ctx.pages.open('acme.catalog', '/details', { search: '?tab=all' })
    expect(ctx.pages.current.getSnapshot()).toEqual({
      appId: 'acme.catalog',
      appPath: '/details',
      search: '?tab=all',
      hash: '',
    })
    expect(environment.location.pathname).toBe('/apps/acme.catalog/details')

    ctx.pages.close({ replace: true })
    expect(ctx.pages.current.getSnapshot()).toBeUndefined()
    expect(environment.location.pathname).toBe('/')
    route.dispose()
    await ctx.fiber.dispose()
  })
})

