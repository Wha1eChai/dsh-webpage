import { describe, expect, it, vi } from 'vitest'

import type { LocationLike, RouteEnvironment } from '../../src/client/contract.js'
import { createRouteController, RouteController } from '../../src/client/route/controller.js'

interface HistoryEntry extends LocationLike {
  href: string
}

class FakeRouteEnvironment implements RouteEnvironment {
  readonly listeners = new Set<() => void>()
  readonly calls: Array<{ method: 'push' | 'replace'; url: string }> = []
  readonly entries: HistoryEntry[]
  index: number

  readonly location: LocationLike
  readonly history = {
    pushState: (_state: unknown, _title: string, url?: string | URL | null): void => {
      this.write('push', this.toEntry(url))
    },
    replaceState: (_state: unknown, _title: string, url?: string | URL | null): void => {
      this.write('replace', this.toEntry(url))
    },
  }

  constructor(initial: string) {
    this.entries = [this.toEntry(initial)]
    this.index = 0
    this.location = {
      pathname: this.entries[0].pathname,
      search: this.entries[0].search,
      hash: this.entries[0].hash,
    }
  }

  addEventListener(type: 'popstate', listener: () => void): void {
    expect(type).toBe('popstate')
    this.listeners.add(listener)
  }

  removeEventListener(type: 'popstate', listener: () => void): void {
    expect(type).toBe('popstate')
    this.listeners.delete(listener)
  }

  back(): void {
    if (this.index === 0) return
    this.index -= 1
    this.setLocationFromEntry(this.entries[this.index])
    this.emitPopState()
  }

  forward(): void {
    if (this.index >= this.entries.length - 1) return
    this.index += 1
    this.setLocationFromEntry(this.entries[this.index])
    this.emitPopState()
  }

  emitPopState(): void {
    for (const listener of this.listeners) listener()
  }

  setLocation(url: string): void {
    const entry = this.toEntry(url)
    this.setLocationFromEntry(entry)
  }

  private write(method: 'push' | 'replace', entry: HistoryEntry): void {
    this.calls.push({ method, url: entry.href })
    if (method === 'replace') {
      this.entries[this.index] = entry
    } else {
      this.entries.splice(this.index + 1)
      this.entries.push(entry)
      this.index += 1
    }
    this.setLocationFromEntry(entry)
  }

  private setLocationFromEntry(entry: HistoryEntry): void {
    this.location.pathname = entry.pathname
    this.location.search = entry.search
    this.location.hash = entry.hash
  }

  private toEntry(url: string | URL | null | undefined): HistoryEntry {
    const href = url === undefined || url === null ? this.entries[this.index]?.href ?? '/' : String(url)
    const parsed = new URL(href, 'https://dsh.test')
    return { href: `${parsed.pathname}${parsed.search}${parsed.hash}`, pathname: parsed.pathname, search: parsed.search, hash: parsed.hash }
  }
}

