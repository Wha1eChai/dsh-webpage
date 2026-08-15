import {
  Component,
  Fragment,
  Suspense,
  useLayoutEffect,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react'

import type { WebpageLocaleKey } from '../locales.js'
import styles from './AppOutlet.module.css'

export interface AppBoundaryProps {
  appId: string
  sourcePlugin?: string
  t(key: WebpageLocaleKey): string
  children: ReactNode
}

interface AppBoundaryState {
  error: Error | null
  generation: number
}

function CrashedApp({ t, onRetry }: { t: AppBoundaryProps['t']; onRetry(): void }): ReactNode {
  return (
    <section className={styles.unavailable} data-app-state="crashed">
      <h2 className={styles.unavailableTitle}>{t('crashedTitle')}</h2>
      <p className={styles.unavailableDescription}>{t('crashedDescription')}</p>
      <button type="button" className={styles.retry} onClick={onRetry}>
        {t('retry')}
      </button>
    </section>
  )
}

function LoadingApp({ t }: { t: AppBoundaryProps['t'] }): ReactNode {
  return (
    <section className={styles.unavailable} data-app-state="loading">
      <p className={styles.unavailableDescription}>{t('loading')}</p>
    </section>
  )
}

/** Isolate a throwing or lazy App body so chrome, conversation, and other Apps stay up. */
export class AppBoundary extends Component<AppBoundaryProps, AppBoundaryState> {
  public state: AppBoundaryState = { error: null, generation: 0 }

  public static getDerivedStateFromError(error: Error): Partial<AppBoundaryState> {
    return { error }
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    const source = this.props.sourcePlugin ?? 'unknown'
    console.error('[dsh-webpage] App crashed:', this.props.appId, source, error, info)
  }

  public componentDidUpdate(prevProps: AppBoundaryProps): void {
    if (prevProps.appId !== this.props.appId && this.state.error !== null) {
      this.setState({ error: null })
    }
  }

  private readonly retry = (): void => {
    this.setState(state => ({ error: null, generation: state.generation + 1 }))
  }

  public render(): ReactNode {
    const { t, children } = this.props
    if (this.state.error !== null) {
      return <CrashedApp t={t} onRetry={this.retry} />
    }
    return (
      <GuardedBody resetKey={`${this.props.appId}:${this.state.generation}`} t={t} onRetry={this.retry}>
        {children}
      </GuardedBody>
    )
  }
}

/**
 * DSH's slot renderer has a closer error boundary. After it abdicates a keyed
 * entry it leaves `data-slot-error` and the Outlet owns the crash face.
 */
function GuardedBody({
  resetKey,
  t,
  onRetry,
  children,
}: {
  resetKey: string
  t: AppBoundaryProps['t']
  onRetry(): void
  children: ReactNode
}): ReactNode {
  const rootRef = useRef<HTMLDivElement>(null)
  const [slotCrashed, setSlotCrashed] = useState(false)

  useLayoutEffect(() => {
    setSlotCrashed(false)
    const root = rootRef.current!
    const sync = (): void => {
      if (root.querySelector('[data-slot-error]') !== null) setSlotCrashed(true)
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [resetKey])

  return (
    <div ref={rootRef} style={{ display: 'contents' }}>
      {slotCrashed
        ? <CrashedApp t={t} onRetry={onRetry} />
        : (
          <Suspense fallback={<LoadingApp t={t} />}>
            <Fragment key={resetKey}>{children}</Fragment>
          </Suspense>
        )}
    </div>
  )
}
