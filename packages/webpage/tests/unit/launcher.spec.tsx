// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppsLauncher, type AppsLauncherProps } from '../../src/client/launcher/AppsLauncher.js'

function createProps(wide: boolean, openApps: AppsLauncherProps['openApps']): AppsLauncherProps {
  return {
    wide,
    openApps,
    t: key => key === 'apps' ? '应用' : key,
  }
}

describe('AppsLauncher', () => {
  afterEach(cleanup)

  it('shows the localized Apps label and opens the catalog in wide mode', () => {
    const openApps = vi.fn()

    const { container } = render(<AppsLauncher {...createProps(true, openApps)} />)

    const button = screen.getByRole('button', { name: '应用' })
    const icon = container.querySelector('svg')
    expect(icon?.getAttribute('aria-hidden')).toBe('true')
    expect(icon?.getAttribute('width')).toBe('16')
    expect(icon?.getAttribute('height')).toBe('16')
    expect(button.textContent).toContain('应用')
    fireEvent.click(button)
    expect(openApps).toHaveBeenCalledOnce()
  })

  it('keeps the rail action accessible with localized label and title', () => {
    const openApps = vi.fn()

    const { container } = render(<AppsLauncher {...createProps(false, openApps)} />)

    const button = screen.getByRole('button', { name: '应用' })
    const icon = container.querySelector('svg')
    expect(button.getAttribute('aria-label')).toBe('应用')
    expect(button.getAttribute('title')).toBe('应用')
    expect(button.textContent).toBe('')
    expect(icon?.getAttribute('aria-hidden')).toBe('true')
    expect(icon?.getAttribute('width')).toBe('18')
    expect(icon?.getAttribute('height')).toBe('18')
    fireEvent.click(button)
    expect(openApps).toHaveBeenCalledOnce()
  })
})
