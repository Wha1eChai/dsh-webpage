import type { ReactNode } from 'react'
import type { WebpageAppSlotProps } from '@dshapps/webpage/client'

export type CrashAppProps = WebpageAppSlotProps

/** Intentionally throw so Webpage can prove a crashed App is only a closed window. */
export function CrashApp(_props: CrashAppProps): ReactNode {
  throw new Error('intentional crash')
}
