import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { WebpageAppSlotProps } from '@wha1echai/dsh-webpage/client'
import type { ReactNode } from 'react'

type AppComponent = (props: WebpageAppSlotProps) => ReactNode

/** Compile-only proof that the packed client declarations expose both service and SlotMap merges. */
export function contributeApp(ctx: ClientContext, App: AppComponent): void {
  ctx.effect(() => {
    const disposeMetadata = ctx.pages.register({ id: 'phase3.public', label: 'Public contract fixture' })
    const disposeSlot = ctx.slots.inject('webpage.app', () => ctx.slots.register({
      name: 'webpage.app',
      key: 'phase3.public',
    }, App))
    return () => {
      disposeSlot()
      disposeMetadata()
    }
  }, 'phase3 public contract compile proof')
}
