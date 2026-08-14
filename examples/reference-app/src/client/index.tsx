import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { AppDescriptor } from '@wha1echai/dsh-webpage/client'

import { en, zh } from './locales.js'
import { ReferenceApp } from './ReferenceApp.js'

const descriptor = Object.freeze({
  id: 'wha1echai.reference',
  label: 'Reference App',
  description: 'A small nested-route App used to verify DSH Webpage composition.',
  order: 10,
  categories: ['reference'],
}) satisfies AppDescriptor

const LOCALE_NAMESPACE = 'reference'

/** Stable Loader identity used for Cordis fiber provenance. */
export const name = '@wha1echai/dsh-webpage-reference-app'

/** Client services required by the reference App. */
export const inject = ['pages', 'slots', 'locale']

/** Register the App metadata and its slot-owned UI in one Cordis effect. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    const unregisterLocale = ctx.locale.register(LOCALE_NAMESPACE, { zh, en })
    const unregisterPage = ctx.pages.register(descriptor)
    const unregisterSlot = ctx.slots.inject('webpage.app', () => ctx.slots.register({
      name: 'webpage.app',
      key: descriptor.id,
      locale: LOCALE_NAMESPACE,
      children: {
        'wha1echai.reference.actions': { kind: 'list', scope: 'root' },
      },
    }, ReferenceApp))

    return () => {
      unregisterSlot()
      unregisterPage()
      unregisterLocale()
    }
  }, 'dsh-webpage-reference-app: composition')
}
