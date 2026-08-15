import type { ReactNode } from 'react'
import type { HostObservable, InjectFace, LiveSlotNode, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'

import { AppEmpty, AppField } from '../../ui/index.js'
import type { InspectorPaneSlotProps } from '../slots.js'
import { InspectorField } from './fields.js'
import styles from './Inspector.module.css'

interface TopologyPaneInject {
  hooks: {
    topology: HostObservable<readonly LiveSlotNode[]>
  }
}

export type TopologyPaneProps = InspectorPaneSlotProps & PropsLocale<'webpage'> & InjectFace<TopologyPaneInject>

/** Default Inspector pane: declared slot topology under `webpage.app`. */
export function TopologyPane(props: TopologyPaneProps): ReactNode {
  const topology = props.useTopology(snapshot => snapshot)

  return (
    <section className={styles.topology}>
      <h2 className={styles.treeTitle}>{props.t('extensionTree')}</h2>
      {topology.length === 0 ? (
        <AppEmpty>{props.t('unknown')}</AppEmpty>
      ) : (
        <ul className={styles.tree}>
          {topology.map((node, index) => renderTopologyNode(node, props, `topology-${index}`))}
        </ul>
      )}
    </section>
  )
}

function renderTopologyNode(node: LiveSlotNode, props: TopologyPaneProps, path: string): ReactNode {
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
                <AppField field="registrant" label={props.t('sourcePlugin')} value={occupant.registrant} />
              ) : null}
              {occupant.key !== undefined ? (
                <AppField field="key" label={props.t('appId')} value={occupant.key} />
              ) : null}
              {occupant.id !== undefined ? (
                <AppField field="id" label={props.t('appId')} value={occupant.id} />
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
