import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-runtime/client'

import type { RegisteredApp } from '../contract.js'
import type { AppsLauncherSlotProps } from '../slots.js'
import { AppEmpty, AppList, AppRow } from '../../ui/index.js'
import styles from './AppsLauncher.module.css'

interface AppsIconProps {
  size: number
}

/** The rc.6 public icon set has no Apps/Grid glyph, so keep this local and semantic. */
function AppsIcon({ size }: AppsIconProps): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className={styles.icon}
      focusable="false"
      height={size}
      viewBox="0 0 16 16"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2.25 2.25h4.5v4.5h-4.5zm7 0h4.5v4.5h-4.5zm-7 7h4.5v4.5h-4.5zm7 0h4.5v4.5h-4.5z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  )
}

/** The launcher callbacks supplied by the Webpage client composition. */
export interface AppsLauncherInjection {
  hooks: {
    apps: ObservableSnapshot<readonly RegisteredApp[]>
  }
  openApp(id: string): void
}

/** Four-share props for the sidebar.footer.action Apps launcher entry. */
export type AppsLauncherProps = AppsLauncherSlotProps & PropsLocale<'webpage'> & InjectFace<AppsLauncherInjection>

function matchesApp(app: RegisteredApp, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (needle.length === 0) return true
  if (app.label.toLowerCase().includes(needle) || app.id.toLowerCase().includes(needle)) return true
  if (app.description?.toLowerCase().includes(needle) === true) return true
  return app.categories?.some(category => category.toLowerCase().includes(needle)) === true
}

function paletteStyle(anchor: DOMRect | undefined): CSSProperties {
  if (anchor === undefined) return { visibility: 'hidden' }
  const width = 320
  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8))
  const spaceAbove = anchor.top - 8
  if (spaceAbove >= 240) {
    return { left, bottom: window.innerHeight - anchor.top + 8, width }
  }
  return { left, top: anchor.bottom + 8, width }
}

/** Open the App launch panel from the sidebar footer. */
export function AppsLauncher({ wide, openApp, t, useApps }: AppsLauncherProps): JSX.Element {
  const label = t('apps')
  const apps = useApps(snapshot => snapshot)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [anchor, setAnchor] = useState<DOMRect>()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const filtered = apps.filter(app => matchesApp(app, query))

  const closePanel = (): void => {
    setOpen(false)
    setQuery('')
  }

  useLayoutEffect(() => {
    if (!open) return
    const sync = (): void => setAnchor(buttonRef.current?.getBoundingClientRect())
    sync()
    window.addEventListener('resize', sync)
    window.addEventListener('scroll', sync, true)
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('scroll', sync, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') closePanel()
    }
    const onPointerDown = (event: MouseEvent): void => {
      const target = event.target
      if (target instanceof Node && (buttonRef.current?.contains(target) === true || panelRef.current?.contains(target) === true)) return
      closePanel()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={wide ? styles.button : `${styles.button} ${styles.rail}`}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={label}
        onClick={() => {
          if (open) closePanel()
          else setOpen(true)
        }}
      >
        <AppsIcon size={wide ? 16 : 18} />
        {wide && <span className={styles.label}>{label}</span>}
      </button>
      {open && createPortal((
        <div
          ref={panelRef}
          className={styles.palette}
          role="dialog"
          aria-label={label}
          aria-modal="true"
          style={paletteStyle(anchor)}
        >
          <Input
            type="search"
            value={query}
            placeholder={t('filterApps')}
            aria-label={t('filterApps')}
            onChange={event => setQuery(event.target.value)}
          />
          {filtered.length === 0
            ? <AppEmpty>{apps.length === 0 ? t('noApps') : t('noMatchingApps')}</AppEmpty>
            : (
              <AppList label={label}>
                {filtered.map(app => (
                  <AppRow
                    key={app.id}
                    data-app-id={app.id}
                    title={app.label}
                    description={app.description ?? app.id}
                    onClick={() => {
                      openApp(app.id)
                      closePanel()
                    }}
                  />
                ))}
              </AppList>
            )}
        </div>
      ), document.body)}
    </>
  )
}
