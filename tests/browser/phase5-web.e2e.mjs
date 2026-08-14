import {
  assertHttp200,
  createWebHarness,
  pageDiagnostics,
  readSnapshot,
  waitForUrl,
  waitForVisible,
} from './support.mjs'

const REFERENCE_ID = 'wha1echai.reference'
const REFERENCE_LABEL = 'Reference App'
const INSPECTOR_LABEL = 'Webpage'
const INSPECTOR_PATH = '/apps/wha1echai.webpage'
const REFERENCE_PATH = `/apps/${REFERENCE_ID}`
const REFERENCE_DETAILS_PATH = `${REFERENCE_PATH}/details`

function fail(message, cause) {
  const error = new Error(message)
  if (cause !== undefined) error.cause = cause
  throw error
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function sameUrl(baseUrl, pathname) {
  return new URL(pathname, baseUrl).href
}

async function clientRuntimeDiagnostics(page) {
  return page.evaluate(() => ({
    boot: window.__DSH_BOOT__,
    moduleLoaderKeys: Object.keys(window.__ModuleLoader__ ?? {}),
    pluginResources: performance.getEntriesByType('resource')
      .map(entry => entry.name)
      .filter(name => name.includes('/plugins/@wha1echai/')),
    pluginScripts: [...document.scripts]
      .map(script => script.src)
      .filter(src => src.includes('/plugins/@wha1echai/')),
  }))
}

async function waitForShell(page) {
  await waitForVisible(page, page.locator('[data-conversation-scroll]'), 'preserved conversation tree')
  await waitForVisible(page, page.getByRole('button', { name: 'Apps', exact: true }), 'English Apps launcher')
  const continueButton = page.getByRole('button', { name: 'Continue', exact: true })
  let noticeVisible = false
  try {
    await continueButton.waitFor({ state: 'visible', timeout: 5_000 })
    noticeVisible = true
  } catch (error) {
    if (error?.name !== 'TimeoutError') {
      fail(`DSH Internal Testing Notice visibility check failed\n${await pageDiagnostics(page)}`, error)
    }
  }
  if (noticeVisible) {
    try {
      await continueButton.click()
      await continueButton.waitFor({ state: 'hidden', timeout: 5_000 })
    } catch (error) {
      fail(`DSH Internal Testing Notice interaction failed\n${await pageDiagnostics(page)}`, error)
    }
  }
  const locale = await page.evaluate(() => ({
    language: navigator.language,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
  }))
  assert(locale.language === 'en-US', `browser locale must be en-US, got ${locale.language}`)
  assert(locale.viewport === '1680x1000', `browser viewport must be 1680x1000, got ${locale.viewport}`)
}

async function rememberConversation(page) {
  await page.evaluate(() => {
    const element = document.querySelector('[data-conversation-scroll]')
    if (element === null) throw new Error('data-conversation-scroll is absent')
    Object.defineProperty(window, '__phase5ConversationElement', {
      configurable: true,
      value: element,
    })
  })
}

async function assertConversationPreserved(page, label) {
  const result = await page.evaluate(() => {
    const current = document.querySelector('[data-conversation-scroll]')
    const remembered = window.__phase5ConversationElement
    return {
      connected: remembered?.isConnected === true,
      present: current !== null,
      same: remembered !== undefined && remembered === current,
    }
  })
  assert(result.connected, `${label}: preserved conversation element is no longer connected`)
  assert(result.present, `${label}: [data-conversation-scroll] is no longer present`)
  assert(result.same, `${label}: [data-conversation-scroll] was replaced instead of preserved`)
}

async function waitForInspector(page) {
  await waitForUrl(page, INSPECTOR_PATH, 'Apps launcher Inspector route')
  const heading = page.getByRole('heading', { name: 'App Inspector', exact: true })
  await waitForVisible(page, heading, 'App Inspector heading')
  const dialog = page.getByRole('dialog', { name: INSPECTOR_LABEL, exact: true })
  await waitForVisible(page, dialog, 'Webpage Inspector dialog')
  const card = page.locator(`[data-app-id="${REFERENCE_ID}"]`)
  await waitForVisible(page, card, 'Reference App Inspector card')
  return { dialog, card }
}

async function waitForReferencePage(page, pathname, heading) {
  await waitForUrl(page, pathname, `Reference App route ${pathname}`)
  const dialog = page.getByRole('dialog', { name: REFERENCE_LABEL, exact: true })
  await waitForVisible(page, dialog, `${REFERENCE_LABEL} dialog`)
  await waitForVisible(page, dialog.getByRole('heading', { name: heading, exact: true }), `Reference App heading ${heading}`)
  return dialog
}

async function inspectorSemanticSnapshot(page) {
  const dialog = page.getByRole('dialog', { name: INSPECTOR_LABEL, exact: true })
  return dialog.evaluate(element => {
    const card = element.querySelector('[data-app-id="wha1echai.reference"]')
    if (card === null) throw new Error('snapshot cannot find Reference App card')
    const field = name => card.querySelector(`[data-field="${name}"] dd`)?.textContent?.trim() ?? '<missing>'
    const topology = [...element.querySelectorAll('code')].map(node => node.textContent?.trim()).filter(Boolean)
    const viewport = `${window.innerWidth}x${window.innerHeight}`
    return [
      'phase5-web semantic snapshot',
      `viewport: ${viewport}`,
      `locale: ${navigator.language}`,
      `route: ${window.location.pathname}`,
      `dialog: ${element.querySelector('h1')?.textContent?.trim() ?? '<missing>'}`,
      `app: ${field('app-id')} | ${card.querySelector('h2')?.textContent?.trim() ?? '<missing>'} | status=${field('slot-status')} | source=${field('source-plugin')} | url=${field('url')} | categories=${field('categories')}`,
      `topology: ${topology[0] ?? '<missing>'}`,
      `topology-child: ${topology[1] ?? '<missing>'}`,
      'keys: none',
      '',
    ].join('\n')
  })
}

async function assertInspectorSemantics(page, dialog, card) {
  assert(await dialog.getByRole('heading', { name: 'App Inspector', exact: true }).count() === 1, 'Inspector must expose one App Inspector heading')
  assert(await card.getByRole('heading', { name: REFERENCE_LABEL, exact: true }).count() === 1, 'Inspector must show Reference App')
  const expectedFields = {
    'app-id': REFERENCE_ID,
    description: 'A small nested-route App used to verify DSH Webpage composition.',
    order: '10',
    'source-plugin': '@wha1echai/dsh-webpage-reference-app',
    url: REFERENCE_PATH,
    categories: 'reference',
    'slot-status': 'Available',
  }
  for (const [name, expected] of Object.entries(expectedFields)) {
    const value = card.locator(`[data-field="${name}"] dd`)
    await waitForVisible(page, value, `Inspector ${name} field`)
    const actual = (await value.innerText()).trim()
    assert(actual === expected, `Inspector ${name} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
  assert(await dialog.locator('code').filter({ hasText: /^webpage\.app$/u }).count() === 1, 'Inspector must show the live webpage.app topology root')
  assert(await dialog.locator('code').filter({ hasText: /^wha1echai\.reference\.actions$/u }).count() === 1, 'Inspector must show the reference child extension slot')
}

async function assertNoAppOutlet(page, label) {
  assert(await page.locator('[data-route]').count() === 0, `${label}: an App route element was mounted`)
  assert(await page.locator('[data-app-id]').count() === 0, `${label}: Inspector App content was mounted`)
  assert(await page.getByRole('dialog').count() === 0, `${label}: an App dialog was mounted`)
}

async function runScenarios() {
  const harness = await createWebHarness()
  const { page, baseUrl, profile } = harness
  const pageErrors = []
  const consoleErrors = []
  const failedRequests = []
  const pluginResponses = []
  page.on('pageerror', error => pageErrors.push(String(error)))
  page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning') consoleErrors.push(`${message.type()}: ${message.text()}`)
  })
  page.on('requestfailed', request => failedRequests.push(`${request.url()}: ${request.failure()?.errorText ?? 'unknown failure'}`))
  page.on('response', response => {
    if (response.url().includes('/plugins/@wha1echai/')) pluginResponses.push(`${response.status()} ${response.url()}`)
  })
  try {
    assert(profile.dsh.manifest.version === '0.1.0-rc.6', `browser lane launched non-rc.6 DSH: ${profile.dsh.manifest.version}`)
    await assertHttp200(baseUrl)
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
    await waitForShell(page)
    await rememberConversation(page)

    // Launcher -> Inspector proves the real packed client composition is live.
    await page.getByRole('button', { name: 'Apps', exact: true }).click()
    const inspector = await waitForInspector(page)
    await assertInspectorSemantics(page, inspector.dialog, inspector.card)
    const actualSnapshot = (await inspectorSemanticSnapshot(page)).trimEnd()
    const expectedSnapshot = (await readSnapshot()).replaceAll('\r\n', '\n').trimEnd()
    assert(actualSnapshot === expectedSnapshot, `fixed-viewport keyless snapshot mismatch\nExpected:\n${expectedSnapshot}\nActual:\n${actualSnapshot}`)
    await assertConversationPreserved(page, 'Inspector transition')

    // Open the packed reference App and exercise its nested local route.
    await inspector.card.getByRole('button', { name: 'Open App', exact: true }).click()
    let app = await waitForReferencePage(page, REFERENCE_PATH, 'App home')
    await waitForVisible(page, app.getByTestId('reference-action'), 'reference extension action')
    assert((await app.getByTestId('reference-action-app-path').innerText()).trim() === '/', 'reference extension must receive root appPath')
    await assertConversationPreserved(page, 'Reference App open')

    await app.getByRole('button', { name: 'Open details', exact: true }).click()
    app = await waitForReferencePage(page, REFERENCE_DETAILS_PATH, 'Details')
    assert((await app.getByTestId('reference-action-app-path').innerText()).trim() === '/details', 'reference extension must receive nested appPath')
    await assertConversationPreserved(page, 'nested route transition')

    // Native history must restore both nested states without a full navigation.
    await page.goBack()
    app = await waitForReferencePage(page, REFERENCE_PATH, 'App home')
    await page.goForward()
    app = await waitForReferencePage(page, REFERENCE_DETAILS_PATH, 'Details')
    await assertConversationPreserved(page, 'back-forward transition')

    // Closing the overlay leaves the same connected conversation element.
    await app.locator('button').filter({ hasText: /^Close app$/u }).click()
    await waitForUrl(page, '/', 'closing the Reference App')
    await waitForShell(page)
    await assertNoAppOutlet(page, 'close app')
    await assertConversationPreserved(page, 'close app transition')

    // A server-fallback deep link must render after a real browser reload.
    await page.goto(sameUrl(baseUrl, REFERENCE_DETAILS_PATH), { waitUntil: 'domcontentloaded' })
    await waitForShell(page)
    await waitForReferencePage(page, REFERENCE_DETAILS_PATH, 'Details')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForShell(page)
    await waitForReferencePage(page, REFERENCE_DETAILS_PATH, 'Details')
    await rememberConversation(page)

    // Unknown valid App IDs are preserved and rendered as unavailable.
    const unknownUrl = `${sameUrl(baseUrl, '/apps/missing.phase5/ghost')}?from=phase5#unknown`
    await page.evaluate(url => {
      history.pushState(null, '', url)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, unknownUrl)
    await waitForUrl(page, unknownUrl, 'unknown App route')
    assert(page.url() === unknownUrl, `unknown App URL was rewritten: expected ${unknownUrl}, got ${page.url()}`)
    const unknownDialog = page.getByRole('dialog', { name: 'missing.phase5', exact: true })
    await waitForVisible(page, unknownDialog, 'unknown App dialog')
    await waitForVisible(page, unknownDialog.getByRole('heading', { name: 'App unavailable', exact: true }), 'unknown App unavailable state')
    await waitForVisible(page, unknownDialog.getByText('This App is not installed, or its UI plugin is currently unavailable.', { exact: true }), 'unknown App diagnostic copy')
    await assertConversationPreserved(page, 'unknown App transition')

    // Root-path-only deployment is a negative case: the URL remains untouched
    // and dsh-webpage does not claim the upstream /dsh prefix.
    const unsupportedBasePath = sameUrl(baseUrl, '/dsh/apps/wha1echai.reference')
    await page.evaluate(url => {
      history.pushState(null, '', url)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, unsupportedBasePath)
    await waitForUrl(page, unsupportedBasePath, 'unsupported base-path route')
    assert(page.url() === unsupportedBasePath, `unsupported base-path URL was rewritten: expected ${unsupportedBasePath}, got ${page.url()}`)
    await assertNoAppOutlet(page, 'unsupported /dsh/apps base path')
    await assertConversationPreserved(page, 'unsupported base-path transition')

    assert(pageErrors.length === 0, `browser page errors observed:\n${pageErrors.join('\n')}`)
    console.log(`Phase 5 real Web browser acceptance passed at ${baseUrl}`)
    console.log(`Packed profile: ${profile.profileDir}`)
    console.log('Scenarios: startup/HTTP 200, launcher+Inspector, App/details, deep-link reload, back/forward, unknown App, conversation identity, negative base path, keyless snapshot')
  } catch (error) {
    const diagnostics = await pageDiagnostics(page)
    const runtime = await clientRuntimeDiagnostics(page).catch(runtimeError => ({ unavailable: String(runtimeError) }))
    fail(`${error instanceof Error ? error.message : String(error)}\n\n${diagnostics}\n\nClient runtime:\n${JSON.stringify(runtime, null, 2)}\n\nPlugin responses:\n${pluginResponses.join('\n') || '(none)'}\n\nFailed requests:\n${failedRequests.join('\n') || '(none)'}\n\nConsole warnings/errors:\n${consoleErrors.join('\n') || '(none)'}\n\nDSH output:\n${harness.dshOutput() || '(none)'}`, error instanceof Error ? error.cause : undefined)
  } finally {
    await harness.close()
  }
}

export { runScenarios }
