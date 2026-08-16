// @vitest-environment jsdom

import { join } from 'node:path'
import { afterEach, describe, expect, expectTypeOf, it } from 'vitest'
import type { SlotMap } from '@deepseek-ai/dsh-client-ui-slots'
import {
  CORE_ID,
  createLoaderEntry,
  createTestContext,
  extensionEntries,
  flushSlotEffects,
  buildModuleSystem,
  keyedEntries,
  MinimalRoot,
  ROOT,
  type ClientModuleLoader,
  type TestContext,
  windowState,
} from './loader-support.js'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'dshapps.reference.actions': {
      kind: 'list'
      scope: 'root'
      owner: { readonly appPath: string }
    }
  }
}

const APP_PACKAGE_ID = '@dshapps/webpage-reference-app'
const EXTENSION_PACKAGE_ID = '@dshapps/webpage-reference-extension'
const APP_ID = 'dshapps.reference'
const CHILD_SLOT = 'dshapps.reference.actions'

type ReferenceActionsOwner = NonNullable<SlotMap[typeof CHILD_SLOT]['owner']>

describe('Phase 4 reference App and extension real Cordis Loader lane', () => {
  let ctx: TestContext | undefined
  let modules: ClientModuleLoader | undefined

  afterEach(async () => {
    try {
      if (ctx !== undefined) await ctx.fiber.dispose()
    } finally {
      window.history.replaceState(null, '', '/')
      delete windowState.__DSH_MODULES__
      delete windowState.__ModuleLoader__
      ctx = undefined
      modules = undefined
    }
  })

  it('loads actual built reference artifacts, waits for declarations, and reactivates through lifecycle changes', async () => {
    expectTypeOf<ReferenceActionsOwner>().toEqualTypeOf<{ readonly appPath: string }>()

    modules = await buildModuleSystem(new Map([
      [APP_PACKAGE_ID, join(ROOT, 'examples', 'reference-app', 'lib', 'client.js')],
      [EXTENSION_PACKAGE_ID, join(ROOT, 'examples', 'reference-extension', 'lib', 'client.js')],
    ]))
    ctx = await createTestContext(modules)

    // Every package is entered through the real Loader. The root declaration
    // below is the only synthetic test infrastructure in this scenario.
    await createLoaderEntry(ctx, CORE_ID)
    await createLoaderEntry(ctx, APP_PACKAGE_ID)
    await createLoaderEntry(ctx, EXTENSION_PACKAGE_ID)
    await ctx.loader.await()

    expect(ctx.pages.get(APP_ID)).toMatchObject({
      id: APP_ID,
      sourcePlugin: APP_PACKAGE_ID,
    })
    expect(ctx.slots.spec('webpage.app')).toBeUndefined()
    expect(keyedEntries(ctx)).toEqual([])
    expect(ctx.slots.spec(CHILD_SLOT)).toBeUndefined()
    expect(extensionEntries(ctx, CHILD_SLOT)).toEqual([])
    expect(ctx.loader.resolve(EXTENSION_PACKAGE_ID).fiber?.state).toBe(2) // installed, waiting on the App child declaration

    const disposeRootDeclaration = ctx.slots.register({
      name: 'root',
      children: { 'shell.overlay': { kind: 'list', scope: 'root' } },
      registrant: 'phase4.integration.root',
    }, MinimalRoot)
    await flushSlotEffects()

    expect(ctx.pages.get(APP_ID)).toMatchObject({
      id: APP_ID,
      sourcePlugin: APP_PACKAGE_ID,
    })
    expect(ctx.slots.spec('webpage.app')).toEqual({ kind: 'keyed', scope: 'root' })
    expect(keyedEntries(ctx).map(entry => ({
      key: entry.options.key,
      registrant: entry.registrant,
    }))).toEqual([
      { key: 'dshapps.inspector', registrant: CORE_ID },
      { key: APP_ID, registrant: APP_PACKAGE_ID },
    ])
    expect(ctx.slots.spec(CHILD_SLOT)).toEqual({ kind: 'list', scope: 'root' })
    expect(extensionEntries(ctx, CHILD_SLOT)).toHaveLength(1)
    expect(extensionEntries(ctx, CHILD_SLOT)[0]).toMatchObject({
      registrant: EXTENSION_PACKAGE_ID,
    })

    window.history.replaceState(null, '', '/')
    ctx.pages.open(APP_ID, '/details')
    expect(ctx.pages.current.getSnapshot()).toEqual({
      appId: APP_ID,
      appPath: '/details',
      search: '',
      hash: '',
    })
    expect(window.location.pathname).toBe(`/apps/${APP_ID}/details`)
    ctx.pages.close({ replace: true })
    expect(ctx.pages.current.getSnapshot()).toBeUndefined()
    expect(window.location.pathname).toBe('/')

    await ctx.loader.remove(APP_PACKAGE_ID)
    await ctx.loader.await()
    await flushSlotEffects()

    expect(ctx.pages.get(APP_ID)).toBeUndefined()
    expect(keyedEntries(ctx).filter(entry => entry.options.key === APP_ID)).toEqual([])
    expect(keyedEntries(ctx).map(entry => entry.options.key)).toEqual(['dshapps.inspector'])
    expect(ctx.slots.spec(CHILD_SLOT)).toBeUndefined()
    expect(extensionEntries(ctx, CHILD_SLOT)).toEqual([])
    expect(ctx.loader.resolve(EXTENSION_PACKAGE_ID).fiber?.state).toBe(2)

    await createLoaderEntry(ctx, APP_PACKAGE_ID)
    await ctx.loader.await()
    await flushSlotEffects()

    expect(ctx.pages.get(APP_ID)).toMatchObject({
      id: APP_ID,
      sourcePlugin: APP_PACKAGE_ID,
    })
    expect(keyedEntries(ctx).filter(entry => entry.options.key === APP_ID)).toHaveLength(1)
    expect(ctx.slots.spec(CHILD_SLOT)).toEqual({ kind: 'list', scope: 'root' })
    expect(extensionEntries(ctx, CHILD_SLOT)).toHaveLength(1)
    expect(extensionEntries(ctx, CHILD_SLOT)[0]).toMatchObject({
      registrant: EXTENSION_PACKAGE_ID,
    })

    await ctx.loader.remove(EXTENSION_PACKAGE_ID)
    await ctx.loader.await()
    await flushSlotEffects()

    expect(ctx.pages.get(APP_ID)).toBeDefined()
    expect(keyedEntries(ctx).filter(entry => entry.options.key === APP_ID)).toHaveLength(1)
    expect(ctx.slots.spec(CHILD_SLOT)).toEqual({ kind: 'list', scope: 'root' })
    expect(extensionEntries(ctx, CHILD_SLOT)).toEqual([])

    disposeRootDeclaration()
  })
})
