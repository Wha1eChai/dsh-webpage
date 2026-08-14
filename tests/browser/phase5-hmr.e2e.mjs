import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFile, lstat, mkdir, readFile, readdir, realpath, rename, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { createWebHarness, pageDiagnostics, waitForVisible } from './support.mjs'

const PROJECT_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const REFERENCE_APP_ROOT = join(PROJECT_ROOT, 'examples', 'reference-app')
const APP_ID = '@wha1echai/dsh-webpage-reference-app'
const DETAILS_PATH = '/apps/wha1echai.reference/details'
const ORIGINAL_MARKER = 'This is the second local page in the reference App.'
const REPLACEMENT_MARKER = 'Phase 5 client HMR replacement is live.'
const CRASH_ERROR_MESSAGE = 'Phase 5 deterministic Reference App render crash.'
const CRASH_DIAGNOSTIC = `slot entry crashed in 'webpage.app': Error: ${CRASH_ERROR_MESSAGE}`
const TOOLCHAIN_VERSIONS = Object.freeze({ typescript: '6.0.3', tsdown: '0.22.2' })

function fail(message, cause) {
  const error = new Error(message)
  if (cause !== undefined) error.cause = cause
  throw error
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function normalized(path) {
  return process.platform === 'win32' ? path.toLowerCase() : path
}

function isWithin(parent, candidate) {
  const child = normalized(relative(resolve(parent), resolve(candidate)))
  return child === '' || (!child.startsWith(`..${sep}`) && child !== '..' && !isAbsolute(child))
}

function countOccurrences(text, marker) {
  return text.split(marker).length - 1
}

function hashContent(content) {
  return createHash('sha1').update(content).digest('hex').slice(0, 12)
}

function assertProfilePath(profile, candidate, label) {
  assert(isWithin(profile.tempRoot, candidate), `${label} escaped the disposable profile: ${candidate}`)
  return candidate
}

async function assertProfileRealPath(profile, candidate, label) {
  const canonical = await realpath(candidate)
  assertProfilePath(profile, canonical, label)
  return canonical
}

async function dismissTestingNotice(page) {
  const button = page.getByRole('button', { name: 'Continue', exact: true })
  try {
    await button.waitFor({ state: 'visible', timeout: 5_000 })
  } catch (error) {
    if (error?.name === 'TimeoutError') return
    throw error
  }
  await button.click()
  await button.waitFor({ state: 'hidden', timeout: 5_000 })
}

async function installDocumentSentinels(page) {
  await page.evaluate(() => {
    const conversation = document.querySelector('[data-conversation-scroll]')
    if (conversation === null) throw new Error('[data-conversation-scroll] is absent')
    Object.defineProperties(window, {
      __phase5HmrDocument: { configurable: true, value: document },
      __phase5HmrConversation: { configurable: true, value: conversation },
    })
  })
}

async function assertDocumentSentinels(page, label = 'HMR') {
  const state = await page.evaluate(() => {
    const current = document.querySelector('[data-conversation-scroll]')
    return {
      documentSame: window.__phase5HmrDocument === document,
      conversationConnected: window.__phase5HmrConversation?.isConnected === true,
      conversationSame: window.__phase5HmrConversation === current,
    }
  })
  assert(state.documentSame, `${label} replaced the browser document`)
  assert(state.conversationConnected, `${label} disconnected the preserved conversation element`)
  assert(state.conversationSame, `${label} replaced the preserved conversation element`)
}

async function copyDirectory(source, destination, profile) {
  const entries = await readdir(source, { withFileTypes: true })
  for (const entry of entries) {
    const sourcePath = join(source, entry.name)
    const destinationPath = assertProfilePath(profile, join(destination, entry.name), 'copied fixture target')
    if (entry.isDirectory()) {
      await mkdir(destinationPath, { recursive: true })
      await copyDirectory(sourcePath, destinationPath, profile)
    } else if (entry.isFile()) {
      await mkdir(dirname(destinationPath), { recursive: true })
      await copyFile(sourcePath, destinationPath)
    } else {
      fail(`reference App source contains an unsupported fixture entry: ${sourcePath}`)
    }
  }
}

async function copyFixtureFile(relativePath, fixture, profile) {
  const source = join(REFERENCE_APP_ROOT, relativePath)
  const destination = assertProfilePath(profile, join(fixture, relativePath), 'copied fixture target')
  await mkdir(dirname(destination), { recursive: true })
  await copyFile(source, destination)
}

function typePath(packageRoot, suffix) {
  return join(packageRoot, 'lib', 'types', suffix)
}

async function configureCopiedTypeScript(fixture) {
  const tsconfigPath = join(fixture, 'tsconfig.json')
  const tsconfig = JSON.parse(await readFile(tsconfigPath, 'utf8'))
  tsconfig.extends = './tsconfig.base.json'
  tsconfig.compilerOptions = {
    ...tsconfig.compilerOptions,
    baseUrl: fixture,
    ignoreDeprecations: '6.0',
    paths: {
      '@wha1echai/dsh-webpage/client': [typePath(join(PROJECT_ROOT, 'packages', 'webpage'), 'client/index.d.ts')],
      '@deepseek-ai/dsh-client-locale/client': [typePath(join(REFERENCE_APP_ROOT, 'node_modules', '@deepseek-ai', 'dsh-client-locale'), 'client/index.d.ts')],
      '@deepseek-ai/dsh-client-runtime/client': [typePath(join(REFERENCE_APP_ROOT, 'node_modules', '@deepseek-ai', 'dsh-client-runtime'), 'client/index.d.ts')],
      '@deepseek-ai/dsh-client-ui-slots': [typePath(join(REFERENCE_APP_ROOT, 'node_modules', '@deepseek-ai', 'dsh-client-ui-slots'), 'index.d.ts')],
    },
  }
  await writeFile(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`, 'utf8')
}

async function createHmrFixture(profile, kind) {
  const fixture = assertProfilePath(
    profile,
    join(profile.tempRoot, `phase5-hmr-${kind}-${Date.now()}-${Math.random().toString(16).slice(2)}`),
    'temporary HMR fixture',
  )
  const fixtureNodeModules = assertProfilePath(profile, join(fixture, 'node_modules'), 'temporary node_modules junction')
  await mkdir(fixture, { recursive: false })
  try {
    for (const file of ['package.json', 'tsconfig.json', 'tsdown.config.ts']) {
      await copyFixtureFile(file, fixture, profile)
    }
    await copyDirectory(join(REFERENCE_APP_ROOT, 'src'), assertProfilePath(profile, join(fixture, 'src'), 'copied fixture source'), profile)
    await copyFile(
      join(PROJECT_ROOT, 'tsdown.client.ts'),
      assertProfilePath(profile, join(fixture, 'tsdown.client.ts'), 'copied fixture root config'),
    )
    await copyFile(
      join(PROJECT_ROOT, 'tsconfig.base.json'),
      assertProfilePath(profile, join(fixture, 'tsconfig.base.json'), 'copied fixture root config'),
    )

    const copiedTsdownConfig = join(fixture, 'tsdown.config.ts')
    const tsdownConfig = await readFile(copiedTsdownConfig, 'utf8')
    assert(countOccurrences(tsdownConfig, "'../../tsdown.client.ts'") === 1, 'copied tsdown config did not retain its expected root-config import')
    await writeFile(copiedTsdownConfig, tsdownConfig.replace("'../../tsdown.client.ts'", "'./tsdown.client.ts'"), 'utf8')
    await configureCopiedTypeScript(fixture)

    const repositoryNodeModules = await realpath(join(PROJECT_ROOT, 'node_modules'))
    assert(!isWithin(profile.tempRoot, repositoryNodeModules), 'repository node_modules unexpectedly resides inside the disposable profile')
    await symlink(repositoryNodeModules, fixtureNodeModules, process.platform === 'win32' ? 'junction' : 'dir')
    const linkStats = await lstat(fixtureNodeModules)
    assert(linkStats.isSymbolicLink(), `temporary node_modules path is not a directory link: ${fixtureNodeModules}`)
    const linkedNodeModules = await realpath(fixtureNodeModules)
    assert(normalized(linkedNodeModules) === normalized(repositoryNodeModules), 'temporary node_modules link does not resolve to repository node_modules')

    const markerSource = join(fixture, 'src', 'client', 'locales.ts')
    const crashSource = join(fixture, 'src', 'client', 'ReferenceApp.tsx')
    if (kind === 'replacement') {
      const source = await readFile(markerSource, 'utf8')
      assert(countOccurrences(source, ORIGINAL_MARKER) === 1, 'fresh copied Reference App source does not contain exactly one original marker')
      const replaced = source.replace(ORIGINAL_MARKER, REPLACEMENT_MARKER)
      assert(countOccurrences(replaced, REPLACEMENT_MARKER) === 1 && countOccurrences(replaced, ORIGINAL_MARKER) === 0, 'replacement marker transformation failed in copied source')
      await writeFile(markerSource, replaced, 'utf8')
    } else {
      const source = await readFile(crashSource, 'utf8')
      const anchor = 'export function ReferenceApp({ appPath, close, navigate, renderSlot, t }: ReferenceAppProps): ReactNode {\n'
      assert(countOccurrences(source, anchor) === 1, 'fresh copied ReferenceApp source lacks the deterministic crash injection point')
      const injected = `${anchor}  if (appPath === '/details') throw new Error(${JSON.stringify(CRASH_ERROR_MESSAGE)})\n`
      const crashed = source.replace(anchor, injected)
      assert(countOccurrences(crashed, CRASH_ERROR_MESSAGE) === 1, 'deterministic App crash was not injected exactly once')
      await writeFile(crashSource, crashed, 'utf8')
    }

    return { fixture, fixtureNodeModules }
  } catch (error) {
    await removeHmrFixture(profile, fixture, fixtureNodeModules)
    throw error
  }
}

async function runTool(command, args, cwd, label) {
  return new Promise((resolvePromise, reject) => {
    const output = []
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, NODE_ENV: 'production' },
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    child.stdout?.on('data', chunk => output.push(chunk.toString()))
    child.stderr?.on('data', chunk => output.push(chunk.toString()))
    child.once('error', error => reject(new Error(`${label} failed to start`, { cause: error })))
    child.once('close', code => {
      const text = output.join('').trim()
      if (code !== 0) {
        reject(new Error(`${label} exited with ${String(code)}${text ? `:\n${text}` : ''}`))
        return
      }
      resolvePromise(text)
    })
  })
}

async function runCopiedBuild(fixture) {
  const typescriptPackage = JSON.parse(await readFile(join(PROJECT_ROOT, 'node_modules', 'typescript', 'package.json'), 'utf8'))
  const tsdownPackage = JSON.parse(await readFile(join(PROJECT_ROOT, 'node_modules', 'tsdown', 'package.json'), 'utf8'))
  assert(typescriptPackage.version === TOOLCHAIN_VERSIONS.typescript, `unexpected repository TypeScript toolchain: ${typescriptPackage.version}`)
  assert(tsdownPackage.version === TOOLCHAIN_VERSIONS.tsdown, `unexpected repository tsdown toolchain: ${tsdownPackage.version}`)

  const typescriptCli = join(PROJECT_ROOT, 'node_modules', 'typescript', 'bin', 'tsc')
  const tsdownCli = join(PROJECT_ROOT, 'node_modules', 'tsdown', 'dist', 'run.mjs')
  await runTool(process.execPath, [typescriptCli, '-b', 'tsconfig.json', '--pretty', 'false'], fixture, 'copied Reference App TypeScript build')
  await runTool(process.execPath, [tsdownCli, '--env.DSH_BUILD_FACE', 'client'], fixture, 'copied Reference App tsdown client build')
}

async function removeHmrFixture(profile, fixture, fixtureNodeModules) {
  if (fixtureNodeModules !== undefined) {
    assertProfilePath(profile, fixtureNodeModules, 'temporary node_modules cleanup target')
    try {
      const stats = await lstat(fixtureNodeModules)
      assert(stats.isSymbolicLink(), `refusing to recursively clean a non-link node_modules path: ${fixtureNodeModules}`)
      await unlink(fixtureNodeModules)
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }
  if (fixture !== undefined) {
    assertProfilePath(profile, fixture, 'temporary HMR fixture cleanup target')
    await rm(fixture, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
}

async function buildAndInstallCandidate(profile, kind) {
  let fixture
  let fixtureNodeModules
  let staged
  try {
    ({ fixture, fixtureNodeModules } = await createHmrFixture(profile, kind))
    await runCopiedBuild(fixture)

    const builtBundle = assertProfilePath(profile, join(fixture, 'lib', 'client.js'), 'rebuilt HMR bundle')
    const rebuilt = await readFile(builtBundle, 'utf8')
    assert(rebuilt.length > 0, `rebuilt HMR bundle is empty: ${builtBundle}`)
    if (kind === 'replacement') {
      assert(countOccurrences(rebuilt, REPLACEMENT_MARKER) === 1, 'rebuilt bundle must contain the replacement marker exactly once')
      assert(countOccurrences(rebuilt, ORIGINAL_MARKER) === 0, 'rebuilt bundle still contains the original marker')
    } else {
      assert(countOccurrences(rebuilt, CRASH_ERROR_MESSAGE) === 1, 'crash bundle must contain the deterministic crash message exactly once')
      assert(countOccurrences(rebuilt, ORIGINAL_MARKER) === 1, 'fresh crash bundle must retain the original source marker exactly once')
    }

    const target = assertProfilePath(profile, join(profile.packageRoots.app, 'lib', 'client.js'), 'installed Reference App target')
    await assertProfileRealPath(profile, dirname(target), 'installed Reference App target directory')
    const original = await readFile(target, 'utf8')
    const originalRev = hashContent(original)
    const candidateRev = hashContent(rebuilt)
    assert(candidateRev !== originalRev, `${kind} HMR candidate content hash did not change`)

    staged = assertProfilePath(profile, `${target}.phase5-${kind}-next`, 'staged HMR bundle')
    await copyFile(builtBundle, staged)
    await assertProfileRealPath(profile, dirname(staged), 'staged HMR bundle directory')
    await rename(staged, target)
    staged = undefined
    return { target, originalRev, candidateRev, rebuilt }
  } finally {
    if (staged !== undefined) {
      assertProfilePath(profile, staged, 'failed HMR stage cleanup target')
      await rm(staged, { force: true })
    }
    await removeHmrFixture(profile, fixture, fixtureNodeModules)
  }
}

function beginPhase(phases, name) {
  const state = {
    consoleErrors: [],
    consoleWarnings: [],
    failedRequests: [],
    hmrResponses: [],
    documentRequests: [],
    loadEvents: 0,
    mainFrameNavigations: 0,
  }
  phases.current = name
  phases[name] = state
  return state
}

function endPhase(phases) {
  phases.current = undefined
}

function assertPhaseHasNoUnexpectedDiagnostics(state, label) {
  assert(state.pageErrors?.length === 0, `${label} page errors:\n${state.pageErrors?.join('\n') ?? ''}`)
  assert(state.consoleErrors.length === 0, `${label} console errors:\n${state.consoleErrors.join('\n')}`)
  assert(state.consoleWarnings.length === 0, `${label} console warnings:\n${state.consoleWarnings.join('\n')}`)
  assert(state.failedRequests.length === 0, `${label} request failures:\n${state.failedRequests.join('\n')}`)
}

export async function runHmrScenario() {
  const harness = await createWebHarness()
  const { page, baseUrl, profile } = harness
  const phases = { current: undefined, success: undefined, crash: undefined }

  page.on('pageerror', error => {
    const phase = phases[phases.current]
    if (phase !== undefined) {
      phase.pageErrors ??= []
      phase.pageErrors.push(String(error))
    }
  })
  page.on('console', message => {
    const phase = phases[phases.current]
    if (phase === undefined) return
    if (message.type() === 'error') phase.consoleErrors.push(message.text())
    if (message.type() === 'warning') phase.consoleWarnings.push(message.text())
  })
  page.on('requestfailed', request => {
    const phase = phases[phases.current]
    if (phase !== undefined) phase.failedRequests.push(`${request.url()}: ${request.failure()?.errorText ?? 'unknown failure'}`)
  })
  page.on('request', request => {
    const phase = phases[phases.current]
    if (phase !== undefined && request.resourceType() === 'document') phase.documentRequests.push(request.url())
  })
  page.on('response', response => {
    const phase = phases[phases.current]
    if (phase !== undefined && response.url().includes(`/plugins/${APP_ID}/client.js`)) phase.hmrResponses.push(response.url())
  })
  page.on('load', () => {
    const phase = phases[phases.current]
    if (phase !== undefined) phase.loadEvents += 1
  })
  page.on('framenavigated', frame => {
    if (frame !== page.mainFrame()) return
    const phase = phases[phases.current]
    if (phase !== undefined) phase.mainFrameNavigations += 1
  })

  let installedBundle
  let crashBundle
  try {
    const detailsUrl = new URL(DETAILS_PATH, baseUrl).href
    await page.goto(detailsUrl, { waitUntil: 'domcontentloaded' })
    await waitForVisible(page, page.locator('[data-conversation-scroll]'), 'conversation tree before HMR')
    await dismissTestingNotice(page)
    const dialog = page.getByRole('dialog', { name: 'Reference App', exact: true })
    await waitForVisible(page, dialog.getByRole('heading', { name: 'Details', exact: true }), 'Reference App details before HMR')
    await waitForVisible(page, dialog.getByText(ORIGINAL_MARKER, { exact: true }), 'original Reference App marker')
    assert(await dialog.getByTestId('reference-action').count() === 1, 'reference extension must be mounted exactly once before HMR')

    const bootEntry = await page.evaluate(id => window.__DSH_BOOT__?.entries.find(entry => entry.id === id), APP_ID)
    assert(bootEntry?.rev, `boot graph is missing ${APP_ID}`)
    const originalUrl = page.url()
    await installDocumentSentinels(page)

    const successful = beginPhase(phases, 'success')
    successful.pageErrors = []
    installedBundle = await buildAndInstallCandidate(profile, 'replacement')
    assert(installedBundle.originalRev === bootEntry.rev, `installed bundle hash ${installedBundle.originalRev} differs from boot rev ${bootEntry.rev}`)
    assert(installedBundle.candidateRev !== installedBundle.originalRev, 'HMR candidate content hash did not change')
    await waitForVisible(page, dialog.getByText(REPLACEMENT_MARKER, { exact: true }), 'replacement marker after client HMR', 30_000)

    assert(page.url() === originalUrl, `HMR changed the App URL: expected ${originalUrl}, got ${page.url()}`)
    assert(await dialog.getByText(ORIGINAL_MARKER, { exact: true }).count() === 0, 'old Reference App marker survived HMR')
    assert(await dialog.getByText(REPLACEMENT_MARKER, { exact: true }).count() === 1, 'replacement marker is duplicated after HMR')
    assert(await dialog.getByTestId('reference-action').count() === 1, 'reference extension registration is stale or duplicated after HMR')
    assert((await dialog.getByTestId('reference-action-app-path').innerText()).trim() === '/details', 'extension owner appPath changed across HMR')
    await assertDocumentSentinels(page)

    const changedResponse = successful.hmrResponses.at(-1)
    assert(changedResponse !== undefined, `HMR did not refetch ${APP_ID}; responses: ${JSON.stringify(successful.hmrResponses)}`)
    assert(successful.documentRequests.length === 0, `HMR issued document requests: ${successful.documentRequests.join(', ')}`)
    assert(successful.loadEvents === 0, `HMR emitted ${successful.loadEvents} page load event(s)`)
    assert(successful.mainFrameNavigations === 0, `HMR emitted ${successful.mainFrameNavigations} main-frame navigation event(s)`)
    assertPhaseHasNoUnexpectedDiagnostics(successful, 'successful HMR')

    endPhase(phases)
    await dialog.locator('button').filter({ hasText: /^Close app$/u }).click()
    await page.getByRole('button', { name: 'Apps', exact: true }).click()
    const inspector = page.getByRole('dialog', { name: 'Webpage', exact: true })
    await waitForVisible(page, inspector.getByRole('heading', { name: 'App Inspector', exact: true }), 'Inspector after HMR')
    assert(await inspector.locator('[data-app-id="wha1echai.reference"]').count() === 1, 'Reference App metadata is stale or duplicated after HMR')
    assert(await inspector.locator('code').filter({ hasText: /^wha1echai\.reference\.actions$/u }).count() === 1, 'Reference App child slot topology is stale or duplicated after HMR')

    const postHmrCard = inspector.locator('[data-app-id="wha1echai.reference"]')
    await postHmrCard.getByRole('button', { name: 'Open App', exact: true }).click()
    const reopenedApp = page.getByRole('dialog', { name: 'Reference App', exact: true })
    await waitForVisible(page, reopenedApp.getByRole('heading', { name: 'App home', exact: true }), 'Reference App reopened before crash HMR')
    await reopenedApp.getByRole('button', { name: 'Open details', exact: true }).click()
    const crashDetailsHeading = page.getByRole('dialog', { name: 'Reference App', exact: true }).getByRole('heading', { name: 'Details', exact: true })
    await waitForVisible(page, crashDetailsHeading, 'Reference App details before crash HMR')
    await assertDocumentSentinels(page, 'pre-crash HMR')
    const crashOriginalUrl = page.url()
    const crashPhase = beginPhase(phases, 'crash')
    crashPhase.pageErrors = []
    crashBundle = await buildAndInstallCandidate(profile, 'crash')
    assert(crashBundle.originalRev === installedBundle.candidateRev, `crash HMR started from unexpected installed bundle hash ${crashBundle.originalRev}`)
    await crashDetailsHeading.waitFor({ state: 'hidden', timeout: 30_000 })

    assert(page.url() === crashOriginalUrl, `App crash HMR changed the URL: expected ${crashOriginalUrl}, got ${page.url()}`)
    await assertDocumentSentinels(page, 'App crash HMR')
    assert(crashPhase.hmrResponses.at(-1) !== undefined, `crash HMR did not refetch ${APP_ID}; responses: ${JSON.stringify(crashPhase.hmrResponses)}`)
    assert(crashPhase.documentRequests.length === 0, `App crash HMR issued document requests: ${crashPhase.documentRequests.join(', ')}`)
    assert(crashPhase.loadEvents === 0, `App crash HMR emitted ${crashPhase.loadEvents} page load event(s)`)
    assert(crashPhase.mainFrameNavigations === 0, `App crash HMR emitted ${crashPhase.mainFrameNavigations} main-frame navigation event(s)`)
    assert(crashPhase.pageErrors.length === 0, `App crash HMR page errors:\n${crashPhase.pageErrors.join('\n')}`)
    assert(crashPhase.failedRequests.length === 0, `App crash HMR request failures:\n${crashPhase.failedRequests.join('\n')}`)
    assert(crashPhase.consoleWarnings.length === 0, `App crash HMR unexpected console warnings:\n${crashPhase.consoleWarnings.join('\n')}`)
    assert(crashPhase.consoleErrors.length === 2, `App crash HMR expected exactly the React and DSH boundary diagnostics, got ${JSON.stringify(crashPhase.consoleErrors)}`)
    assert(crashPhase.consoleErrors[0].startsWith(`Error: ${CRASH_ERROR_MESSAGE}\n`) && crashPhase.consoleErrors[0].includes('at ReferenceApp'), `App crash HMR React diagnostic did not match the injected render failure: ${JSON.stringify(crashPhase.consoleErrors[0])}`)
    assert(crashPhase.consoleErrors[1].startsWith(`${CRASH_DIAGNOSTIC}\n`) && crashPhase.consoleErrors[1].includes('at ReferenceApp'), `App crash HMR DSH boundary diagnostic did not match: ${JSON.stringify(crashPhase.consoleErrors[1])}`)

    endPhase(phases)
    await page.evaluate(() => {
      history.pushState(null, '', '/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await page.waitForFunction(() => window.location.pathname === '/')
    await page.getByRole('dialog', { name: 'Reference App', exact: true }).waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: 'Apps', exact: true }).click()
    const crashInspector = page.getByRole('dialog', { name: 'Webpage', exact: true })
    await waitForVisible(page, crashInspector.getByRole('heading', { name: 'App Inspector', exact: true }), 'Inspector after App crash')
    assert(await crashInspector.locator('[data-app-id="wha1echai.reference"]').count() === 1, 'Reference App metadata was lost or duplicated after App crash')

    console.log(`Phase 5 real client HMR acceptance passed for ${installedBundle.target}`)
    console.log(`Changed content hash: ${installedBundle.originalRev} -> ${installedBundle.candidateRev}`)
    console.log(`Crash candidate hash: ${crashBundle.originalRev} -> ${crashBundle.candidateRev}`)
    console.log(`No-cache bundle refetch: ${changedResponse}`)
    console.log('Verified URL/document/conversation identity, no reload, one App/extension registration, isolated SlotErrorBoundary crash diagnostics, and no unexpected page/request errors.')
  } catch (error) {
    const diagnostics = await pageDiagnostics(page)
    const phaseDiagnostics = Object.fromEntries(Object.entries(phases).filter(([name]) => name !== 'current' && phases[name] !== undefined).map(([name, state]) => [name, state]))
    fail(`${error instanceof Error ? error.message : String(error)}\n\n${diagnostics}\n\nHMR diagnostics:\n${JSON.stringify(phaseDiagnostics, null, 2)}\n\nDSH output:\n${harness.dshOutput() || '(none)'}`, error instanceof Error ? error.cause : undefined)
  } finally {
    phases.current = undefined
    await harness.close()
  }
}
