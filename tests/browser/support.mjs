import { spawn, spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createPackedWebProfile } from '../phase5/packed-profile.mjs'

/**
 * Contract consumed from tests/phase5/packed-profile.mjs:
 *
 *   createPackedWebProfile(): Promise<{
 *     tempRoot: string,
 *     home: string,
 *     profileDir: string,
 *     dsh: { manifest: { version: string }, packageRoot: string, bin: string },
 *     dshInvocation: {
 *       executable: string,
 *       script: string,
 *       cwd: string,
 *       profile: string,
 *       env: Record<string, string>,
 *     },
 *     dispose(): Promise<void>,
 *   }>
 *
 * The helper owns packing, real `dsh plugin add`, dump-config verification, and
 * the disposable temp root. This lane only owns the external Web process and
 * browser lifecycle after the profile has been created.
 */

const READY_PATTERN = /dsh web: (http:\/\/[^\s]+)/u
const READY_TIMEOUT_MS = 120_000
const STOP_TIMEOUT_MS = 15_000
const SNAPSHOT_PATH = fileURLToPath(new URL('./__snapshots__/phase5-web.snapshot.txt', import.meta.url))

function fail(message, cause) {
  const error = new Error(message)
  if (cause !== undefined) error.cause = cause
  throw error
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function assertString(value, label) {
  assert(typeof value === 'string' && value.length > 0, `${label} must be a non-empty string`)
  return value
}

function validatePackedProfile(profile) {
  assert(profile !== null && typeof profile === 'object', 'createPackedWebProfile() did not return an object')
  assertString(profile.tempRoot, 'packed profile tempRoot')
  assertString(profile.home, 'packed profile home')
  assertString(profile.profileDir, 'packed profile profileDir')
  assert(typeof profile.dispose === 'function', 'packed profile dispose() is missing')
  assert(profile.dsh !== null && typeof profile.dsh === 'object', 'packed profile dsh evidence is missing')
  assert(profile.dsh.manifest?.version === '0.1.0-rc.6', `expected external DSH 0.1.0-rc.6, got ${profile.dsh.manifest?.version ?? '(missing)'}`)
  const invocation = profile.dshInvocation
  assert(invocation !== null && typeof invocation === 'object', 'packed profile dshInvocation is missing')
  assertString(invocation.executable, 'dshInvocation.executable')
  assertString(invocation.script, 'dshInvocation.script')
  assertString(invocation.cwd, 'dshInvocation.cwd')
  assert(invocation.profile === 'web', `packed profile must target web, got ${String(invocation.profile)}`)
  assert(invocation.env !== null && typeof invocation.env === 'object', 'dshInvocation.env is missing')
  assert(typeof invocation.env.DSH_HOME === 'string' && invocation.env.DSH_HOME === profile.home, 'dshInvocation.env.DSH_HOME must point at packed profile home')
  return profile
}

function appendOutput(output, chunk) {
  output.value += chunk.toString()
}

function waitForReady(child, output) {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (callback, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.stdout?.off('data', onData)
      child.stderr?.off('data', onData)
      child.off('error', onError)
      child.off('exit', onExit)
      callback(value)
    }
    const onData = chunk => {
      const match = READY_PATTERN.exec(output.value)
      if (match?.[1] !== undefined) finish(resolve, { url: match[1], output: output.value })
    }
    const onError = error => finish(reject, new Error(`dsh Web process failed before ready:\n${output.value}`, { cause: error }))
    const onExit = (code, signal) => finish(reject, new Error(`dsh Web process exited before ready (code ${String(code)}, signal ${String(signal)}):\n${output.value}`))
    const timer = setTimeout(() => finish(reject, new Error(`dsh Web was not ready within ${READY_TIMEOUT_MS}ms:\n${output.value}`)), READY_TIMEOUT_MS)
    timer.unref?.()
    child.stdout?.on('data', onData)
    child.stderr?.on('data', onData)
    child.on('error', onError)
    child.on('exit', onExit)
  })
}

function waitForClose(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve()
  return new Promise(resolve => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      clearTimeout(timer)
      child.off('close', finish)
      resolve()
    }
    const timer = setTimeout(finish, timeoutMs)
    timer.unref?.()
    child.once('close', finish)
  })
}

async function stopProcess(child) {
  if (child === undefined || child.exitCode !== null || child.signalCode !== null) return
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM')
  await waitForClose(child, STOP_TIMEOUT_MS)
  if (child.exitCode === null && child.signalCode === null && child.pid !== undefined) {
    if (process.platform === 'win32') {
      spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      })
    } else {
      child.kill('SIGKILL')
    }
    await waitForClose(child, STOP_TIMEOUT_MS)
  }
  assert(child.exitCode !== null || child.signalCode !== null, `dsh Web process ${String(child.pid)} did not stop`)
}

