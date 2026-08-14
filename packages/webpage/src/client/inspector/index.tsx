import type { ReactNode } from 'react'
import type { HostObservable, InjectFace, LiveSlotNode, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { RegisteredApp } from '../contract.js'
import type { WebpageAppSlotProps } from '../slots.js'
import styles from './Inspector.module.css'

interface InspectorInject {
  hooks: {
    apps: HostObservable<readonly RegisteredApp[]>
    topology: HostObservable<readonly LiveSlotNode[]>
  }
  openApp(id: string): void
}

export type InspectorProps = WebpageAppSlotProps & PropsLocale<'webpage'> & InjectFace<InspectorInject>

/** Read-only App Inspector entry for the keyed `webpage.app` slot. */
export function Inspector(props: InspectorProps): ReactNode {
  const apps = props.useApps(snapshot => snapshot)
  const topology = props.useTopology(snapshot => snapshot)

  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <h1 className={styles.title}>{props.t('inspectorTitle')}</h1>
        <p className={styles.description}>{props.t('inspectorDescription')}</p>
      </header>

      {apps.length === 0 ? (
        <p className={styles.empty}>{props.t('noApps')}</p>
      ) : (
        <div className={styles.cards}>
          {apps.map(app => <AppCard key={app.id} app={app} topology={topology} openApp={props.openApp} t={props.t} />)}
        </div>
      )}

      <section className={styles.topology}>
        <h2 className={styles.treeTitle}>{props.t('extensionTree')}</h2>
        {topology.length === 0 ? (
          <p className={styles.empty}>{props.t('unknown')}</p>
        ) : (
          <ul className={styles.tree}>
            {topology.map((node, index) => renderTopologyNode(node, props, `topology-${index}`))}
          </ul>
        )}
      </section>
    </section>
  )
}

interface AppCardProps {
  app: RegisteredApp
  topology: readonly LiveSlotNode[]
  openApp(id: string): void
  t: InspectorProps['t']
}

function AppCard({ app, topology, openApp, t }: AppCardProps): ReactNode {
  const active = isAppActive(topology, app.id)
  const sourcePlugin = app.sourcePlugin ?? t('unknown')
  const categories = app.categories && app.categories.length > 0 ? app.categories.join(', ') : t('unknown')

  return (
    <article className={styles.card} data-app-id={app.id}>
      <h2 className={styles.cardTitle}>{app.label}</h2>
      <dl className={styles.fields}>
        <InspectorField field="app-id" label={t('appId')} value={app.id} />
        <InspectorField field="description" label={t('appDescription')} value={app.description ?? t('unknown')} />
        <InspectorField field="order" label={t('order')} value={app.order === undefined ? t('unknown') : String(app.order)} />
        <InspectorField field="source-plugin" label={t('sourcePlugin')} value={sourcePlugin} />
        <InspectorField field="url" label={t('url')} value={`/apps/${app.id}`} />
        <InspectorField field="categories" label={t('categories')} value={categories} />
        <InspectorField
          field="slot-status"
          label={t('slotStatus')}
          value={active ? t('available') : t('missing')}
          valueClassName={active ? styles.statusActive : styles.statusMissing}
        />
      </dl>
      <button className={styles.openButton} type="button" onClick={() => openApp(app.id)}>
        {t('openApp')}
      </button>
    </article>
  )
}

interface InspectorFieldProps {
  field: string
  label: string
  value: string
  valueClassName?: string
}

function InspectorField({ field, label, value, valueClassName }: InspectorFieldProps): ReactNode {
  return (
    <div className={styles.field} data-field={field}>
      <dt className={styles.fieldLabel}>{label}</dt>
      <dd className={`${styles.fieldValue} ${valueClassName ?? ''}`}>{value}</dd>
    </div>
  )
}

function isAppActive(topology: readonly LiveSlotNode[], appId: string): boolean {
  const root = topology.find(node => node.name === 'webpage.app')
  return root?.occupants.some(occupant => occupant.key === appId && occupant.active) === true
}

function renderTopologyNode(node: LiveSlotNode, props: InspectorProps, path: string): ReactNode {
  return (
    <li className={styles.node} key={path}>
      <div className={styles.nodeHeader}>
        <code>{node.name}</code>
        <span className={styles.nodeMeta}>{node.kind}/{node.scope}</span>
      </div>
      {node.declaredBy !== undefined ? (
        <dl className={styles.topologyFields}>
          <InspectorField field="declared-by" label={props.t('sourcePlugin')} value={node.declaredBy} />
        </dl>
      ) : null}
      {node.occupants.length > 0 ? (
        <ul className={styles.occupants}>
          {node.occupants.map((occupant, index) => (
            <li className={styles.occupant} key={`${path}-occupant-${index}`}>
              <div className={styles.occupantHeader}>
                <span className={styles.occupantMeta}>{props.t('slotStatus')}</span>
                <span className={occupant.active ? styles.statusActive : styles.statusMissing}>
                  {occupant.active ? props.t('available') : props.t('missing')}
                </span>
              </div>
              {occupant.registrant !== undefined ? (
                <InspectorField field="registrant" label={props.t('sourcePlugin')} value={occupant.registrant} />
              ) : null}
              {occupant.key !== undefined ? (
                <InspectorField field="key" label={props.t('appId')} value={occupant.key} />
              ) : null}
              {occupant.id !== undefined ? (
                <InspectorField field="id" label={props.t('appId')} value={occupant.id} />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {node.children.length > 0 ? (
        <ul className={styles.children}>
          {node.children.map((child, index) => renderTopologyNode(child, props, `${path}-child-${index}`))}
        </ul>
      ) : null}
    </li>
  )
}
