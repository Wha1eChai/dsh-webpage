import type { PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { AppOwnerProps } from './contract.js'
import type { WebpageLocaleKey } from './locales.js'

/** Owner share passed to Inspector pane contributions. */
export interface InspectorPaneOwner {
  readonly appPath: string
}

/** Owner share passed to the `open_app` keyed toolview. */
export interface OpenAppToolViewOwner {
  callId: string
  toolName: string
  block: OpenAppCallBlock
}

/** Running call or settled result slice used to read `open_app` arguments. */
export type OpenAppCallBlock =
  | { readonly argsRaw: string }
  | { readonly kind: 'tool-result'; readonly call: { readonly argsRaw: string } | null }

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /** Addressable App bodies, dispatched by their canonical App ID. */
    'webpage.app': { kind: 'keyed'; scope: 'root'; owner: AppOwnerProps }
    /** Read-only Inspector panes contributed under the catalog App. */
    'webpage.inspector.pane': { kind: 'list'; scope: 'root'; owner: InspectorPaneOwner }
    /**
     * Keyed atomic tool view. Webpage occupies `open_app` so the generic
     * tool row is replaced; a conversationEvents node would double-render.
     */
    'tool.call.toolview': { kind: 'keyed'; scope: 'session'; owner: OpenAppToolViewOwner }
  }

  interface LocaleNamespaceMap {
    /** Core Webpage Outlet, launcher, unavailable state, and Inspector copy. */
    webpage: WebpageLocaleKey
  }
}

/** Four-share slot props owned by the frame-wide Webpage Outlet. */
export type WebpageOutletSlotProps = PropsRuntime<'shell.overlay'> & PropsRenderSlots<'webpage.app'>

/** Runtime owner share of an App contribution. */
export type WebpageAppSlotProps = PropsRuntime<'webpage.app'>

/** Runtime owner share of an Inspector pane contribution. */
export type InspectorPaneSlotProps = PropsRuntime<'webpage.inspector.pane'>

/** Runtime owner share of the sidebar Apps launcher. */
export type AppsLauncherSlotProps = PropsRuntime<'sidebar.footer.action'>
