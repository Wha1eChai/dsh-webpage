import type { ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ReferenceAppOwner } from '@wha1echai/dsh-webpage-reference-app'
import type {} from '@wha1echai/dsh-webpage-reference-app/client'

import { LOCALE_NAMESPACE } from './locales.js'
import styles from './ReferenceAction.module.css'

/** Props are derived from the reference App's public child-slot declaration. */
export type ReferenceActionProps = PropsRuntime<'wha1echai.reference.actions'>
  & ReferenceAppOwner
  & PropsLocale<typeof LOCALE_NAMESPACE>

/** A small list contribution that makes the owning App path visible. */
export function ReferenceAction({ appPath, t }: ReferenceActionProps): ReactNode {
  return (
    <article className={styles.action} data-testid="reference-action">
      <h2 className={styles.title}>{t('actionTitle')}</h2>
      <p className={styles.path}>
        <span>{t('pathLabel')}: </span>
        <code data-testid="reference-action-app-path">{appPath}</code>
      </p>
    </article>
  )
}
