import type { ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { HostObservable, InjectFace, LiveSlotNode, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'

import { AppEmpty, AppField, AppFields, AppList, AppRow } from '../../ui/index.js'
import type { RegisteredApp } from '../contract.js'
import type { InspectorPaneSlotProps } from '../slots.js'
import styles from './Inspector.module.css'

interface CatalogPaneInject {
  hooks: {
    apps: HostObservable<readonly RegisteredApp[]>
    topology: HostObservable<readonly LiveSlotNode[]>
  }
  openApp(id: string): void
}

export type CatalogPaneProps = InspectorPaneSlotProps & PropsLocale<'webpage'> & InjectFace<CatalogPaneInject>

/** Default Inspector pane: registered Apps and their keyed UI status. */
export function CatalogPane(props: CatalogPaneProps): ReactNode {
  const apps = props.useApps(snapshot => snapshot)
  const topology = props.useTopology(snapshot => snapshot)

  if (apps.length === 0) {
    return <AppEmpty>{props.t('noApps')}</AppEmpty>
  }

  return (
    <AppList label={props.t('inspectorTitle')}>
      {apps.map(app => <AppCard key={app.id} app={app} topology={topology} openApp={props.openApp} t={props.t} />)}
    </AppList>
  )
}

interface AppCardProps {
  app: RegisteredApp
  topology: readonly LiveSlotNode[]
  openApp(id: string): void
  t: CatalogPaneProps['t']
}

function AppCard({ app, topology, openApp, t }: AppCardProps): ReactNode {
  const active = isAppActive(topology, app.id)
  const sourcePlugin = app.sourcePlugin ?? t('unknown')
  const categories = app.categories && app.categories.length > 0 ? app.categories.join(', ') : t('unknown')

  return (
    <AppRow
      data-app-id={app.id}
      title={app.label}
      titleAs="h2"
      trailing={(
        <Button variant="primary" size="sm" onClick={() => openApp(app.id)}>
          {t('openApp')}
        </Button>
      )}
    >
      <AppFields>
        <AppField field="app-id" label={t('appId')} value={app.id} />
        <AppField field="description" label={t('appDescription')} value={app.description ?? t('unknown')} />
        <AppField field="order" label={t('order')} value={app.order === undefined ? t('unknown') : String(app.order)} />
        <AppField field="source-plugin" label={t('sourcePlugin')} value={sourcePlugin} />
        <AppField field="url" label={t('url')} value={`/apps/${app.id}`} />
        <AppField field="categories" label={t('categories')} value={categories} />
        <AppField
          field="slot-status"
          label={t('slotStatus')}
          value={active ? t('available') : t('missing')}
          valueClassName={active ? styles.statusActive : styles.statusMissing}
        />
      </AppFields>
    </AppRow>
  )
}

function isAppActive(topology: readonly LiveSlotNode[], appId: string): boolean {
  const root = topology.find(node => node.name === 'webpage.app')
  return root?.occupants.some(occupant => occupant.key === appId && occupant.active) === true
}
