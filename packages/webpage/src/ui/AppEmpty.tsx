import type { ReactNode } from 'react'

import styles from './kit.module.css'

export interface AppEmptyProps {
  children: ReactNode
}

/** Localized empty-state sentence used by lists and Inspector panes. */
export function AppEmpty({ children }: AppEmptyProps): ReactNode {
  return <p className={styles.empty}>{children}</p>
}
