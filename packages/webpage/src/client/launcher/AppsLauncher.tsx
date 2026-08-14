import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'

import type { AppsLauncherSlotProps } from '../slots.js'
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

/** The launcher callback supplied by the Webpage client composition. */
export interface AppsLauncherInjection {
  openApps(): void
}

/** Four-share props for the sidebar.footer.action Apps launcher entry. */
export type AppsLauncherProps = AppsLauncherSlotProps & PropsLocale<'webpage'> & InjectFace<AppsLauncherInjection>

/** Open the Webpage Apps catalog from the sidebar footer. */
export function AppsLauncher({ wide, openApps, t }: AppsLauncherProps): JSX.Element {
  const label = t('apps')

  return (
    <button
      type="button"
      className={wide ? styles.button : `${styles.button} ${styles.rail}`}
      aria-label={label}
      title={label}
      onClick={openApps}
    >
      <AppsIcon size={wide ? 16 : 18} />
      {wide && <span className={styles.label}>{label}</span>}
    </button>
  )
}
