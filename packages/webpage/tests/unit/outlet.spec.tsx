// @vitest-environment jsdom

import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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

    expect(screen.getByRole('dialog', { name: 'Catalog' })).not.toBeNull()
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
})
