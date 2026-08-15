import type { ReactNode } from 'react'

import styles from './kit.module.css'

export interface AppListProps {
  label?: string
  dense?: boolean
  children: ReactNode
}

export interface AppRowProps {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  leading?: ReactNode
  trailing?: ReactNode
  children?: ReactNode
  onClick?: () => void
  titleAs?: 'h2' | 'span'
  dense?: boolean
  className?: string
  'data-app-id'?: string
  'data-job-id'?: string
}

/** Vertical list of `AppRow` entries. */
export function AppList({ label, dense = false, children }: AppListProps): ReactNode {
  return (
    <ul className={[styles.list, dense ? styles.listDense : undefined].filter(Boolean).join(' ')} aria-label={label}>
      {children}
    </ul>
  )
}

/** One App or resource row. A click handler makes the whole row the control. */
export function AppRow({
  title,
  description,
  icon,
  leading,
  trailing,
  children,
  onClick,
  titleAs = 'span',
  dense = false,
  className,
  'data-app-id': dataAppId,
  'data-job-id': dataJobId,
}: AppRowProps): ReactNode {
  const TitleTag = titleAs
  const extras = {
    ...(dataAppId === undefined ? {} : { 'data-app-id': dataAppId }),
    ...(dataJobId === undefined ? {} : { 'data-job-id': dataJobId }),
  }
  const rowClass = [
    styles.row,
    dense ? styles.rowDense : undefined,
    onClick === undefined ? undefined : styles.rowButton,
    className,
  ].filter(Boolean).join(' ')
  const body = (
    <>
      <div className={styles.rowMain}>
        {icon === undefined && leading === undefined ? null : (
          <span className={styles.leading}>
            {icon === undefined ? null : <span className={styles.icon}>{icon}</span>}
            {leading}
          </span>
        )}
        <span className={styles.rowCopy}>
          <TitleTag className={styles.rowTitle}>{title}</TitleTag>
          {description === undefined ? null : <p className={styles.rowDescription}>{description}</p>}
        </span>
        {trailing === undefined ? null : <span className={styles.trailing}>{trailing}</span>}
      </div>
      {children}
    </>
  )

  return (
    <li>
      {onClick === undefined
        ? <article className={rowClass} {...extras}>{body}</article>
        : <button type="button" className={rowClass} onClick={onClick} {...extras}>{body}</button>}
    </li>
  )
}
