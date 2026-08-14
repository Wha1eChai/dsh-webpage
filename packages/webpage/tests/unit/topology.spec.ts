// @vitest-environment jsdom

import { Context } from '@deepseek-ai/cordis'
import type { SlotRegistry as SlotRegistryContract } from '@deepseek-ai/dsh-client-runtime/client'
import type { LiveSlotNode } from '@deepseek-ai/dsh-client-ui-slots'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type {} from '../../src/client/slots.js'
import { createSlotTopologySource, type SlotTopologySource } from '../../src/client/inspector/topology.js'

interface ModuleLoader {
  load(input: {
    id: string
    factory(require: (name: string) => unknown): Record<string, unknown>
  }): void
}

interface LoaderWindow extends Window {
  __ModuleLoader__?: ModuleLoader
}

let SlotRegistry!: typeof SlotRegistryContract

beforeAll(async () => {
  const loaderWindow = window as LoaderWindow
  const cordis = await import('@deepseek-ai/cordis')
  const uiSlots = await import('@deepseek-ai/dsh-client-ui-slots')
  const modules = new Map<string, Record<string, unknown>>([
    ['@deepseek-ai/cordis', cordis],
    ['@deepseek-ai/dsh-client-ui-slots', uiSlots],
  ])
  loaderWindow.__ModuleLoader__ = {
    load(input) {
      modules.set(input.id, input.factory(name => {
        const module = modules.get(name)
        if (!module) throw new Error(`missing browser module ${name}`)
        return module
      }))
    },
  }
  await import('@deepseek-ai/dsh-client-runtime/client')
  SlotRegistry = modules.get('@deepseek-ai/dsh-client-runtime')!.SlotRegistry as typeof SlotRegistryContract
})

