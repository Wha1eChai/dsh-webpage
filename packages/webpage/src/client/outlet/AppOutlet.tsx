import type { ReactNode } from 'react'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-runtime/client'

import type { AppOwnerProps, AppRoute, RegisteredApp } from '../contract.js'
import type { WebpageOutletSlotProps } from '../slots.js'
import styles from './AppOutlet.module.css'

/** The business face supplied by the Webpage client composition. */
export interface AppOutletInjection {
  hooks: {
    route: ObservableSnapshot<AppRoute | undefined>
    apps: ObservableSnapshot<readonly RegisteredApp[]>
  }
  navigate: AppOwnerProps['navigate']
  close: AppOwnerProps['close']
}

/** Four-share props for the shell.overlay Webpage Outlet entry. */
export type AppOutletProps = WebpageOutletSlotProps & PropsLocale<'webpage'> & InjectFace<AppOutletInjection>

function UnavailableApp({ t }: Pick<AppOutletProps, 't'>): ReactNode {
  return (
    <section className={styles.unavailable}>
      <h2 className={styles.unavailableTitle}>{t('unavailableTitle')}</h2>
      <p className={styles.unavailableDescription}>{t('unavailableDescription')}</p>
    </section>
  )
}

/** Render the active App over the existing shell without replacing it. */
export function AppOutlet({
  renderSlot,
  t,
  useRoute,
  useApps,
  navigate,
  close,
}: AppOutletProps): ReactNode {
  const route = useRoute(snapshot => snapshot)
  const descriptor = useApps(apps => apps.find(app => app.id === route?.appId))

  if (route === undefined) return null

  const unavailable = <UnavailableApp t={t} />
  let body: ReactNode = unavailable

  if (descriptor !== undefined) {
    const owner: AppOwnerProps = Object.freeze({
      appId: route.appId,
      appPath: route.appPath,
      search: route.search,
      hash: route.hash,
      navigate,
      close,
    })
    body = renderSlot('webpage.app', owner, {
      entryKey: route.appId,
      fallback: unavailable,
    }) ?? unavailable
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.frame} role="dialog" aria-modal="true" aria-label={descriptor?.label ?? route.appId}>
        <header className={styles.chrome}>
          <span className={styles.label}>{descriptor?.label ?? route.appId}</span>
          <button type="button" className={styles.close} aria-label={t('close')} onClick={() => close()}>
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <main className={styles.body}>{body}</main>
      </div>
    </div>
  )
}
