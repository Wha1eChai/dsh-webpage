// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { zh } from '../../src/client/locales.js'
import {
  OpenAppCard,
  readOpenAppSuggestion,
  type OpenAppCardProps,
} from '../../src/client/open-app/OpenAppCard.js'
import type { RegisteredApp } from '../../src/client/contract.js'

const usage: RegisteredApp = {
  id: 'dshapps.usage',
  label: 'Usage',
}

function cardProps(overrides: Partial<OpenAppCardProps> = {}): OpenAppCardProps {
  return {
    callId: 'call-1',
    toolName: 'open_app',
    block: { argsRaw: JSON.stringify({ app_id: 'dshapps.usage' }) },
    resolveApp: (id: string) => id === usage.id ? usage : undefined,
    openApp: vi.fn(),
    t: key => zh[key],
    ...overrides,
  } as OpenAppCardProps
}

describe('readOpenAppSuggestion', () => {
  it('reads running and settled blocks', () => {
    expect(readOpenAppSuggestion({ argsRaw: '{"app_id":"dshapps.usage"}' })).toEqual({
      appId: 'dshapps.usage',
    })
    expect(readOpenAppSuggestion({
      kind: 'tool-result',
      call: { argsRaw: '{"app_id":"dshapps.usage","path":"/today"}' },
    })).toEqual({
      appId: 'dshapps.usage',
      path: '/today',
    })
  })

  it('returns undefined for unreadable blocks', () => {
    expect(readOpenAppSuggestion({ kind: 'tool-result', call: null })).toBeUndefined()
    expect(readOpenAppSuggestion({ argsRaw: '{not-json' })).toBeUndefined()
    expect(readOpenAppSuggestion({ argsRaw: 'null' })).toBeUndefined()
    expect(readOpenAppSuggestion({ argsRaw: '[]' })).toBeUndefined()
    expect(readOpenAppSuggestion({ argsRaw: '{"path":"/x"}' })).toBeUndefined()
    expect(readOpenAppSuggestion({ argsRaw: '{"app_id":1}' })).toBeUndefined()
    expect(readOpenAppSuggestion({ argsRaw: '{"app_id":"dshapps.usage","path":1}' })).toEqual({
      appId: 'dshapps.usage',
    })
  })
})

describe('OpenAppCard', () => {
  afterEach(() => cleanup())

  it('renders a registered app without a path', () => {
    render(<OpenAppCard {...cardProps()} />)
    expect(screen.getByText('Usage')).toBeTruthy()
    expect(screen.queryByText('未安装')).toBeNull()
    expect(screen.queryByText('路径')).toBeNull()
    expect(screen.getByRole('button', { name: '打开应用' })).toBeTruthy()
  })

  it('renders a registered app with a path', () => {
    render(<OpenAppCard {...cardProps({
      block: { argsRaw: JSON.stringify({ app_id: 'dshapps.usage', path: '/today' }) },
    })} />)
    expect(screen.getByText('Usage')).toBeTruthy()
    expect(screen.getByText('/today')).toBeTruthy()
    expect(screen.queryByText('未安装')).toBeNull()
  })

  it('renders an unregistered app without a path', () => {
    render(<OpenAppCard {...cardProps({
      block: { argsRaw: JSON.stringify({ app_id: 'acme.missing' }) },
    })} />)
    expect(screen.getByText('acme.missing')).toBeTruthy()
    expect(screen.getByText('未安装')).toBeTruthy()
    expect(screen.getByRole('button', { name: '打开应用' })).toBeTruthy()
  })

  it('renders an unregistered app with a path', () => {
    render(<OpenAppCard {...cardProps({
      block: {
        kind: 'tool-result',
        call: { argsRaw: JSON.stringify({ app_id: 'acme.missing', path: '/inbox' }) },
      },
    })} />)
    expect(screen.getByText('acme.missing')).toBeTruthy()
    expect(screen.getByText('/inbox')).toBeTruthy()
    expect(screen.getByText('未安装')).toBeTruthy()
  })

  it('opens only when the user clicks, including after a replay render', () => {
    const openApp = vi.fn()
    const props = cardProps({
      openApp,
      block: { argsRaw: JSON.stringify({ app_id: 'dshapps.usage', path: '/today' }) },
    })
    const { rerender } = render(<OpenAppCard {...props} />)
    rerender(<OpenAppCard {...props} />)
    expect(openApp).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '打开应用' }))
    expect(openApp).toHaveBeenCalledTimes(1)
    expect(openApp).toHaveBeenCalledWith('dshapps.usage', '/today')
  })

  it('hides the open button when the path fails the shared grammar', () => {
    const openApp = vi.fn()
    render(<OpenAppCard {...cardProps({
      openApp,
      block: { argsRaw: JSON.stringify({ app_id: 'dshapps.usage', path: '//odd' }) },
    })} />)
    expect(screen.getByText('Usage')).toBeTruthy()
    expect(screen.getByText('//odd')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '打开应用' })).toBeNull()
    expect(openApp).not.toHaveBeenCalled()
  })

  it('opens an uninstalled grammar-valid app on click', () => {
    const openApp = vi.fn()
    render(<OpenAppCard {...cardProps({
      openApp,
      block: { argsRaw: JSON.stringify({ app_id: 'acme.missing', path: '/inbox' }) },
    })} />)
    expect(screen.getByText('未安装')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '打开应用' }))
    expect(openApp).toHaveBeenCalledWith('acme.missing', '/inbox')
  })

  it('stays inert for unreadable or invalid ids', () => {
    const openApp = vi.fn()
    const { rerender } = render(<OpenAppCard {...cardProps({
      openApp,
      block: { argsRaw: '{broken' },
    })} />)
    expect(screen.getByText('未知')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '打开应用' })).toBeNull()

    rerender(<OpenAppCard {...cardProps({
      openApp,
      block: { argsRaw: JSON.stringify({ app_id: 'Usage' }) },
    })} />)
    expect(screen.getByText('Usage')).toBeTruthy()
    expect(screen.getByText('未安装')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '打开应用' })).toBeNull()
    expect(openApp).not.toHaveBeenCalled()
  })
})
