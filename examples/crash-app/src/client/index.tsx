import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { AppDescriptor } from '@dshapps/webpage/client'

import { CrashApp } from './CrashApp.js'
import { en, zh } from './locales.js'

const descriptor = Object.freeze({
  id: 'dshapps.crash',
  label: 'Crash App',
  description: 'Throws on open so the App failure domain can be demonstrated.',
  order: 90,
  categories: ['reference'],
}) satisfies AppDescriptor

const LOCALE_NAMESPACE = 'crash'

/** Stable Loader identity used for Cordis fiber provenance. */
export const name = '@dshapps/webpage-crash-app'

/** Client services required by the crash App. */
export const inject = ['pages', 'slots', 'locale']

/** Register the crashing App metadata and its slot-owned UI in one Cordis effect. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    const unregisterLocale = ctx.locale.register(LOCALE_NAMESPACE, { zh, en })
    const unregisterPage = ctx.pages.register(descriptor)
    const unregisterSlot = ctx.slots.inject('webpage.app', () => ctx.slots.register({
      name: 'webpage.app',
      key: descriptor.id,
      locale: LOCALE_NAMESPACE,
    }, CrashApp))

    return () => {
      unregisterSlot()
      unregisterPage()
      unregisterLocale()
    }
  }, 'dsh-webpage-crash-app: composition')
}

export type { CrashAppProps } from './CrashApp.js'
