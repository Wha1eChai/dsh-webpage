import { access, readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import * as Cordis from '@deepseek-ai/cordis'
import * as UiSlots from '@deepseek-ai/dsh-client-ui-slots'
import type { PropsRenderSlots } from '@deepseek-ai/dsh-client-ui-slots'
import * as WebReact from '@deepseek-ai/dsh-client-web-react'
import * as UiPrimitives from '@deepseek-ai/dsh-client-ui-primitives'
import * as UiAttachment from '@deepseek-ai/dsh-client-ui-attachment'
import * as SchemaForm from '@deepseek-ai/dsh-client-schema-form'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { ClientModuleLoader, DshWindow } from '@deepseek-ai/dsh-client-modules/client'
import * as React from 'react'
import * as ReactDom from 'react-dom'
import * as ReactDomClient from 'react-dom/client'
import * as ReactJsxRuntime from 'react/jsx-runtime'
import type {} from '../../packages/webpage/src/client/slots.js'

export type { ClientModuleLoader }

export const ROOT = resolve(import.meta.dirname, '../..')
const WEBPAGE_NODE_MODULES = join(ROOT, 'packages', 'webpage', 'node_modules', '@deepseek-ai')

export const CORE_ID = '@wha1echai/dsh-webpage'
export const RUNTIME_ID = '@deepseek-ai/dsh-client-runtime'
export const LOCALE_ID = '@deepseek-ai/dsh-client-locale'
export const DSH_RC6 = '0.1.0-rc.6'

export type BundleMap = ReadonlyMap<string, string>

export interface SlotEntry {
  options: { key?: string; id?: string }
  registrant?: string
}

export interface LocaleRuntime {
  register(namespace: string, dictionaries: Record<string, Record<string, string>>): () => void
  getSnapshot(): unknown
  subscribe(listener: () => void): () => void
  bind(namespace: string): (key: string) => string
}

export type TestContext = Context & {
  loader: Loader
  pages: {
    get(id: string): { id: string; sourcePlugin?: string; label: string } | undefined
    list: { getSnapshot(): readonly { id: string; sourcePlugin?: string }[] }
  }
  locale: LocaleRuntime
}

export interface ClientModuleSystemConstructor {
  new (options: {
    modules: { id: string; url: string; rev: string }[]
    staticModules: Record<string, unknown>
    loadBundle: (url: string) => Promise<void>
  }): ClientModuleLoader
}

export const windowState = globalThis as DshWindow & {
  __DSH_MODULES__?: ClientModuleLoader
  __ModuleLoader__?: { load(input: { id: string; factory: (require: (name: string) => unknown) => Record<string, unknown> }): void }
}

function createStaticModules(): Record<string, unknown> {
  // This is the official DSH web-shell table from packages/client/web/src/seed.ts.
  return {
    react: React,
    'react/jsx-runtime': ReactJsxRuntime,
    'react-dom': ReactDom,
    'react-dom/client': ReactDomClient,
    '@deepseek-ai/cordis': Cordis,
    '@deepseek-ai/dsh-client-ui-slots': UiSlots,
    '@deepseek-ai/dsh-client-web-react': WebReact,
    '@deepseek-ai/dsh-client-ui-primitives': UiPrimitives,
    '@deepseek-ai/dsh-client-ui-attachment': UiAttachment,
    '@deepseek-ai/dsh-client-schema-form': SchemaForm,
  }
}

/**
 * The published `./client` artifact is itself a Loader handoff, so importing
 * it directly would execute `window.__ModuleLoader__.load()` before the test
 * has installed the real table. Capture that official handoff once, then use
 * its exported constructor to build the actual test module system.
 */
export async function loadClientModuleSystemConstructor(): Promise<ClientModuleSystemConstructor> {
  let factory: ((require: (name: string) => unknown) => Record<string, unknown>) | undefined
  windowState.__ModuleLoader__ = {
    load(input) {
      factory = input.factory
    },
  }
  await import('@deepseek-ai/dsh-client-modules/client')
  if (factory === undefined) {
    delete windowState.__ModuleLoader__
    throw new Error('integration: client module handoff did not register')
  }
  try {
    const exports = factory(() => {
      throw new Error('integration: dsh-client-modules bootstrap unexpectedly required an external')
    })
    return exports.ClientModuleSystem as ClientModuleSystemConstructor
  } finally {
    delete windowState.__ModuleLoader__
  }
}

export async function buildModuleSystem(entries: BundleMap): Promise<ClientModuleLoader> {
  const corePath = join(ROOT, 'packages', 'webpage', 'lib', 'client.js')
  const runtimePath = join(WEBPAGE_NODE_MODULES, 'dsh-client-runtime', 'lib', 'client.js')
  const localePath = join(WEBPAGE_NODE_MODULES, 'dsh-client-locale', 'lib', 'client.js')
  const bundles = new Map<string, string>([
    [CORE_ID, corePath],
    [RUNTIME_ID, runtimePath],
    [LOCALE_ID, localePath],
    ...entries,
  ])
  const missing = (await Promise.all([...bundles].map(async ([id, path]) => {
    try {
      await access(path)
      return undefined
    } catch {
      return `${id} (${path})`
    }
  }))).filter((entry): entry is string => entry !== undefined)
  if (missing.length) {
    throw new Error(`integration: missing built entries ${missing.join(', ')}; run pnpm run build first`)
  }

  const ClientModuleSystem = await loadClientModuleSystemConstructor()
  const modules = new ClientModuleSystem({
    modules: [...bundles].map(([id, path]) => ({
      id,
      url: pathToFileURL(path).href,
      rev: DSH_RC6,
    })),
    staticModules: createStaticModules(),
    loadBundle: async (url) => {
      const code = await readFile(fileURLToPath(url), 'utf8')
      ;(0, eval)(code)
    },
  })
  windowState.__DSH_MODULES__ = modules as never
  return modules
}

export async function createTestContext(modules: ClientModuleLoader): Promise<TestContext> {
  const ctx = new Context() as TestContext
  await ctx.plugin(Loader, { baseUrl: pathToFileURL(join(ROOT, 'tests', 'integration')).href })
  // This is the official Loader/internal handoff used by the web boot: the
  // vendored Loader must import every entry through ClientModuleSystem.
  ctx.loader.internal = modules as never
  await createServices(ctx, modules)
  return ctx
}

async function createServices(ctx: TestContext, modules: ClientModuleLoader): Promise<void> {
  const runtime = await modules.import(RUNTIME_ID, '', {}) as {
    SlotRegistry: new (ctx: Context) => unknown
  }
  new runtime.SlotRegistry(ctx)

  const localeModule = await modules.import(LOCALE_ID, '', {}) as {
    LocaleRuntime: new (ctx: Context) => LocaleRuntime
  }
  const locale = new localeModule.LocaleRuntime(ctx)
  ctx.reflect.provide('locale', locale)
  ctx.slots.installLocale(locale as never)
}

export async function flushSlotEffects(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

export function keyedEntries(ctx: TestContext): SlotEntry[] {
  return [...ctx.slots.entriesOfSlot('webpage.app')] as SlotEntry[]
}

export function extensionEntries(ctx: TestContext, slot = 'phase3.beta.extension'): SlotEntry[] {
  const slots = ctx.slots as unknown as { entriesOfSlot(key: string): readonly SlotEntry[] }
  return [...slots.entriesOfSlot(slot)]
}

export function MinimalRoot(_props: PropsRenderSlots<'shell.overlay'>): null {
  return null
}

export async function createLoaderEntry(ctx: TestContext, id: string): Promise<string> {
  // Loader's published d.ts omits the optional stable id even though its
  // runtime EntryTree.create() accepts and preserves it.
  return ctx.loader.create({ id, name: id } as never)
}
