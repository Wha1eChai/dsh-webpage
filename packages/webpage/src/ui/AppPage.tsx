import type { ReactNode } from 'react'

import { AppActions } from './AppActions.js'
import styles from './kit.module.css'

export interface AppPageProps {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  actionsLabel?: string
  children?: ReactNode
}

/** Standard App body: title, optional description, content, then contributed actions. */
export function AppPage({ title, description, actions, actionsLabel, children }: AppPageProps): ReactNode {
  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
        {description === undefined ? null : <p className={styles.description}>{description}</p>}
      </header>
      {children}
      <AppActions label={actionsLabel}>{actions}</AppActions>
    </section>
  )
}