describe('RouteController', () => {
  it('reads an initial App route and exposes a stable observable snapshot', () => {
    const environment = new FakeRouteEnvironment('/apps/acme.tools/dashboard?tab=one#top')
    const controller = new RouteController(environment)
    const first = controller.current.getSnapshot()

    expect(first).toEqual({ appId: 'acme.tools', appPath: '/dashboard', search: '?tab=one', hash: '#top' })
    expect(controller.current.getSnapshot()).toBe(first)
    expect(environment.listeners.size).toBe(1)
  })

  it('tracks an initial non-App location as close fallback and keeps unknown App IDs in the URL', () => {
    const environment = new FakeRouteEnvironment('/conversation?session=1#message')
    const controller = new RouteController(environment)

    expect(controller.current.getSnapshot()).toBeUndefined()
    environment.emitPopState()
    expect(controller.current.getSnapshot()).toBeUndefined()
    controller.open('unknown.tools', '/nested/')
    expect(environment.calls).toEqual([{ method: 'push', url: '/apps/unknown.tools/nested/' }])
    expect(controller.current.getSnapshot()).toEqual({ appId: 'unknown.tools', appPath: '/nested/', search: '', hash: '' })

    controller.close()
    expect(environment.calls.at(-1)).toEqual({ method: 'push', url: '/conversation?session=1#message' })
    expect(controller.current.getSnapshot()).toBeUndefined()
  })

  it('opens, navigates, and replaces App-local routes with synchronous notifications', () => {
    const environment = new FakeRouteEnvironment('/')
    const controller = new RouteController(environment)
    const notifications: Array<ReturnType<typeof controller.current.getSnapshot>> = []
    const unsubscribe = controller.current.subscribe(() => notifications.push(controller.current.getSnapshot()))

    controller.open('acme.tools', '/', { search: '?tab=home', hash: '#top' })
    expect(environment.calls.at(-1)).toEqual({ method: 'push', url: '/apps/acme.tools?tab=home#top' })
    expect(notifications).toHaveLength(1)
    expect(notifications[0]).toEqual({ appId: 'acme.tools', appPath: '/', search: '?tab=home', hash: '#top' })

    controller.navigate('/settings/', { search: '?tab=details', hash: '#section' })
    expect(environment.calls.at(-1)).toEqual({ method: 'push', url: '/apps/acme.tools/settings/?tab=details#section' })
    controller.navigate('/settings/', { replace: true, search: '?tab=other', hash: '#section' })
    expect(environment.calls.at(-1)).toEqual({ method: 'replace', url: '/apps/acme.tools/settings/?tab=other#section' })
    expect(notifications).toHaveLength(3)

    const callCount = environment.calls.length
    controller.navigate('/settings/', { replace: true, search: '?tab=other', hash: '#section' })
    expect(environment.calls).toHaveLength(callCount)
    expect(notifications).toHaveLength(3)

    controller.navigate('/')
    expect(environment.calls.at(-1)).toEqual({ method: 'push', url: '/apps/acme.tools' })
    expect(notifications).toHaveLength(4)
    unsubscribe()
  })

  it('publishes the browser-canonical URL and isolates subscriber failures', () => {
    const environment = new FakeRouteEnvironment('/')
    const controller = new RouteController(environment)
    const failure = new Error('broken route subscriber')
    const report = vi.spyOn(console, 'error').mockImplementation(() => {})
    const reached = vi.fn()
    controller.current.subscribe(() => { throw failure })
    controller.current.subscribe(reached)

    expect(() => controller.open('acme.tools', '/space here', {
      search: '?query=hello world',
      hash: '#section name',
    })).not.toThrow()
    expect(environment.calls.at(-1)).toEqual({
      method: 'push',
      url: '/apps/acme.tools/space%20here?query=hello%20world#section%20name',
    })
    expect(controller.current.getSnapshot()).toEqual({
      appId: 'acme.tools',
      appPath: '/space%20here',
      search: '?query=hello%20world',
      hash: '#section%20name',
    })
    expect(report).toHaveBeenCalledWith('[dsh-webpage] route subscriber failed:', failure)
    expect(reached).toHaveBeenCalledOnce()
    report.mockRestore()
  })

  it('simulates back/forward through popstate and does not duplicate no-op notifications', () => {
    const environment = new FakeRouteEnvironment('/')
    const controller = new RouteController(environment)
    const notifications: unknown[] = []
    controller.current.subscribe(() => notifications.push(controller.current.getSnapshot()))

    controller.open('acme.tools')
    controller.navigate('/one')
    expect(notifications).toHaveLength(2)

    environment.back()
    expect(controller.current.getSnapshot()).toEqual({ appId: 'acme.tools', appPath: '/', search: '', hash: '' })
    expect(notifications).toHaveLength(3)
    environment.back()
    expect(controller.current.getSnapshot()).toBeUndefined()
    expect(notifications).toHaveLength(4)
    environment.back()
    expect(notifications).toHaveLength(4)
    environment.forward()
    expect(controller.current.getSnapshot()).toEqual({ appId: 'acme.tools', appPath: '/', search: '', hash: '' })
    expect(notifications).toHaveLength(5)
  })

  it('rejects invalid navigation without changing History', () => {
    const environment = new FakeRouteEnvironment('/')
    const controller = new RouteController(environment)
    const originalPush = environment.history.pushState
    const originalReplace = environment.history.replaceState

    expect(() => controller.navigate('/nowhere')).toThrow()
    expect(() => controller.open('not-an-app-id')).toThrow()
    expect(() => controller.open('acme.tools', '//nested')).toThrow()
    expect(() => controller.open('acme.tools', '/nested', { search: 'bad' })).toThrow()
    expect(() => controller.open('acme.tools', '/nested', { search: '?bad=#fragment' })).toThrow()
    expect(() => controller.open('acme.tools', '/nested', { hash: 'bad' })).toThrow()
    expect(() => controller.open('acme.tools', '/nested', { replace: 'yes' as never })).toThrow()
    expect(() => controller.open('acme.tools', '/nested', null as never)).toThrow()
    expect(() => controller.close({ replace: 'yes' as never })).toThrow()
    expect(environment.calls).toHaveLength(0)
    expect(environment.history.pushState).toBe(originalPush)
    expect(environment.history.replaceState).toBe(originalReplace)

    const activeEnvironment = new FakeRouteEnvironment('/apps/acme.tools')
    const activeController = new RouteController(activeEnvironment)
    expect(() => activeController.navigate('//nested')).toThrow()
    expect(activeEnvironment.calls).toHaveLength(0)
    activeController.dispose()
  })

  it('constructs the contract through the factory', () => {
    const environment = new FakeRouteEnvironment('/')
    const controller = createRouteController(environment)

    expect(controller.current.getSnapshot()).toBeUndefined()
    controller.dispose()
  })

  it('closes a direct App deep link to root and supports replace', () => {
    const environment = new FakeRouteEnvironment('/apps/acme.tools/deep')
    const controller = new RouteController(environment)

    controller.close({ replace: true })
    expect(environment.calls).toEqual([{ method: 'replace', url: '/' }])
    expect(controller.current.getSnapshot()).toBeUndefined()
    controller.open('acme.tools')
    controller.close({})
    expect(environment.calls.at(-1)).toEqual({ method: 'push', url: '/' })
    controller.close()
    expect(environment.calls).toHaveLength(3)
  })

  it('disposes the popstate listener idempotently', () => {
    const environment = new FakeRouteEnvironment('/apps/acme.tools')
    const controller = new RouteController(environment)
    const snapshot = controller.current.getSnapshot()
    const notifications: unknown[] = []
    controller.current.subscribe(() => notifications.push(controller.current.getSnapshot()))

    controller.dispose()
    controller.dispose()
    expect(environment.listeners.size).toBe(0)
    environment.setLocation('/apps/acme.tools/changed')
    environment.emitPopState()
    expect(controller.current.getSnapshot()).toBe(snapshot)
    expect(notifications).toHaveLength(0)
  })
})
