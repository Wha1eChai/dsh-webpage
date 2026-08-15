import type { ReactNode } from 'react'

import styles from './kit.module.css'

export interface AppFieldsProps {
  children: ReactNode
}

export interface AppFieldProps {
  field: string
  label: string
  value: ReactNode
  valueClassName?: string
}

/** Definition list used by Inspector cards and App detail pages. */
export function AppFields({ children }: AppFieldsProps): ReactNode {
  return <dl className={styles.fields}>{children}</dl>
}

/** One labeled value inside `AppFields`. */
export function AppField({ field, label, value, valueClassName }: AppFieldProps): ReactNode {
  return (
    <div className={styles.field} data-field={field}>
      <dt className={styles.fieldLabel}>{label}</dt>
      <dd className={valueClassName === undefined ? styles.fieldValue : `${styles.fieldValue} ${valueClassName}`}>
        {value}
      </dd>
    </div>
  )
}
