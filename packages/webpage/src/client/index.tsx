import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'

import type { AppNavigateOptions } from './contract.js'
import { CatalogPane } from './inspector/CatalogPane.js'
import { Inspector } from './inspector/index.js'
import { TopologyPane } from './inspector/TopologyPane.js'
import { createSlotTopologySource } from './inspector/topology.js'
import { AppsLauncher } from './launcher/AppsLauncher.js'
import { en, zh } from './locales.js'
import { OpenAppCard, type OpenAppCardInject } from './open-app/OpenAppCard.js'
import { AppOutlet } from './outlet/AppOutlet.js'
import { PagesService as PagesRegistryService } from './registry/index.js'
import { createRouteController } from './route/index.js'
import type {} from './slots.js'

export type {
  AppDescriptor,
  AppNavigateOptions,
  AppOwnerProps,
  AppRoute,
  AppSurface,
  PagesService,
  RegisteredApp,
  RouteControllerContract,
} from './contract.js'
export { APP_SURFACES, resolveAppSurface } from './contract.js'
export type { WebpageAppSlotProps, InspectorPaneOwner, InspectorPaneSlotProps } from './slots.js'

const LOCALE_NAMESPACE = 'webpage'
const INSPECTOR_APP_ID = 'wha1echai.webpage'

/** Stable Cordis fiber name used by provenance and slot diagnostics. */
export const name = '@wha1echai/dsh-webpage'

/**
 * Client services required by the Addressable App foundation.
 * `slots` already covers the keyed `tool.call.toolview` hole; `pages` is this
 * plugin's own service and is passed through the card inject face. Do not add
 * `conversationEvents` — a second tool/result node would double-render beside
 * ui-conversation's existing tool-call definition.
 */
export const inject = ['slots', 'locale']

/** Install the metadata registry, native-History controller, and DSH slot surfaces. */
export function apply(ctx: ClientContext): void {
  const route = createRouteController(window)
  const pages = new PagesRegistryService(ctx, route)
  ctx.effect(() => () => route.dispose(), 'dsh-webpage: route controller')
  const topology = createSlotTopologySource(ctx)
  ctx.effect(() => () => topology.dispose(), 'dsh-webpage: topology source')

  ctx.effect(() => ctx.locale.register(LOCALE_NAMESPACE, { zh, en }), 'dsh-webpage: dictionaries')

  pages.register({
    id: INSPECTOR_APP_ID,
    label: 'Webpage',
    description: 'Inspect registered Apps and their extension topology.',
    order: -1000,
    categories: ['system'],
  })

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'webpage.outlet',
    order: 100,
    locale: LOCALE_NAMESPACE,
    children: { 'webpage.app': { kind: 'keyed', scope: 'root' } },
    inject: () => ({
      hooks: { route: pages.current, apps: pages.list },
      navigate: (appPath: string, options?: AppNavigateOptions) => route.navigate(appPath, options),
      close: (options?: { replace?: boolean }) => pages.close(options),
    }),
  }, AppOutlet))

  ctx.slots.inject('webpage.app', () => ctx.slots.register({
    name: 'webpage.app',
    key: INSPECTOR_APP_ID,
    locale: LOCALE_NAMESPACE,
    children: {
      'webpage.inspector.pane': { kind: 'list', scope: 'root' },
    },
  }, Inspector))

  ctx.slots.inject('webpage.inspector.pane', () => ctx.slots.register({
    name: 'webpage.inspector.pane',
    id: 'webpage.inspector.catalog',
    order: 0,
    locale: LOCALE_NAMESPACE,
    inject: () => ({
      hooks: { apps: pages.list, topology },
      openApp: (id: string) => pages.open(id),
    }),
  }, CatalogPane))

  ctx.slots.inject('webpage.inspector.pane', () => ctx.slots.register({
    name: 'webpage.inspector.pane',
    id: 'webpage.inspector.topology',
    order: 10,
    locale: LOCALE_NAMESPACE,
    inject: () => ({
      hooks: { topology },
    }),
  }, TopologyPane))

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'webpage.apps',
    order: 100,
    locale: LOCALE_NAMESPACE,
    inject: () => ({
      hooks: { apps: pages.list },
      openApp: (id: string) => pages.open(id),
    }),
  }, AppsLauncher))

  // ui-tool dispatches each atomic call through keyed `tool.call.toolview`.
  // Webpage does not redeclare that SlotMap key (owner-shape conflict); the
  // card is a structural subset of ToolCallViewProps. A keyed occupant
  // replaces the generic row; do not add a conversationEvents node.
  const toolViewSlots = ctx.slots as unknown as {
    inject(name: 'tool.call.toolview', factory: () => () => void): () => void
    register(
      options: {
        name: 'tool.call.toolview'
        key: 'open_app'
        locale: string
        inject: (sessionId: string) => OpenAppCardInject
      },
      component: typeof OpenAppCard,
    ): () => void
  }
  toolViewSlots.inject('tool.call.toolview', () => toolViewSlots.register({
    name: 'tool.call.toolview',
    key: 'open_app',
    locale: LOCALE_NAMESPACE,
    inject: (_sessionId: string) => ({
      resolveApp: (id: string) => pages.get(id),
      openApp: (id: string, path?: string) => pages.open(id, path),
    }),
  }, OpenAppCard))
}
