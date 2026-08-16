import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'

const base = 'http://127.0.0.1:11350'
const notesPath = '/apps/dshapps.notes'
const shots = mkdtempSync(join(tmpdir(), 'phase-0.6-notes-'))

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

try {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await dismissNotice()

  await page.getByRole('button', { name: 'Apps', exact: true }).waitFor({ state: 'visible', timeout: 30_000 })
  await page.getByRole('button', { name: 'Apps', exact: true }).click()
  await page.locator('[data-app-id="dshapps.notes"]').first().waitFor({ state: 'visible', timeout: 15_000 })
  const ids = await page.locator('[data-app-id]').evaluateAll(nodes => [...new Set(nodes.map(node => node.getAttribute('data-app-id')))])
  assert(ids.includes('dshapps.notes') && ids.includes('dshapps.usage') && ids.includes('dshapps.inspector'), `launcher ids: ${JSON.stringify(ids)}`)
  notes.push(`launcher ids: ${ids.join(', ')}`)
  await page.keyboard.press('Escape')

  const composer = page.locator('textarea, [contenteditable="true"]').first()
  await composer.waitFor({ state: 'visible', timeout: 30_000 })
  await composer.click()
  await composer.fill('请使用 open_app 工具打开鲸鱼笔记，app_id 是 dshapps.notes，直接调用。')
  await page.keyboard.press('Enter')

  const card = page.locator('[data-open-app="dshapps.notes"]')
  const deadline = Date.now() + 180_000
  while (Date.now() < deadline) {
    if (await card.count() > 0 && await card.first().isVisible().catch(() => false)) break
    await page.waitForTimeout(1_000)
  }
  assert(await card.count() > 0, `open_app card for notes did not appear\n${(await page.locator('body').innerText()).slice(0, 3_000)}`)
  assert(new URL(page.url()).pathname !== notesPath, 'card must not auto-navigate')

  await card.first().getByRole('button').first().click()
  await page.waitForFunction(path => window.location.pathname === path, notesPath, { timeout: 15_000 })
  assert(await page.locator('[data-conversation-scroll]').count() === 1, 'conversation must stay mounted')
  await page.waitForTimeout(1_500)
  const panelText = await page.locator('[role="dialog"]').last().innerText().catch(() => '')
  assert(panelText.length > 0, 'notes panel rendered nothing')
  await page.screenshot({ path: join(shots, 'notes-open.png') })
  notes.push(`open_app card opened ${notesPath}; panel text head: ${panelText.slice(0, 120).replaceAll('\n', ' / ')}`)

  await page.keyboard.press('Escape')
  console.log(JSON.stringify({ ok: true, shots, notes }, null, 2))
} catch (error) {
  await page.screenshot({ path: join(shots, 'failure.png') }).catch(() => {})
  console.error(`URL: ${page.url()}\nshots: ${shots}`)
  throw error
} finally {
  await browser.close()
}
