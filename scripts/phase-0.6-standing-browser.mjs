import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'

const base = 'http://127.0.0.1:11350'
const usagePath = '/apps/dshapps.usage'
const shots = mkdtempSync(join(tmpdir(), 'phase-0.6-browser-'))

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

async function dismissNotice() {
  const continueButton = page.getByRole('button', { name: 'Continue', exact: true })
  try {
    await continueButton.waitFor({ state: 'visible', timeout: 5_000 })
    await continueButton.click()
    await continueButton.waitFor({ state: 'hidden', timeout: 5_000 })
  } catch {
    // No notice this boot.
  }
}

async function approveIfAsked() {
  for (const name of ['Approve', 'Allow', 'Yes', '批准', '允许']) {
    const button = page.getByRole('button', { name, exact: true })
    if (await button.count() > 0 && await button.first().isVisible().catch(() => false)) {
      await button.first().click()
      notes.push(`clicked approval: ${name}`)
      return
    }
  }
}

try {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await dismissNotice()

  await page.getByRole('button', { name: 'Apps', exact: true }).waitFor({ state: 'visible', timeout: 30_000 })
  await page.getByRole('button', { name: 'Apps', exact: true }).click()
  await page.locator('[data-app-id="dshapps.usage"]').waitFor({ state: 'visible', timeout: 15_000 })
  const ids = await page.locator('[data-app-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-app-id')))
  assert(ids.includes('dshapps.inspector') && ids.includes('dshapps.usage'), `launcher regression: ${JSON.stringify(ids)}`)
  assert(!ids.includes('dshapps.jobs') && !ids.includes('dshapps.automations'), `unplugged apps returned: ${JSON.stringify(ids)}`)
  notes.push(`launcher ids: ${ids.join(', ')}`)
  await page.keyboard.press('Escape')

  const composer = page.locator('textarea, [contenteditable="true"]').first()
  await composer.waitFor({ state: 'visible', timeout: 30_000 })
  await composer.click()
  await composer.fill('请使用 open_app 工具打开用量应用，app_id 是 dshapps.usage，不要提问，直接调用。')
  await page.keyboard.press('Enter')
  notes.push('prompt sent')

  const card = page.locator('[data-open-app="dshapps.usage"]')
  const deadline = Date.now() + 180_000
  while (Date.now() < deadline) {
    if (await card.count() > 0 && await card.first().isVisible().catch(() => false)) break
    await approveIfAsked()
    await page.waitForTimeout(1_000)
  }
  assert(await card.count() > 0, `open_app card did not appear within 180s\n${(await page.locator('body').innerText()).slice(0, 3_000)}`)
  await card.first().scrollIntoViewIfNeeded()
  await page.screenshot({ path: join(shots, 'card.png') })
  notes.push(`card visible; screenshot ${join(shots, 'card.png')}`)

  assert(new URL(page.url()).pathname !== usagePath, 'card must not auto-navigate')

  await card.first().getByRole('button').first().click()
  await page.waitForFunction(path => window.location.pathname === path, usagePath, { timeout: 15_000 })
  const conversation = await page.locator('[data-conversation-scroll]').count()
  assert(conversation === 1, 'conversation must stay mounted after card click')
  await page.locator('[data-day]').first().waitFor({ state: 'visible', timeout: 30_000 })
  await page.screenshot({ path: join(shots, 'opened.png') })
  notes.push(`card click opened ${usagePath}; heatmap visible; screenshot ${join(shots, 'opened.png')}`)

  await page.keyboard.press('Escape')
  await page.waitForFunction(path => window.location.pathname !== path, usagePath, { timeout: 15_000 })

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 })
  await dismissNotice()
  await page.locator('[data-open-app="dshapps.usage"]').first().waitFor({ state: 'visible', timeout: 60_000 })
  await page.waitForTimeout(2_000)
  assert(new URL(page.url()).pathname !== usagePath, 'replayed card must stay inert (no auto-navigation)')
  notes.push('replay: card present after reload, no auto-navigation')

  console.log(JSON.stringify({ ok: true, shots, notes }, null, 2))
} catch (error) {
  await page.screenshot({ path: join(shots, 'failure.png') }).catch(() => {})
  console.error(`URL: ${page.url()}\nshots: ${shots}`)
  throw error
} finally {
  await browser.close()
}
