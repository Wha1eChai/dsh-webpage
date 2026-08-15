// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { RegisteredApp } from '../../src/client/contract.js'
import { AppsLauncher, type AppsLauncherProps } from '../../src/client/launcher/AppsLauncher.js'

const apps: readonly RegisteredApp[] = [
  { id: 'wha1echai.webpage', label: 'Webpage', description: 'Inspector', categories: ['system'] },
  { id: 'acme.catalog', label: 'Catalog', description: 'Products', categories: ['commerce'] },
  { id: 'acme.bare', label: 'Bare' },
]

function createProps(
  wide: boolean,
  openApp: AppsLauncherProps['openApp'],
  list: readonly RegisteredApp[] = apps,
): AppsLauncherProps {
  return {
    wide,
    openApp,
    useApps: select => select(list),
    t: key => {
      if (key === 'apps') return '应用'
      if (key === 'filterApps') return '筛选应用'
      if (key === 'noApps') return '没有已注册的应用。'
      if (key === 'noMatchingApps') return '没有匹配的应用。'
      return key
    },
  } as AppsLauncherProps
}

describe('AppsLauncher', () => {
  afterEach(cleanup)

  it('shows the localized Apps label and opens the launch panel in wide mode', () => {
    const openApp = vi.fn()

    const { container } = render(<AppsLauncher {...createProps(true, openApp)} />)

    const button = screen.getByRole('button', { name: '应用' })
    const icon = container.querySelector('svg')
    expect(icon?.getAttribute('aria-hidden')).toBe('true')
    expect(icon?.getAttribute('width')).toBe('16')
    expect(icon?.getAttribute('height')).toBe('16')
    expect(button.textContent).toContain('应用')
    fireEvent.click(button)
    expect(screen.getByRole('dialog', { name: '应用' })).not.toBeNull()
    expect(openApp).not.toHaveBeenCalled()
  })

  it('keeps the rail action accessible with localized label and title', () => {
    const openApp = vi.fn()

    const { container } = render(<AppsLauncher {...createProps(false, openApp)} />)

    const button = screen.getByRole('button', { name: '应用' })
    const icon = container.querySelector('svg')
    expect(button.getAttribute('aria-label')).toBe('应用')
    expect(button.getAttribute('title')).toBe('应用')
    expect(button.textContent).toBe('')
    expect(icon?.getAttribute('aria-hidden')).toBe('true')
    expect(icon?.getAttribute('width')).toBe('18')
    expect(icon?.getAttribute('height')).toBe('18')
    fireEvent.click(button)
    expect(screen.getByRole('dialog', { name: '应用' })).not.toBeNull()
  })

  it('filters the list and opens the selected App', () => {
    const openApp = vi.fn()
    render(<AppsLauncher {...createProps(true, openApp)} />)

    fireEvent.click(screen.getByRole('button', { name: '应用' }))
    fireEvent.change(screen.getByRole('searchbox', { name: '筛选应用' }), { target: { value: 'catalog' } })
    expect(screen.queryByRole('button', { name: /Webpage/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Catalog/ }))
    expect(openApp).toHaveBeenCalledWith('acme.catalog')
    expect(screen.queryByRole('dialog', { name: '应用' })).toBeNull()
  })

  it('shows the empty copy when the filter matches nothing', () => {
    render(<AppsLauncher {...createProps(true, vi.fn())} />)
    fireEvent.click(screen.getByRole('button', { name: '应用' }))
    fireEvent.change(screen.getByRole('searchbox', { name: '筛选应用' }), { target: { value: 'missing' } })
    expect(screen.getByText('没有匹配的应用。')).not.toBeNull()
  })

  it('shows the registered-empty copy when no Apps exist', () => {
    render(<AppsLauncher {...createProps(true, vi.fn(), [])} />)
    fireEvent.click(screen.getByRole('button', { name: '应用' }))
    expect(screen.getByText('没有已注册的应用。')).not.toBeNull()
  })

  it('closes the panel on Escape, outside click, and a second trigger click', () => {
    render(<AppsLauncher {...createProps(true, vi.fn())} />)
    const trigger = screen.getByRole('button', { name: '应用' })
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: '应用' })).not.toBeNull()
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(screen.getByRole('dialog', { name: '应用' })).not.toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: '应用' })).toBeNull()

    fireEvent.click(trigger)
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('dialog', { name: '应用' })).toBeNull()

    fireEvent.click(trigger)
    fireEvent.click(trigger)
    expect(screen.queryByRole('dialog', { name: '应用' })).toBeNull()
  })

  it('matches description, category, and id filters and keeps an inside click open', () => {
    render(<AppsLauncher {...createProps(true, vi.fn())} />)
    fireEvent.click(screen.getByRole('button', { name: '应用' }))
    fireEvent.change(screen.getByRole('searchbox', { name: '筛选应用' }), { target: { value: 'commerce' } })
    expect(screen.getByRole('button', { name: /Catalog/ })).not.toBeNull()
    fireEvent.change(screen.getByRole('searchbox', { name: '筛选应用' }), { target: { value: 'inspector' } })
    expect(screen.getByRole('button', { name: /Webpage/ })).not.toBeNull()
    fireEvent.change(screen.getByRole('searchbox', { name: '筛选应用' }), { target: { value: 'wha1echai.webpage' } })
    expect(screen.getByRole('button', { name: /Webpage/ })).not.toBeNull()
    fireEvent.change(screen.getByRole('searchbox', { name: '筛选应用' }), { target: { value: 'acme.bare' } })
    expect(screen.getByRole('button', { name: /Bare/ })).not.toBeNull()
    fireEvent.mouseDown(screen.getByRole('dialog', { name: '应用' }))
    expect(screen.getByRole('dialog', { name: '应用' })).not.toBeNull()
  })

  it('anchors the panel above a footer trigger and below a top trigger', () => {
    const rect = (top: number) => ({
      x: 10,
      y: top,
      top,
      left: 10,
      bottom: top + 34,
      right: 100,
      width: 90,
      height: 34,
      toJSON() { return {} },
    })
    const proto = HTMLElement.prototype as HTMLElement & { getBoundingClientRect(): DOMRect }
    const original = proto.getBoundingClientRect
    proto.getBoundingClientRect = function getBoundingClientRect() {
      return this.getAttribute('aria-haspopup') === 'dialog' ? rect(600) as DOMRect : original.call(this)
    }
    const view = render(<AppsLauncher {...createProps(true, vi.fn())} />)
    fireEvent.click(screen.getByRole('button', { name: '应用' }))
    fireEvent.resize(window)
    fireEvent.scroll(window)
    expect((screen.getByRole('dialog', { name: '应用' }) as HTMLElement).style.bottom).not.toBe('')
    view.unmount()
    proto.getBoundingClientRect = function getBoundingClientRect() {
      return this.getAttribute('aria-haspopup') === 'dialog' ? rect(20) as DOMRect : original.call(this)
    }
    render(<AppsLauncher {...createProps(true, vi.fn())} />)
    fireEvent.click(screen.getByRole('button', { name: '应用' }))
    expect((screen.getByRole('dialog', { name: '应用' }) as HTMLElement).style.top).not.toBe('')
    proto.getBoundingClientRect = original
  })
})
