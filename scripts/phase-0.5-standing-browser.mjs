import { chromium } from 'playwright'

const base = 'http://127.0.0.1:11350'
const usagePath = '/apps/dshapps.usage'

function fail(message) {
  throw new Error(message)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

const browser = await chromium.launch()
const context = await browser.newContext({
  locale: 'en-US',
  viewport: { width: 1680, height: 1000 },
})
const page = await context.newPage()
const notes = []

try {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  const continueButton = page.getByRole('button', { name: 'Continue', exact: true })
  try {
    await continueButton.waitFor({ state: 'visible', timeout: 5_000 })
    await continueButton.click()
    await continueButton.waitFor({ state: 'hidden', timeout: 5_000 })
    notes.push('dismissed testing notice')
  } catch {
    notes.push('no testing notice')
  }

  await page.getByRole('button', { name: 'Apps', exact: true }).waitFor({ state: 'visible', timeout: 30_000 })
  await page.getByRole('button', { name: 'Apps', exact: true }).click()
  await page.locator('[data-app-id="dshapps.usage"]').waitFor({ state: 'visible', timeout: 15_000 })
  const launcherIds = await page.locator('[data-app-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-app-id')))
  assert(launcherIds.includes('dshapps.usage'), `launcher missing Usage: ${JSON.stringify(launcherIds)}`)
  assert(launcherIds.includes('dshapps.inspector'), `launcher missing Inspector: ${JSON.stringify(launcherIds)}`)
  assert(!launcherIds.includes('dshapps.jobs'), `launcher still lists Jobs: ${JSON.stringify(launcherIds)}`)
  assert(!launcherIds.includes('dshapps.automations'), `launcher still lists Automations: ${JSON.stringify(launcherIds)}`)
  assert(!launcherIds.includes('dshapps.crash'), `launcher lists crash-app: ${JSON.stringify(launcherIds)}`)
  notes.push(`launcher ids: ${launcherIds.join(', ')}`)

  await page.goto(new URL(usagePath, base).href, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForFunction(path => window.location.pathname === path, usagePath, { timeout: 30_000 })
  const cells = page.locator('[data-day]')
  await cells.first().waitFor({ state: 'visible', timeout: 30_000 })
  const cellCount = await cells.count()
  assert(cellCount >= 28, `heatmap expected a month of cells, got ${cellCount}`)
  const missing = page.locator('[data-provider][data-status="missing"]')
  await missing.first().waitFor({ state: 'visible', timeout: 30_000 })
  const missingCount = await missing.count()
  assert(missingCount >= 1, 'expected at least one missing-key balance card')
  const conversation = await page.locator('[data-conversation-scroll]').count()
  assert(conversation === 1, 'conversation surface must stay mounted')
  notes.push(`deep-link Usage: ${cellCount} heatmap cells, ${missingCount} missing balance cards, conversation mounted`)

  await page.keyboard.press('Escape')
  await page.waitForFunction(path => window.location.pathname !== path, usagePath, { timeout: 15_000 })
  notes.push(`Escape left ${usagePath} for ${new URL(page.url()).pathname}`)

  console.log(JSON.stringify({ ok: true, notes }, null, 2))
} catch (error) {
  const body = await page.locator('body').innerText().catch(() => '(unavailable)')
  console.error(`URL: ${page.url()}\n${body.slice(0, 4_000)}`)
  throw error
} finally {
  await browser.close()
}
