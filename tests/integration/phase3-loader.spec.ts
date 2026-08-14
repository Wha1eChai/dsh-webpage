// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { buildPhase3Fixtures, type BuiltPhase3Fixtures } from '../fixtures/phase3-loader/build.js'
import {
  CORE_ID,
  createLoaderEntry,
  createTestContext,
  extensionEntries,
  flushSlotEffects,
  buildModuleSystem,
  keyedEntries,
  MinimalRoot,
  type ClientModuleLoader,
  type TestContext,
  windowState,
} from './loader-support.js'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'phase3.beta.extension': { kind: 'list'; scope: 'root' }
  }
}

const ALPHA_ID = 'phase3.fixture.alpha'
const BETA_ID = 'phase3.fixture.beta'
const CONFLICT_ID = 'phase3.fixture.conflict'
const EXTENSION_ID = 'phase3.fixture.extension'
const BETA_EXTENSION_SLOT = 'phase3.beta.extension'

describe('Phase 3 real Cordis Loader client lane', () => {
  let ctx: TestContext | undefined
  let modules: ClientModuleLoader | undefined
  let fixtureBuild: BuiltPhase3Fixtures | undefined

  afterEach(async () => {
    try {
      if (ctx !== undefined) await ctx.fiber.dispose()
    } finally {
      await fixtureBuild?.dispose()
      delete windowState.__DSH_MODULES__
      delete windowState.__ModuleLoader__
      ctx = undefined
      modules = undefined
      fixtureBuild = undefined
    }
  })

  it('loads built core and independent App entries, rejects conflicts, and survives Outlet redeclaration', async () => {
    fixtureBuild = await buildPhase3Fixtures()
    modules = await buildModuleSystem(fixtureBuild.bundles)
    ctx = await createTestContext(modules)

    await createLoaderEntry(ctx, CORE_ID)
    await createLoaderEntry(ctx, ALPHA_ID)
    await createLoaderEntry(ctx, BETA_ID)
    await createLoaderEntry(ctx, EXTENSION_ID)
    await ctx.loader.await()

    expect(ctx.pages.list.getSnapshot().map(app => app.id)).toEqual([
      'wha1echai.webpage',
      'phase3.alpha',
      'phase3.beta',
    ])
    expect(ctx.slots.spec('webpage.app')).toBeUndefined()
    expect(keyedEntries(ctx)).toEqual([])
    expect(ctx.slots.spec(BETA_EXTENSION_SLOT)).toBeUndefined()
    expect(extensionEntries(ctx)).toEqual([])
    expect(ctx.loader.resolve(EXTENSION_ID).fiber?.state).toBe(2) // installed, waiting on the child declaration

    const disposeOutletDeclaration = ctx.slots.register({
      name: 'root',
      children: { 'shell.overlay': { kind: 'list', scope: 'root' } },
      registrant: 'phase3.fixture.outlet-declaration',
    }, MinimalRoot)
    await flushSlotEffects()

    expect(ctx.slots.spec('webpage.app')).toMatchObject({ kind: 'keyed', scope: 'root' })
    expect(keyedEntries(ctx).map(entry => entry.options.key)).toEqual([
      'wha1echai.webpage',
      'phase3.alpha',
      'phase3.beta',
    ])
    expect(ctx.slots.spec(BETA_EXTENSION_SLOT)).toMatchObject({ kind: 'list', scope: 'root' })
    expect(extensionEntries(ctx)).toEqual([
      expect.objectContaining({
        options: expect.objectContaining({ id: 'phase3.extension.entry' }),
        registrant: 'phase3.fixture.extension',
      }),
    ])

    await expect(createLoaderEntry(ctx, CONFLICT_ID)).rejects.toThrow(
      'duplicate App ID "phase3.alpha": existing sourcePlugin <phase3.fixture.alpha>; incoming sourcePlugin <phase3.fixture.conflict>',
    )
    expect(ctx.pages.get('phase3.alpha')).toMatchObject({
      label: 'Phase 3 Alpha',
      sourcePlugin: 'phase3.fixture.alpha',
    })
    expect(keyedEntries(ctx).filter(entry => entry.options.key === 'phase3.alpha')).toHaveLength(1)
    expect(keyedEntries(ctx).map(entry => entry.registrant)).not.toContain('phase3.fixture.conflict')

    await ctx.loader.remove(ALPHA_ID)
    await ctx.loader.await()
    expect(ctx.pages.get('phase3.alpha')).toBeUndefined()
    expect(keyedEntries(ctx).map(entry => entry.options.key)).toEqual([
      'wha1echai.webpage',
      'phase3.beta',
    ])

    await ctx.loader.remove(BETA_ID)
    await ctx.loader.await()
    expect(ctx.pages.get('phase3.beta')).toBeUndefined()
    expect(keyedEntries(ctx).map(entry => entry.options.key)).toEqual(['wha1echai.webpage'])
    expect(ctx.slots.spec(BETA_EXTENSION_SLOT)).toBeUndefined()
    expect(extensionEntries(ctx)).toEqual([])
    expect(ctx.loader.resolve(EXTENSION_ID).fiber?.state).toBe(2)

    await createLoaderEntry(ctx, BETA_ID)
    await ctx.loader.await()
    await flushSlotEffects()
    expect(ctx.pages.get('phase3.beta')).toMatchObject({
      label: 'Phase 3 Beta',
      sourcePlugin: 'phase3.fixture.beta',
    })
    expect(keyedEntries(ctx).map(entry => entry.options.key)).toEqual([
      'wha1echai.webpage',
      'phase3.beta',
    ])
    expect(ctx.slots.spec(BETA_EXTENSION_SLOT)).toMatchObject({ kind: 'list', scope: 'root' })
    expect(extensionEntries(ctx)).toHaveLength(1)
    expect(extensionEntries(ctx)[0]).toMatchObject({
      options: { id: 'phase3.extension.entry' },
      registrant: 'phase3.fixture.extension',
    })

    await ctx.loader.remove(CORE_ID)
    await ctx.loader.await()
    // PagesService is owned by the core entry. Its removal also puts the
    // fixture entries into Cordis's dependency wait, while SlotRegistry stays
    // alive as test infrastructure and observes the Outlet declaration
    // collapse.
    expect(ctx.get('pages')).toBeUndefined()
    expect(ctx.slots.spec('webpage.app')).toBeUndefined()
    expect(keyedEntries(ctx)).toEqual([])
    expect(ctx.slots.spec(BETA_EXTENSION_SLOT)).toBeUndefined()
    expect(extensionEntries(ctx)).toEqual([])
    expect(ctx.loader.resolve(BETA_ID).fiber?.state).toBe(0) // Cordis FiberState.PENDING
    expect(ctx.loader.resolve(EXTENSION_ID).fiber?.state).toBe(2)

    await createLoaderEntry(ctx, CORE_ID)
    await ctx.loader.await()
    await flushSlotEffects()
    expect(ctx.slots.spec('webpage.app')).toMatchObject({ kind: 'keyed', scope: 'root' })
    expect(ctx.loader.resolve(BETA_ID).fiber?.state).toBe(2) // Cordis FiberState.ACTIVE
    expect(keyedEntries(ctx).map(entry => entry.options.key)).toEqual([
      'wha1echai.webpage',
      'phase3.beta',
    ])
    expect(keyedEntries(ctx).filter(entry => entry.options.key === 'phase3.beta')).toHaveLength(1)
    expect(ctx.slots.spec(BETA_EXTENSION_SLOT)).toMatchObject({ kind: 'list', scope: 'root' })
    expect(extensionEntries(ctx)).toHaveLength(1)
    expect(extensionEntries(ctx)[0]).toMatchObject({
      options: { id: 'phase3.extension.entry' },
      registrant: 'phase3.fixture.extension',
    })

    await ctx.loader.remove(EXTENSION_ID)
    await ctx.loader.await()
    expect(extensionEntries(ctx)).toEqual([])
    expect(ctx.slots.spec(BETA_EXTENSION_SLOT)).toMatchObject({ kind: 'list', scope: 'root' })
    expect(ctx.pages.get('phase3.beta')).toBeDefined()
    expect(keyedEntries(ctx).filter(entry => entry.options.key === 'phase3.beta')).toHaveLength(1)

    disposeOutletDeclaration()
  })
})
