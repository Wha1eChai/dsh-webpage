import { useEffect, type ReactNode } from 'react'
import { IconCloseOutline16, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-runtime/client'

import type { AppOwnerProps, AppRoute, AppSurface, RegisteredApp } from '../contract.js'
import { resolveAppSurface } from '../contract.js'
import type { WebpageOutletSlotProps } from '../slots.js'
import { AppBoundary } from './AppBoundary.js'
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

function useEscapeToClose(active: boolean, close: AppOutletProps['close']): void {
  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [active, close])
}

function AppChrome({
  surface,
  title,
  closeLabel,
  onClose,
  children,
}: {
  surface: Exclude<AppSurface, 'modal'>
  title: string
  closeLabel: string
  onClose(): void
  children: ReactNode
}): ReactNode {
  return (
    <div className={surface === 'panel' ? styles.panelRoot : styles.overlay}>
      {surface === 'panel' ? <div className={styles.mask} aria-hidden="true" onClick={onClose} /> : null}
      <div
        className={surface === 'panel' ? styles.panel : styles.frame}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-surface={surface}
      >
        <header className={styles.chrome}>
          <span className={styles.label}>{title}</span>
          <button type="button" className={styles.close} aria-label={closeLabel} onClick={onClose}>
            <IconCloseOutline16 size={14} />
          </button>
        </header>
        <main className={styles.body}>{children}</main>
      </div>
    </div>
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
  const surface = descriptor === undefined ? 'overlay' : resolveAppSurface(descriptor.surface)
  useEscapeToClose(route !== undefined && surface !== 'modal', close)

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

  const title = descriptor?.label ?? route.appId
  const onClose = (): void => close()
  const guarded = (
    <AppBoundary appId={route.appId} sourcePlugin={descriptor?.sourcePlugin} t={t}>
      {body}
    </AppBoundary>
  )

  if (surface === 'modal') {
    return (
      <Modal
        open
        title={title}
        closeLabel={t('close')}
        onClose={onClose}
        className={styles.modalDialog}
        contentClassName={styles.modalContent}
      >
        <div data-surface="modal">{guarded}</div>
      </Modal>
    )
  }

  return (
    <AppChrome surface={surface} title={title} closeLabel={t('close')} onClose={onClose}>
      {guarded}
    </AppChrome>
  )
}
