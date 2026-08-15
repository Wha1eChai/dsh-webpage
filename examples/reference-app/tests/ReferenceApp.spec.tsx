// @vitest-environment jsdom

import { Suspense } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ReferenceAppBody } from '../src/client/index.js'
import { ReferenceApp, type ReferenceAppProps } from '../src/client/ReferenceApp.js'

const translations: Record<string, string> = {
  title: 'Reference App',
  rootTitle: 'App home',
  rootDescription: 'You are at the reference App root route.',
  detailsTitle: 'Details',
  detailsDescription: 'This is the second local page in the reference App.',
  openDetails: 'Open details',
  backToRoot: 'Back to home',
  close: 'Close app',
  actions: 'Extension actions',
  notFoundTitle: 'Page not found',
  notFoundDescription: 'The reference App has no page at this local path.',
}

function props(
  appPath: string,
  renderSlot = vi.fn(() => null),
  navigate = vi.fn(),
  close = vi.fn(),
): ReferenceAppProps {
  return {
    appId: 'wha1echai.reference',
    appPath,
    search: '',
    hash: '',
    navigate,
    close,
    renderSlot: renderSlot as unknown as ReferenceAppProps['renderSlot'],
    t: key => translations[key] ?? key,
  }
}

describe('ReferenceApp', () => {
  afterEach(cleanup)

  it('renders the root route and navigates to details or closes the App', () => {
    const navigate = vi.fn()
    const close = vi.fn()

    render(<ReferenceApp {...props('/', vi.fn(() => null), navigate, close)} />)

    expect(screen.getByRole('article').getAttribute('data-route')).toBe('/')
    expect(screen.getByRole('heading', { name: 'App home' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Open details' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close app' }))

    expect(navigate).toHaveBeenCalledWith('/details')
    expect(close).toHaveBeenCalledOnce()
  })

  it('renders the details route and navigates back to the root', () => {
    const navigate = vi.fn()

    render(<ReferenceApp {...props('/details', vi.fn(() => null), navigate)} />)

    expect(screen.getByRole('article').getAttribute('data-route')).toBe('/details')
    expect(screen.getByRole('heading', { name: 'Details' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Back to home' }))

    expect(navigate).toHaveBeenCalledWith('/')
  })

  it('keeps an unknown local path inside the App as a not-found state', () => {
    render(<ReferenceApp {...props('/missing')} />)

    expect(screen.getByRole('article').getAttribute('data-route')).toBe('not-found')
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy()
    expect(screen.getByText('/missing')).toBeTruthy()
  })

  it('renders the child actions slot with the current App path owner', () => {
    const renderSlot = vi.fn(() => <button type="button">Extension action</button>)

    render(<ReferenceApp {...props('/details', renderSlot)} />)

    expect(screen.getByRole('button', { name: 'Extension action' })).toBeTruthy()
    expect(renderSlot).toHaveBeenCalledOnce()
    expect(renderSlot).toHaveBeenCalledWith('wha1echai.reference.actions', { appPath: '/details' })
  })

  it('lazy-loads the reference body through the client entry', async () => {
    render(
      <Suspense fallback={<div>loading</div>}>
        <ReferenceAppBody {...props('/')} />
      </Suspense>,
    )
    await waitFor(() => expect(screen.getByRole('heading', { name: 'App home' })).toBeTruthy())
  })
})
