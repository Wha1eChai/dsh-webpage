import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@wha1echai/dsh-webpage-reference-app/client'

import { ReferenceAction } from './ReferenceAction.js'
import { ACTION_ID, en, LOCALE_NAMESPACE, zh } from './locales.js'

export type { ReferenceActionProps } from './ReferenceAction.js'

/** Stable client plugin identity used by Loader and slot diagnostics. */
export const name = '@wha1echai/dsh-webpage-reference-extension'

/** DSH client services required by this ordinary extension plugin. */
export const inject = ['slots', 'locale']

/** Install the reference action through the App-owned child slot only. */
export function apply(ctx: ClientContext): void {
  ctx.effect(
    () => ctx.locale.register(LOCALE_NAMESPACE, { zh, en }),
    'dsh-webpage-reference-extension: dictionaries',
  )

  ctx.slots.inject('wha1echai.reference.actions', () => ctx.slots.register({
    name: 'wha1echai.reference.actions',
    id: ACTION_ID,
    locale: LOCALE_NAMESPACE,
  }, ReferenceAction))
}
