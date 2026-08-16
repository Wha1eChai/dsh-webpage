// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { LiveSlotNode, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RegisteredApp } from '../../src/client/contract.js'
import { CatalogPane, type CatalogPaneProps } from '../../src/client/inspector/CatalogPane.js'
import { Inspector, type InspectorProps } from '../../src/client/inspector/index.js'
import { TopologyPane, type TopologyPaneProps } from '../../src/client/inspector/TopologyPane.js'

const translations: Record<string, string> = {
  inspectorTitle: '应用检查器',
  inspectorDescription: '查看已注册应用及其扩展结构。',
  appId: '应用 ID',
  appDescription: '描述',
  order: '排序',
  sourcePlugin: '来源插件',
  url: '地址',
  slotStatus: '界面状态',
  available: '可用',
  missing: '缺失',
  unknown: '未知',
  categories: '分类',
  noApps: '没有已注册的应用。',
  extensionTree: '扩展结构',
  openApp: '打开应用',
}

function selector<T>(snapshot: T): SnapshotSelectorHook<T> {
  function useSelector<S>(select: (value: T) => S): S {
    return select(snapshot)
  }
  return useSelector
}

function inspectorProps(renderSlot = vi.fn(() => <p>panes</p>)): InspectorProps {
  return {
    appId: 'dshapps.inspector',
    appPath: '/',
    search: '',
    hash: '',
    navigate: vi.fn(),
    close: vi.fn(),
    renderSlot: renderSlot as unknown as InspectorProps['renderSlot'],
    t: key => translations[key] ?? key,
  }
}

function catalogProps(
  apps: readonly RegisteredApp[],
  topology: readonly LiveSlotNode[] = [],
  openApp = vi.fn(),
): CatalogPaneProps {
  return {
    appPath: '/',
    useApps: selector(apps),
    useTopology: selector(topology),
    openApp,
    t: key => translations[key] ?? key,
  } as CatalogPaneProps
}

function topologyProps(topology: readonly LiveSlotNode[] = []): TopologyPaneProps {
  return {
    appPath: '/',
    useTopology: selector(topology),
    t: key => translations[key] ?? key,
  } as TopologyPaneProps
}

describe('Inspector shell', () => {
  afterEach(() => cleanup())

  it('renders chrome and the Inspector pane slot with the App-local owner', () => {
    const renderSlot = vi.fn(() => <p>panes</p>)
    render(<Inspector {...inspectorProps(renderSlot)} />)

    expect(screen.getByText('应用检查器')).toBeTruthy()
    expect(screen.getByText('查看已注册应用及其扩展结构。')).toBeTruthy()
    expect(screen.getByText('panes')).toBeTruthy()
    expect(renderSlot).toHaveBeenCalledWith('webpage.inspector.pane', { appPath: '/' })
  })
})

describe('CatalogPane', () => {
  afterEach(() => cleanup())

  it('renders the localized empty state without app cards', () => {
    render(<CatalogPane {...catalogProps([])} />)

    expect(screen.getByText('没有已注册的应用。')).toBeTruthy()
    expect(screen.queryByRole('article')).toBeNull()
  })

  it('shows known and unknown sources, canonical URLs, categories, and active or missing keyed status', () => {
    const apps: RegisteredApp[] = [
      { id: 'acme.ready', label: 'Ready App', description: 'Ready description', order: 7, categories: ['catalog'], sourcePlugin: 'catalogPlugin' },
      { id: 'acme.missing', label: 'Missing App' },
    ]
    const topology: LiveSlotNode[] = [{
      name: 'webpage.app',
      kind: 'keyed',
      scope: 'root',
      occupants: [
        { key: 'acme.ready', priority: 0, active: true },
        { key: 'acme.missing', priority: 0, active: false },
      ],
      children: [],
    }]

    render(<CatalogPane {...catalogProps(apps, topology)} />)

    expect(screen.getByText('catalogPlugin')).toBeTruthy()
    expect(screen.getByText('/apps/acme.ready')).toBeTruthy()
    expect(screen.getByText('Ready description')).toBeTruthy()
    expect(screen.getByText('7')).toBeTruthy()
    expect(screen.getByText('catalog')).toBeTruthy()
    expect(screen.getAllByText('未知').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('可用')).toHaveLength(1)
    expect(screen.getAllByText('缺失')).toHaveLength(1)
  })

  it('calls openApp with the selected App ID', () => {
    const openApp = vi.fn()
    render(<CatalogPane {...catalogProps([{ id: 'acme.ready', label: 'Ready App', categories: [] }], [], openApp)} />)

    fireEvent.click(screen.getByRole('button', { name: '打开应用' }))

    expect(openApp).toHaveBeenCalledWith('acme.ready')
  })
})

describe('TopologyPane', () => {
  afterEach(() => cleanup())

  it('renders the unknown empty topology copy', () => {
    render(<TopologyPane {...topologyProps([])} />)
    expect(screen.getByText('扩展结构')).toBeTruthy()
    expect(screen.getByText('未知')).toBeTruthy()
  })

  it('renders declaredBy and occupant details through semantic nested lists', () => {
    const topology: LiveSlotNode[] = [{
      name: 'webpage.app',
      kind: 'keyed',
      scope: 'root',
      declaredBy: 'layoutPlugin',
      occupants: [{ registrant: 'appPlugin', key: 'acme.ready', priority: 0, active: true }],
      children: [{
        name: 'webpage.extension',
        kind: 'list',
        scope: 'root',
        declaredBy: 'appPlugin',
        occupants: [{ registrant: 'toolbarPlugin', id: 'toolbar', priority: 0, active: false }],
        children: [{
          name: 'webpage.extension.action',
          kind: 'single',
          scope: 'root',
          occupants: [],
          children: [],
        }],
      }],
    }]

    render(<TopologyPane {...topologyProps(topology)} />)

    expect(screen.getAllByRole('list').length).toBeGreaterThanOrEqual(3)
    expect(screen.getByText('layoutPlugin')).toBeTruthy()
    expect(screen.getByText('toolbarPlugin')).toBeTruthy()
    expect(screen.getByText('acme.ready')).toBeTruthy()
    expect(screen.getByText('toolbar')).toBeTruthy()
    expect(screen.getByText('webpage.extension.action')).toBeTruthy()
  })

  it('omits optional occupant fields when the snapshot has no provenance', () => {
    const topology: LiveSlotNode[] = [{
      name: 'webpage.app',
      kind: 'keyed',
      scope: 'root',
      occupants: [{ priority: 0, active: false }],
      children: [],
    }]

    render(<TopologyPane {...topologyProps(topology)} />)

    expect(screen.getByText('缺失')).toBeTruthy()
    expect(screen.queryByText('layoutPlugin')).toBeNull()
  })
})