async function loadPlaywright() {
  try {
    return await import('playwright')
  } catch (error) {
    fail('The browser lane requires this project\'s Playwright dependency; install dependencies with `pnpm install --frozen-lockfile`.', error)
  }
}

function launchDshWeb(profile) {
  const invocation = profile.dshInvocation
  const env = {
    ...invocation.env,
    // The browser scenarios never submit a prompt. This value prevents an
    // onboarding/key lookup from changing the shell boot path if rc.6 checks it.
    DEEPSEEK_API_KEY: 'phase5-browser-no-model-calls',
    DSH_AGENTS_HOME: `${profile.tempRoot}/agents`,
  }
  const child = spawn(invocation.executable, [invocation.script, 'web', '--port', '0'], {
    cwd: invocation.cwd,
    env,
    shell: false,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const output = { value: '' }
  child.stdout?.on('data', chunk => appendOutput(output, chunk))
  child.stderr?.on('data', chunk => appendOutput(output, chunk))
  return { child, output, ready: waitForReady(child, output) }
}

export async function createWebHarness() {
  let profile
  let child
  let browser
  let context
  let page
  try {
    profile = validatePackedProfile(await createPackedWebProfile())
    const launched = launchDshWeb(profile)
    child = launched.child
    const ready = await launched.ready
    const playwright = await loadPlaywright()
    browser = await playwright.chromium.launch()
    context = await browser.newContext({
      locale: 'en-US',
      viewport: { width: 1680, height: 1000 },
    })
    page = await context.newPage()
    return Object.freeze({
      profile,
      child,
      baseUrl: ready.url,
      browser,
      context,
      page,
      dshOutput: () => launched.output.value,
      async close() {
        const failures = []
        await browser.close().catch(error => failures.push(error))
        await stopProcess(child).catch(error => failures.push(error))
        await profile.dispose().catch(error => failures.push(error))
        if (failures.length > 0) throw new AggregateError(failures, 'Phase 5 browser harness cleanup failed')
      },
    })
  } catch (error) {
    const failures = []
    if (browser !== undefined) await browser.close().catch(cleanupError => failures.push(cleanupError))
    if (child !== undefined) await stopProcess(child).catch(cleanupError => failures.push(cleanupError))
    if (profile !== undefined) await profile.dispose().catch(cleanupError => failures.push(cleanupError))
    if (failures.length > 0) {
      throw new AggregateError([error, ...failures], 'Phase 5 browser harness setup and cleanup failed')
    }
    throw error
  }
}

export async function pageDiagnostics(page) {
  let body = '(body unavailable)'
  try {
    body = (await page.locator('body').innerText({ timeout: 2_000 })).slice(0, 8_000)
  } catch {
    // Preserve the original assertion as the primary failure when the page is gone.
  }
  return `URL: ${page.url()}\nBody text:\n${body}`
}

export async function waitForVisible(page, locator, label, timeout = 30_000) {
  try {
    await locator.waitFor({ state: 'visible', timeout })
  } catch (error) {
    fail(`${label} was not visible within ${timeout}ms\n${await pageDiagnostics(page)}`, error)
  }
  return locator
}

export async function waitForUrl(page, expected, label) {
  const expectedUrl = new URL(expected, page.url()).href
  try {
    await page.waitForFunction(url => window.location.href === url, expectedUrl, { timeout: 30_000 })
  } catch (error) {
    fail(`${label} did not reach ${expectedUrl}\n${await pageDiagnostics(page)}`, error)
  }
}

export async function assertHttp200(url) {
  let response
  try {
    response = await fetch(url)
  } catch (error) {
    fail(`real DSH Web URL could not be fetched: ${url}`, error)
  }
  const body = await response.text()
  assert(response.status === 200, `real DSH Web startup expected HTTP 200 at ${url}, got ${response.status}: ${body.slice(0, 2_000)}`)
  assert(body.length > 0, `real DSH Web startup returned an empty HTTP 200 body at ${url}`)
  return body
}

export async function readSnapshot() {
  try {
    return await readFile(SNAPSHOT_PATH, 'utf8')
  } catch (error) {
    fail(`deterministic Phase 5 snapshot is missing at ${SNAPSHOT_PATH}`, error)
  }
}

export { READY_PATTERN, SNAPSHOT_PATH }
