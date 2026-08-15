import type { ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'

import { isAppId, isValidAppPath } from '../../app-id.js'
import { AppField, AppFields, AppList, AppRow } from '../../ui/index.js'
import type { RegisteredApp } from '../contract.js'
import styles from './OpenAppCard.module.css'

export interface OpenAppCardInject {
  resolveApp(id: string): RegisteredApp | undefined
  openApp(id: string, path?: string): void
}

/**
 * Structural owner + locale + inject face. Do not augment SlotMap with
 * `tool.call.toolview`: ui-tool already owns that key (`ToolCallOwnerProps` /
 * `ToolCallViewProps` on `@deepseek-ai/dsh-client-ui-tool/client`), and a
 * second narrower owner conflicts. Those published types also pull
 * `@deepseek-ai/dsh-client-ui-conversation`, which is not a webpage peer.
 */
export interface OpenAppCallBlock {
  readonly argsRaw?: string
  readonly kind?: string
  readonly call?: { readonly argsRaw: string } | null
}

export interface OpenAppCardOwner {
  callId: string
  toolName: string
  block: OpenAppCallBlock
}

export type OpenAppCardProps =
  OpenAppCardOwner
  & PropsLocale<'webpage'>
  & InjectFace<OpenAppCardInject>

export interface OpenAppSuggestion {
  readonly appId: string
  readonly path?: string
}

/** Read `app_id` / `path` from a frozen tool call or result block. Pure. */
export function readOpenAppSuggestion(block: OpenAppCallBlock): OpenAppSuggestion | undefined {
  const raw = block.kind === 'tool-result' ? block.call?.argsRaw : block.argsRaw
  if (typeof raw !== 'string') return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return undefined
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined
  const appId = (parsed as { app_id?: unknown }).app_id
  if (typeof appId !== 'string') return undefined
  const path = (parsed as { path?: unknown }).path
  if (typeof path === 'string') return { appId, path }
  return { appId }
}

function canOpenSuggestion(suggestion: OpenAppSuggestion): boolean {
  return isAppId(suggestion.appId)
    && (suggestion.path === undefined || isValidAppPath(suggestion.path))
}

/** Inert suggestion card for an `open_app` tool call. Clicking opens; render does not. */
export function OpenAppCard(props: OpenAppCardProps): ReactNode {
  const suggestion = readOpenAppSuggestion(props.block)
  const app = suggestion === undefined ? undefined : props.resolveApp(suggestion.appId)
  const label = app?.label ?? suggestion?.appId ?? props.t('unknown')
  const path = suggestion?.path
  const installed = app !== undefined

  let pathField: ReactNode = null
  if (path !== undefined) {
    pathField = <AppField field="path" label={props.t('openAppPath')} value={path} />
  }

  let statusField: ReactNode = null
  if (suggestion !== undefined && !installed) {
    statusField = (
      <AppField
        field="status"
        label={props.t('slotStatus')}
        value={props.t('appNotInstalled')}
        valueClassName={styles.missing}
      />
    )
  }

  let fields: ReactNode = null
  if (pathField !== null || statusField !== null) {
    fields = (
      <AppFields>
        {pathField}
        {statusField}
      </AppFields>
    )
  }

  let trailing: ReactNode
  if (suggestion !== undefined && canOpenSuggestion(suggestion)) {
    const target = suggestion
    trailing = (
      <Button
        variant="primary"
        size="sm"
        onClick={() => props.openApp(target.appId, target.path)}
      >
        {props.t('openApp')}
      </Button>
    )
  }

  return (
    <div className={styles.card} data-open-app={suggestion?.appId ?? 'invalid'}>
      <AppList label={props.t('openAppSuggestion')}>
        <AppRow
          data-app-id={suggestion?.appId}
          title={label}
          trailing={trailing}
        >
          {fields}
        </AppRow>
      </AppList>
    </div>
  )
}
