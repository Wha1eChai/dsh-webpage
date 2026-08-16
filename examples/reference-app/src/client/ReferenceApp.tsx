import type { ReactNode } from 'react'
import type { PropsLocale, PropsRenderSlots } from '@deepseek-ai/dsh-client-ui-slots'
import type { AppOwnerProps, WebpageAppSlotProps } from '@dshapps/webpage/client'
import type { ReferenceAppOwner } from '../index.js'

import type {} from './locales.js'
import styles from './ReferenceApp.module.css'

export type ReferenceAppProps =
  WebpageAppSlotProps
  & PropsRenderSlots<'dshapps.reference.actions'>
  & PropsLocale<'reference'>

type PageProps = Pick<AppOwnerProps, 'navigate' | 'close'> & Pick<ReferenceAppProps, 't'> & {
  actions: ReactNode
  appPath: string
}

function ActionArea({ actions, t }: Pick<PageProps, 'actions' | 't'>): ReactNode {
  return (
    <section className={styles.actions} aria-label={t('actions')}>
      <h2 className={styles.sectionTitle}>{t('actions')}</h2>
      <div className={styles.actionList}>{actions}</div>
    </section>
  )
}

function RootPage({ actions, close, navigate, t }: PageProps): ReactNode {
  return (
    <article className={styles.page} data-route="/">
      <div className={styles.hero}>
        <span className={styles.eyebrow}>{t('title')}</span>
        <h1 className={styles.title}>{t('rootTitle')}</h1>
        <p className={styles.description}>{t('rootDescription')}</p>
      </div>
      <div className={styles.controls}>
        <button type="button" className={styles.primaryButton} onClick={() => navigate('/details')}>
          {t('openDetails')}
        </button>
        <button type="button" className={styles.secondaryButton} onClick={() => close()}>
          {t('close')}
        </button>
      </div>
      <ActionArea actions={actions} t={t} />
    </article>
  )
}

function DetailsPage({ actions, close, navigate, t }: PageProps): ReactNode {
  return (
    <article className={styles.page} data-route="/details">
      <div className={styles.hero}>
        <span className={styles.eyebrow}>{t('title')}</span>
        <h1 className={styles.title}>{t('detailsTitle')}</h1>
        <p className={styles.description}>{t('detailsDescription')}</p>
      </div>
      <div className={styles.controls}>
        <button type="button" className={styles.primaryButton} onClick={() => navigate('/')}>
          {t('backToRoot')}
        </button>
        <button type="button" className={styles.secondaryButton} onClick={() => close()}>
          {t('close')}
        </button>
      </div>
      <ActionArea actions={actions} t={t} />
    </article>
  )
}

function NotFoundPage({ actions, close, navigate, t, appPath }: PageProps): ReactNode {
  return (
    <article className={styles.page} data-route="not-found">
      <div className={styles.notFound}>
        <span className={styles.eyebrow}>{t('title')}</span>
        <h1 className={styles.title}>{t('notFoundTitle')}</h1>
        <p className={styles.description}>{t('notFoundDescription')}</p>
        <code className={styles.path}>{appPath}</code>
      </div>
      <div className={styles.controls}>
        <button type="button" className={styles.primaryButton} onClick={() => navigate('/')}>
          {t('backToRoot')}
        </button>
        <button type="button" className={styles.secondaryButton} onClick={() => close()}>
          {t('close')}
        </button>
      </div>
      <ActionArea actions={actions} t={t} />
    </article>
  )
}

/** Render the reference App route and the App-owned extension slot. */
export function ReferenceApp({ appPath, close, navigate, renderSlot, t }: ReferenceAppProps): ReactNode {
  const owner: ReferenceAppOwner = Object.freeze({ appPath })
  const actions = renderSlot('dshapps.reference.actions', owner)
  const pageProps = { actions, appPath, close, navigate, t }

  if (appPath === '/') return <RootPage {...pageProps} />
  if (appPath === '/details') return <DetailsPage {...pageProps} />
  return <NotFoundPage {...pageProps} />
}