describe('SlotTopologySource', () => {
  let ctx: Context
  let slots: SlotRegistryContract
  const activeSources: SlotTopologySource[] = []

  afterEach(async () => {
    activeSources.splice(0).forEach(source => source.dispose())
    await ctx.fiber.dispose()
  })

  async function createContext(): Promise<void> {
    ctx = new Context()
    slots = new SlotRegistry(ctx)
  }

  function register(options: Record<string, unknown>): () => void {
    return (slots.register as unknown as (options: Record<string, unknown>, component: () => null) => () => void)(
      options,
      () => null,
    )
  }

  function createSource(): SlotTopologySource {
    const source = createSlotTopologySource(ctx)
    activeSources.push(source)
    return source
  }

  function declareWebpageApp(): { disposeRoot: () => void; disposeApp: () => void } {
    const disposeRoot = register({
      name: 'root',
      children: {
        'webpage.app': { kind: 'keyed', scope: 'root' },
        'unrelated.slot': { kind: 'list', scope: 'root' },
      },
      registrant: 'layoutPlugin',
    })
    const disposeApp = register({
      name: 'webpage.app',
      key: 'acme.ready',
      children: {
        'webpage.extension': { kind: 'list', scope: 'root' },
      },
      registrant: 'appPlugin',
    })
    return { disposeRoot, disposeApp }
  }

  it('keeps a frozen snapshot and source identity stable between topology changes', async () => {
    await createContext()
    declareWebpageApp()

    const source = createSource()
    expect(createSlotTopologySource(ctx)).toBe(source)
    const first = source.getSnapshot()

    expect(source.getSnapshot()).toBe(first)
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first[0])).toBe(true)
    expect(Object.isFrozen(first[0].occupants)).toBe(true)
    expect(Object.isFrozen(first[0].children)).toBe(true)

    const unsubscribe = source.subscribe(() => {})
    unsubscribe()
    unsubscribe()
  })

  it('captures descendant extension mutations and batches same-microtask changes', async () => {
    await createContext()
    declareWebpageApp()
    const source = createSource()
    const listener = vi.fn()
    source.subscribe(listener)

    const disposeExtension = register({
      name: 'webpage.extension',
      id: 'toolbar',
      registrant: 'extensionPlugin',
    })
    register({
      name: 'webpage.extension',
      id: 'actions',
      registrant: 'actionsPlugin',
    })

    expect(listener).not.toHaveBeenCalled()
    await Promise.resolve()

    expect(listener).toHaveBeenCalledOnce()
    expect(source.getSnapshot()[0].children[0].occupants).toEqual([
      { registrant: 'extensionPlugin', id: 'toolbar', priority: 0, active: true },
      { registrant: 'actionsPlugin', id: 'actions', priority: 0, active: true },
    ])
    disposeExtension()
  })

  it('ignores unrelated slot events when the serialized webpage topology is unchanged', async () => {
    await createContext()
    declareWebpageApp()
    const source = createSource()
    const before = source.getSnapshot()
    const listener = vi.fn()
    source.subscribe(listener)

    register({ name: 'unrelated.slot', id: 'unrelated', registrant: 'otherPlugin' })
    await Promise.resolve()

    expect(source.getSnapshot()).toBe(before)
    expect(listener).not.toHaveBeenCalled()
  })

  it('contains subscriber failures and continues with later subscribers', async () => {
    await createContext()
    declareWebpageApp()
    const source = createSource()
    const failure = new Error('broken topology subscriber')
    const report = vi.spyOn(console, 'error').mockImplementation(() => {})
    const reached = vi.fn()
    source.subscribe(() => { throw failure })
    source.subscribe(reached)

    register({ name: 'webpage.app', key: 'acme.second', registrant: 'secondPlugin' })
    await Promise.resolve()

    expect(report).toHaveBeenCalledWith('[dsh-webpage] topology subscriber failed:', failure)
    expect(reached).toHaveBeenCalledOnce()
    report.mockRestore()
  })

  it('disposes idempotently and suppresses a queued or later notification', async () => {
    await createContext()
    declareWebpageApp()
    const source = createSource()
    const listener = vi.fn()
    source.subscribe(listener)

    register({ name: 'webpage.app', key: 'acme.queued', registrant: 'queuedPlugin' })
    source.dispose()
    source.dispose()
    await Promise.resolve()
    expect(listener).not.toHaveBeenCalled()

    register({ name: 'webpage.app', key: 'acme.later', registrant: 'laterPlugin' })
    await Promise.resolve()
    expect(listener).not.toHaveBeenCalled()

    const replacement = createSource()
    expect(replacement).not.toBe(source)
    const replacementListener = vi.fn()
    replacement.subscribe(replacementListener)
    register({ name: 'webpage.app', key: 'acme.reloaded', registrant: 'reloadedPlugin' })
    await Promise.resolve()
    expect(replacementListener).toHaveBeenCalledOnce()
  })

  it('does not notify later subscribers after one subscriber disposes the source', async () => {
    await createContext()
    declareWebpageApp()
    const source = createSource()
    const reached = vi.fn()
    source.subscribe(() => source.dispose())
    source.subscribe(reached)

    register({ name: 'webpage.app', key: 'acme.disposed', registrant: 'disposedPlugin' })
    await Promise.resolve()

    expect(reached).not.toHaveBeenCalled()
  })

  it('returns the exact frozen LiveSlotNode shape from real registrations', async () => {
    await createContext()
    declareWebpageApp()
    register({
      name: 'webpage.extension',
      id: 'toolbar',
      children: {
        'webpage.extension.action': { kind: 'single', scope: 'root' },
      },
      registrant: 'extensionPlugin',
    })
    register({
      name: 'webpage.extension.action',
      registrant: 'actionPlugin',
    })
    const source = createSource()
    const snapshot: readonly LiveSlotNode[] = source.getSnapshot()

    expect(snapshot).toEqual([{
      name: 'webpage.app',
      kind: 'keyed',
      scope: 'root',
      declaredBy: 'an entry in "root" (layoutPlugin)',
      occupants: [{ registrant: 'appPlugin', key: 'acme.ready', priority: 0, active: true }],
      children: [{
        name: 'webpage.extension',
        kind: 'list',
        scope: 'root',
        declaredBy: 'an entry in "webpage.app" (appPlugin)',
        occupants: [{ registrant: 'extensionPlugin', id: 'toolbar', priority: 0, active: true }],
        children: [{
          name: 'webpage.extension.action',
          kind: 'single',
          scope: 'root',
          declaredBy: 'an entry in "webpage.extension" (extensionPlugin)',
          occupants: [{ registrant: 'actionPlugin', priority: 0, active: true }],
          children: [],
        }],
      }],
    }])
  })
})
