import type { ReactNode } from 'react'
import type { PropsLocale, PropsRenderSlots } from '@deepseek-ai/dsh-client-ui-slots'

import { AppPage } from '../../ui/index.js'
import type { InspectorPaneOwner } from '../slots.js'
import type { WebpageAppSlotProps } from '../slots.js'

export type InspectorProps =
  WebpageAppSlotProps
  & PropsRenderSlots<'webpage.inspector.pane'>
  & PropsLocale<'webpage'>

/** Read-only App Inspector shell. Panes occupy `webpage.inspector.pane`. */
export function Inspector({ appPath, renderSlot, t }: InspectorProps): ReactNode {
  const owner: InspectorPaneOwner = Object.freeze({ appPath })
  return (
    <AppPage title={t('inspectorTitle')} description={t('inspectorDescription')}>
      {renderSlot('webpage.inspector.pane', owner)}
    </AppPage>
  )
}
