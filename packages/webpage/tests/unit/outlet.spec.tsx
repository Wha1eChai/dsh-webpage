// @vitest-environment jsdom

import { lazy, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AppOwnerProps, AppRoute, RegisteredApp } from '../../src/client/contract.js'
import { zh } from '../../src/client/locales.js'
import { AppOutlet, type AppOutletProps } from '../../src/client/outlet/AppOutlet.js'
import type { WebpageOutletSlotProps } from '../../src/client/slots.js'

function source<T>(value: T) {
  return {
    getSnapshot: () => value,
    subscribe: () => () => {},
  }
}

function createProps(
  route: AppRoute | undefined,
  apps: readonly RegisteredApp[],
  renderSlot: ReturnType<typeof vi.fn>,
  navigate: AppOwnerProps['navigate'] = vi.fn(),
  close: AppOwnerProps['close'] = vi.fn(),
): AppOutletProps {
  const routeSource = source(route)
  const appsSource = source(apps)
  return {
    useRoute: bindSnapshotSelector(routeSource) as SnapshotSelectorHook<AppRoute | undefined>,
    useApps: bindSnapshotSelector(appsSource) as SnapshotSelectorHook<readonly RegisteredApp[]>,
    renderSlot: renderSlot as unknown as WebpageOutletSlotProps['renderSlot'],
    t: key => zh[key],
    navigate,
    close,
  }
}

