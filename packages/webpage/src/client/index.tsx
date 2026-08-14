import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'

import type { AppNavigateOptions } from './contract.js'
import { Inspector } from './inspector/index.js'
import { createSlotTopologySource } from './inspector/topology.js'
import { AppsLauncher } from './launcher/AppsLauncher.js'
import { en, zh } from './locales.js'
import { AppOutlet } from './outlet/AppOutlet.js'
import { PagesService as PagesRegistryService } from './registry/index.js'
import { createRouteController } from './route/index.js'
import type {} from './slots.js'

export type {
  AppDescriptor,
  AppNavigateOptions,
  AppOwnerProps,
  AppRoute,
  PagesService,
  RegisteredApp,
  RouteControllerContract,
} from './contract.js'
export type { WebpageAppSlotProps } from './slots.js'

const LOCALE_NAMESPACE = 'webpage'
const INSPECTOR_APP_ID = 'wha1echai.webpage'

/** Stable Cordis fiber name used by provenance and slot diagnostics. */
export const name = '@wha1echai/dsh-webpage'

/** Client services required by the Addressable App foundation. */
export const inject = ['slots', 'locale']

/** Install the metadata registry, native-History controller, and DSH slot surfaces. */
export function apply(ctx: ClientContext): void {
  const pages = new PagesRegistryService(ctx)
  const route = createRouteController(window)
  ctx.effect(() => () => route.dispose(), 'dsh-webpage: route controller')
  const topology = createSlotTopologySource(ctx)
  ctx.effect(() => () => topology.dispose(), 'dsh-webpage: topology source')

  ctx.effect(() => ctx.locale.register(LOCALE_NAMESPACE, { zh, en }), 'dsh-webpage: dictionaries')

  pages.register({
    id: INSPECTOR_APP_ID,
    label: 'Webpage',
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
      hooks: { route: route.current, apps: pages.list },
      navigate: (appPath: string, options?: AppNavigateOptions) => route.navigate(appPath, options),
      close: (options?: { replace?: boolean }) => route.close(options),
    }),
  }, AppOutlet))

  ctx.slots.inject('webpage.app', () => ctx.slots.register({
    name: 'webpage.app',
    key: INSPECTOR_APP_ID,
    locale: LOCALE_NAMESPACE,
    inject: () => ({
      hooks: { apps: pages.list, topology },
      openApp: (id: string) => route.open(id),
    }),
  }, Inspector))

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'webpage.apps',
    order: 100,
    locale: LOCALE_NAMESPACE,
    inject: () => ({ openApps: () => route.open(INSPECTOR_APP_ID) }),
  }, AppsLauncher))
}
