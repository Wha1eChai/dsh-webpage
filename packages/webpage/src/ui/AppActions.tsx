import { Children, Fragment, isValidElement, type ReactNode } from 'react'

import styles from './kit.module.css'

export interface AppActionsProps {
  label?: string
  children?: ReactNode
}

/** Render contributed actions only when the slot actually produced children. */
export function AppActions({ label, children }: AppActionsProps): ReactNode {
  if (!hasContribution(children)) return null
  return (
    <section className={styles.actions} aria-label={label}>
      {label === undefined ? null : <h2 className={styles.actionTitle}>{label}</h2>}
      <div className={styles.actionList}>{children}</div>
    </section>
  )
}

function hasContribution(node: ReactNode): boolean {
  return Children.toArray(node).some(isRenderableContribution)
}

function isRenderableContribution(value: ReactNode): boolean {
  if (!isValidElement(value)) {
    return typeof value === 'string' ? value.trim().length > 0 : true
  }
  if (value.type === Fragment || typeof value.type === 'string') {
    return hasContribution((value.props as { children?: ReactNode }).children)
  }
  return true
}