describe('AppOutlet', () => {
  afterEach(cleanup)

  it('renders nothing when the route is inactive', () => {
    const renderSlot = vi.fn()

    const { container } = render(<AppOutlet {...createProps(undefined, [], renderSlot)} />)

    expect(container.firstChild).toBeNull()
    expect(renderSlot).not.toHaveBeenCalled()
  })

  it('dispatches a known App with immutable route ownership and callbacks', () => {
    const navigate = vi.fn()
    const close = vi.fn()
    const renderSlot = vi.fn(() => <div>Rendered App</div>)
    const route = {
      appId: 'acme.catalog',
      appPath: '/reports/',
      search: '?tab=all',
      hash: '#top',
    }

    render(<AppOutlet {...createProps(route, [{ id: route.appId, label: 'Catalog' }], renderSlot, navigate, close)} />)

    const dialog = screen.getByRole('dialog', { name: 'Catalog' })
    expect(dialog.getAttribute('data-surface')).toBe('overlay')
    expect(screen.getByText('Catalog')).not.toBeNull()
    expect(screen.getByText('Rendered App')).not.toBeNull()
    expect(renderSlot).toHaveBeenCalledOnce()

    const [key, owner, options] = renderSlot.mock.calls[0] as [string, AppOwnerProps, { entryKey?: string; fallback?: ReactNode }]
    expect(key).toBe('webpage.app')
    expect(options.entryKey).toBe(route.appId)
    expect(owner).toEqual({ ...route, navigate, close })
    expect(Object.isFrozen(owner)).toBe(true)
    expect(owner.navigate).toBe(navigate)
    expect(owner.close).toBe(close)
  })

  it('keeps an unknown route in place and does not dispatch a keyed App', () => {
    const renderSlot = vi.fn()

    render(
      <AppOutlet
        {...createProps(
          { appId: 'missing.catalog', appPath: '/', search: '', hash: '' },
          [{ id: 'known.catalog', label: 'Known' }],
          renderSlot,
        )}
      />,
    )

    expect(screen.getByRole('dialog', { name: 'missing.catalog' })).not.toBeNull()
    expect(screen.getByText(zh.unavailableTitle)).not.toBeNull()
    expect(renderSlot).not.toHaveBeenCalled()
  })

  it('uses the unavailable fallback when known metadata has no keyed occupant', () => {
    const renderSlot = vi.fn(() => null)
    const route = { appId: 'acme.catalog', appPath: '/', search: '?view=all', hash: '#top' }

    render(<AppOutlet {...createProps(route, [{ id: route.appId, label: 'Catalog' }], renderSlot)} />)

    expect(screen.getByText(zh.unavailableTitle)).not.toBeNull()
    const [, , options] = renderSlot.mock.calls[0] as [string, AppOwnerProps, { fallback?: ReactNode }]
    expect(options.fallback).toBeDefined()
  })

  it('closes the active App through the injected callback', () => {
    const close = vi.fn()
    const renderSlot = vi.fn(() => <div>Rendered App</div>)

    render(
      <AppOutlet
        {...createProps({ appId: 'acme.catalog', appPath: '/', search: '', hash: '' }, [{ id: 'acme.catalog', label: 'Catalog' }], renderSlot, vi.fn(), close)}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: zh.close }))
    expect(close).toHaveBeenCalledOnce()
  })

  it('closes an overlay App with Escape', () => {
    const close = vi.fn()
    const renderSlot = vi.fn(() => <div>Rendered App</div>)

    render(
      <AppOutlet
        {...createProps({ appId: 'acme.catalog', appPath: '/', search: '', hash: '' }, [{ id: 'acme.catalog', label: 'Catalog' }], renderSlot, vi.fn(), close)}
      />,
    )

    fireEvent.keyDown(document, { key: 'Enter' })
    expect(close).not.toHaveBeenCalled()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(close).toHaveBeenCalledOnce()
  })

  it('honors an explicit overlay surface', () => {
    const renderSlot = vi.fn(() => <div>Overlay App</div>)
    render(
      <AppOutlet
        {...createProps(
          { appId: 'acme.catalog', appPath: '/', search: '', hash: '' },
          [{ id: 'acme.catalog', label: 'Catalog', surface: 'overlay' }],
          renderSlot,
        )}
      />,
    )
    expect(screen.getByRole('dialog', { name: 'Catalog' }).getAttribute('data-surface')).toBe('overlay')
  })

  it('renders a panel surface that keeps a dismissible mask', () => {
    const close = vi.fn()
    const renderSlot = vi.fn(() => <div>Panel App</div>)

    render(
      <AppOutlet
        {...createProps(
          { appId: 'acme.catalog', appPath: '/', search: '', hash: '' },
          [{ id: 'acme.catalog', label: 'Catalog', surface: 'panel' }],
          renderSlot,
          vi.fn(),
          close,
        )}
      />,
    )

    expect(screen.getByRole('dialog', { name: 'Catalog' }).getAttribute('data-surface')).toBe('panel')
    fireEvent.click(document.querySelector('[aria-hidden="true"]')!)
    expect(close).toHaveBeenCalledOnce()
  })

  it('renders a modal surface through the DSH dialog', () => {
    const close = vi.fn()
    const renderSlot = vi.fn(() => <div>Modal App</div>)

    render(
      <AppOutlet
        {...createProps(
          { appId: 'acme.catalog', appPath: '/', search: '', hash: '' },
          [{ id: 'acme.catalog', label: 'Catalog', surface: 'modal' }],
          renderSlot,
          vi.fn(),
          close,
        )}
      />,
    )

    expect(screen.getByRole('dialog', { name: 'Catalog' })).not.toBeNull()
    expect(document.querySelector('[data-surface="modal"]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: zh.close }))
    expect(close).toHaveBeenCalledOnce()
  })

  it('keeps chrome up when a known App body throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    function Boom(): ReactNode {
      throw new Error('boom')
    }
    const renderSlot = vi.fn(() => <Boom />)

    render(
      <AppOutlet
        {...createProps(
          { appId: 'acme.catalog', appPath: '/', search: '', hash: '' },
          [{ id: 'acme.catalog', label: 'Catalog', sourcePlugin: '@acme/catalog' }],
          renderSlot,
        )}
      />,
    )

    expect(screen.getByRole('dialog', { name: 'Catalog' })).not.toBeNull()
    expect(screen.getByRole('button', { name: zh.close })).not.toBeNull()
    expect(screen.getByText(zh.crashedTitle)).not.toBeNull()
    expect(screen.getByText(zh.crashedDescription)).not.toBeNull()
    expect(document.querySelector('[data-app-state="crashed"]')).not.toBeNull()
    expect(spy.mock.calls.some(args => String(args[0]).includes('[dsh-webpage] App crashed:'))).toBe(true)
    spy.mockRestore()
  })

  it('logs unknown provenance when a crashing App has no sourcePlugin', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    function Boom(): ReactNode {
      throw new Error('boom')
    }
    const renderSlot = vi.fn(() => <Boom />)

    render(
      <AppOutlet
        {...createProps(
          { appId: 'acme.catalog', appPath: '/', search: '', hash: '' },
          [{ id: 'acme.catalog', label: 'Catalog' }],
          renderSlot,
        )}
      />,
    )

    expect(screen.getByText(zh.crashedTitle)).not.toBeNull()
    expect(spy.mock.calls.some(args => args[0] === '[dsh-webpage] App crashed:' && args[2] === 'unknown')).toBe(true)
    spy.mockRestore()
  })

  it('remounts a recovered App body when Retry is pressed', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    let shouldThrow = true
    function Flaky(): ReactNode {
      if (shouldThrow) throw new Error('boom')
      return <div>Recovered App</div>
    }
    const renderSlot = vi.fn(() => <Flaky />)

    render(
      <AppOutlet
        {...createProps(
          { appId: 'acme.catalog', appPath: '/', search: '', hash: '' },
          [{ id: 'acme.catalog', label: 'Catalog', sourcePlugin: '@acme/catalog' }],
          renderSlot,
        )}
      />,
    )

    expect(screen.getByText(zh.crashedTitle)).not.toBeNull()
    shouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: zh.retry }))
    expect(screen.getByText('Recovered App')).not.toBeNull()
    expect(screen.queryByText(zh.crashedTitle)).toBeNull()
    spy.mockRestore()
  })

  it('resets a crashed body when the route switches to another App', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    function Boom(): ReactNode {
      throw new Error('boom')
    }
    const crashing = vi.fn(() => <Boom />)
    const healthy = vi.fn(() => <div>Other App</div>)
    const routeA = { appId: 'acme.catalog', appPath: '/', search: '', hash: '' }
    const routeB = { appId: 'acme.other', appPath: '/', search: '', hash: '' }
    const apps: readonly RegisteredApp[] = [
      { id: 'acme.catalog', label: 'Catalog', sourcePlugin: '@acme/catalog' },
      { id: 'acme.other', label: 'Other' },
    ]

    const { rerender } = render(<AppOutlet {...createProps(routeA, apps, crashing)} />)
    expect(screen.getByText(zh.crashedTitle)).not.toBeNull()

    rerender(<AppOutlet {...createProps(routeB, apps, healthy)} />)
    expect(screen.getByText('Other App')).not.toBeNull()
    expect(screen.queryByText(zh.crashedTitle)).toBeNull()
    spy.mockRestore()
  })

  it('keeps a healthy body when switching Apps', () => {
    const first = vi.fn(() => <div>First App</div>)
    const second = vi.fn(() => <div>Second App</div>)
    const apps: readonly RegisteredApp[] = [
      { id: 'acme.catalog', label: 'Catalog' },
      { id: 'acme.other', label: 'Other' },
    ]

    const { rerender } = render(
      <AppOutlet {...createProps({ appId: 'acme.catalog', appPath: '/', search: '', hash: '' }, apps, first)} />,
    )
    rerender(
      <AppOutlet {...createProps({ appId: 'acme.other', appPath: '/', search: '', hash: '' }, apps, second)} />,
    )

    expect(screen.getByText('Second App')).not.toBeNull()
    expect(screen.queryByText(zh.crashedTitle)).toBeNull()
  })

  it('does not reset when the same App re-renders without an error', () => {
    const renderSlot = vi.fn(() => <div>Stable App</div>)
    const route = { appId: 'acme.catalog', appPath: '/', search: '', hash: '' }
    const apps: readonly RegisteredApp[] = [{ id: 'acme.catalog', label: 'Catalog' }]

    const { rerender } = render(<AppOutlet {...createProps(route, apps, renderSlot)} />)
    rerender(<AppOutlet {...createProps({ ...route, appPath: '/nested' }, apps, renderSlot)} />)

    expect(screen.getByText('Stable App')).not.toBeNull()
    expect(screen.queryByText(zh.crashedTitle)).toBeNull()
  })

  it('owns the crash face when the slot renderer leaves data-slot-error', async () => {
    const renderSlot = vi.fn(() => <div data-slot-error="webpage.app" />)

    render(
      <AppOutlet
        {...createProps(
          { appId: 'acme.catalog', appPath: '/', search: '', hash: '' },
          [{ id: 'acme.catalog', label: 'Catalog' }],
          renderSlot,
        )}
      />,
    )

    await waitFor(() => expect(screen.getByText(zh.crashedTitle)).not.toBeNull())
    expect(screen.getByRole('button', { name: zh.retry })).not.toBeNull()
    expect(screen.getByRole('button', { name: zh.close })).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: zh.retry }))
    await waitFor(() => expect(screen.getByText(zh.crashedTitle)).not.toBeNull())
  })

  it('shows a loading state while a lazy App body resolves', async () => {
    const LazyBody = lazy(() => Promise.resolve({ default: () => <div>Lazy App</div> }))
    const renderSlot = vi.fn(() => <LazyBody />)

    render(
      <AppOutlet
        {...createProps(
          { appId: 'acme.catalog', appPath: '/', search: '', hash: '' },
          [{ id: 'acme.catalog', label: 'Catalog' }],
          renderSlot,
        )}
      />,
    )

    expect(screen.getByRole('dialog', { name: 'Catalog' })).not.toBeNull()
    expect(screen.getByText(zh.loading)).not.toBeNull()
    await waitFor(() => expect(screen.getByText('Lazy App')).not.toBeNull())
    expect(screen.queryByText(zh.loading)).toBeNull()
  })
})
