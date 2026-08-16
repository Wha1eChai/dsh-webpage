import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { InspectorPaneSlotProps, WebpageAppSlotProps } from '@dshapps/webpage/client'
import type { AppPage } from '@dshapps/webpage/ui'
import type { ReactNode } from 'react'

/** Compile-only proof that the optional /ui kit is a public export. */
export type PublicAppPage = typeof AppPage

type AppComponent = (props: WebpageAppSlotProps) => ReactNode

/** Compile-only proof that Inspector pane slot props are part of the public client contract. */
export type PublicInspectorPane = (props: InspectorPaneSlotProps) => ReactNode

/** Compile-only proof that the packed client declarations expose both service and SlotMap merges. */
export function contributeApp(ctx: ClientContext, App: AppComponent): void {
  ctx.effect(() => {
    const disposeMetadata = ctx.pages.register({ id: 'phase3.public', label: 'Public contract fixture', surface: 'panel' })
    const disposeSlot = ctx.slots.inject('webpage.app', () => ctx.slots.register({
      name: 'webpage.app',
      key: 'phase3.public',
    }, App))
    ctx.pages.open('phase3.public', '/')
    ctx.pages.close({ replace: true })
    return () => {
      disposeSlot()
      disposeMetadata()
    }
  }, 'phase3 public contract compile proof')
}
