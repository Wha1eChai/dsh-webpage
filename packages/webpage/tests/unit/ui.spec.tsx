// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppActions, AppEmpty, AppField, AppFields, AppList, AppPage, AppRow } from '../../src/ui/index.js'
import styles from '../../src/ui/kit.module.css'

describe('webpage /ui kit', () => {
  afterEach(cleanup)

  it('renders a page with description and contributed actions', () => {
    render(
      <AppPage title="Jobs" description="Current session" actionsLabel="Extension actions" actions={<button type="button">Kind</button>}>
        <p>body</p>
      </AppPage>,
    )
    expect(screen.getByRole('heading', { name: 'Jobs' })).not.toBeNull()
    expect(screen.getByText('Current session')).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'Extension actions' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Kind' })).not.toBeNull()
  })

  it('omits description and empty actions', () => {
    render(<AppPage title="Empty">{null}</AppPage>)
    expect(screen.getByRole('heading', { name: 'Empty' })).not.toBeNull()
    expect(screen.queryByRole('heading', { name: 'Extension actions' })).toBeNull()
  })

  it('treats blank action children as absent', () => {
    const { rerender } = render(<AppActions label="Actions">{null}</AppActions>)
    expect(screen.queryByLabelText('Actions')).toBeNull()
    rerender(<AppActions label="Actions">{false}</AppActions>)
    expect(screen.queryByLabelText('Actions')).toBeNull()
    rerender(<AppActions label="Actions">{true}</AppActions>)
    expect(screen.queryByLabelText('Actions')).toBeNull()
    rerender(<AppActions label="Actions">{''}</AppActions>)
    expect(screen.queryByLabelText('Actions')).toBeNull()
    rerender(<AppActions label="Actions">{'   '}</AppActions>)
    expect(screen.queryByLabelText('Actions')).toBeNull()
    rerender(<AppActions>{[null, false]}</AppActions>)
    expect(document.querySelector('section')).toBeNull()
    rerender(<AppActions>hello</AppActions>)
    expect(screen.getByText('hello')).not.toBeNull()
    rerender(<AppActions>{0}</AppActions>)
    expect(screen.getByText('0')).not.toBeNull()
    rerender(<AppActions><button type="button">Go</button></AppActions>)
    expect(screen.getByRole('button', { name: 'Go' })).not.toBeNull()
    rerender(<AppActions label="Actions"><></></AppActions>)
    expect(screen.queryByLabelText('Actions')).toBeNull()
    rerender(<AppActions label="Actions"><div /></AppActions>)
    expect(screen.queryByLabelText('Actions')).toBeNull()
    rerender(<AppActions label="Actions"><div>{null}</div></AppActions>)
    expect(screen.queryByLabelText('Actions')).toBeNull()
    rerender(<AppActions label="Actions"><><div /></></AppActions>)
    expect(screen.queryByLabelText('Actions')).toBeNull()
    rerender(<AppActions label="Actions"><span>hello</span></AppActions>)
    expect(screen.getByLabelText('Actions')).not.toBeNull()
    function KindAction(): ReactElement {
      return <button type="button">Kind</button>
    }
    rerender(<AppActions label="Actions"><KindAction /></AppActions>)
    expect(screen.getByRole('button', { name: 'Kind' })).not.toBeNull()
  })

  it('renders list rows as articles or whole-row buttons', () => {
    const onClick = vi.fn()
    render(
      <>
        <AppList label="Apps">
          <AppRow title="Lead only" leading={<span>only-lead</span>} />
          <AppRow title="Static" description="Meta" titleAs="h2" data-app-id="acme.static">
            <AppFields>
              <AppField field="id" label="ID" value="acme.static" valueClassName="mark" />
            </AppFields>
          </AppRow>
          <AppRow
            className="extra"
            title="Open me"
            icon={<span>i</span>}
            leading={<span>L</span>}
            trailing={<span>T</span>}
            data-job-id="job-1"
            onClick={onClick}
          />
        </AppList>
        <AppList dense label="Compact list">
          <AppRow dense title="Compact" />
        </AppList>
      </>,
    )
    expect(screen.getByRole('list', { name: 'Apps' })).not.toBeNull()
    expect(document.querySelector(`.${styles.listDense}`)).not.toBeNull()
    expect(document.querySelector(`.${styles.rowDense}`)).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'Static' })).not.toBeNull()
    expect(document.querySelector('[data-app-id="acme.static"]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Open me/ }))
    expect(onClick).toHaveBeenCalledOnce()
    expect(document.querySelector('[data-job-id="job-1"]')).not.toBeNull()
  })

  it('renders an empty sentence', () => {
    render(<AppEmpty>Nothing here.</AppEmpty>)
    expect(screen.getByText('Nothing here.')).not.toBeNull()
  })
})
