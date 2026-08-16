import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'

const base = 'http://127.0.0.1:11350'
const shots = mkdtempSync(join(tmpdir(), 'phase-0.6-style-'))
const browser = await chromium.launch()
const notes = []

async function dismissNotice(page) {
  const button = page.getByRole('button', { name: 'Continue', exact: true })
  try {
    await button.waitFor({ state: 'visible', timeout: 5_000 })
    await button.click()
    await button.waitFor({ state: 'hidden', timeout: 5_000 })
  } catch {
    // No notice in this profile state.
  }
}

/** The theme attribute lands after boot; `color-scheme` alone repaints the canvas first. */
async function waitForTheme(page, colorScheme) {
  await page.waitForFunction(
    expected => document.body.hasAttribute('data-ds-dark-theme') === expected,
    colorScheme === 'dark',
    { timeout: 30_000 },
  )
}

async function capture(colorScheme) {
  const context = await browser.newContext({
    locale: 'en-US',
    viewport: { width: 1680, height: 1000 },
    colorScheme,
  })
  const page = await context.newPage()
  try {
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await dismissNotice(page)

    await page.goto(`${base}/apps/dshapps.usage`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await dismissNotice(page)
    await page.locator('[data-day]').first().waitFor({ state: 'visible', timeout: 60_000 })
    await waitForTheme(page, colorScheme)
    await page.waitForTimeout(2_500)
    const cellBox = await page.locator('[data-day]').first().boundingBox()
    const providers = await page.locator('[data-provider]').count()
    await page.screenshot({ path: join(shots, `usage-${colorScheme}.png`) })
    notes.push(`usage/${colorScheme}: cell ${cellBox?.width}x${cellBox?.height}, ${providers} provider cards`)

    const composer = page.locator('textarea, [contenteditable="true"]').first()
    await page.goto(`${base}/apps/dshapps.notes`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await dismissNotice(page)
    await page.locator('[data-route="/"]').waitFor({ state: 'visible', timeout: 60_000 })
    await waitForTheme(page, colorScheme)
    await page.screenshot({ path: join(shots, `notes-empty-${colorScheme}.png`) })

    const area = page.locator('[data-route="/"] textarea').first()
    await area.waitFor({ state: 'visible', timeout: 15_000 })
    await area.fill(`样式验收 ${colorScheme} — 这是一条用于检查排版与层次的笔记。`)
    await page.getByRole('button', { name: /Save|保存/ }).first().click()
    await page.waitForTimeout(1_200)
    await page.screenshot({ path: join(shots, `notes-detail-${colorScheme}.png`) })
    const route = await page.locator('[data-route]').first().getAttribute('data-route')
    notes.push(`notes/${colorScheme}: after save route=${route}`)

    await page.goto(`${base}/apps/dshapps.notes`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await dismissNotice(page)
    await page.locator('[data-route="/"]').waitFor({ state: 'visible', timeout: 30_000 })
    await page.waitForTimeout(800)
    await page.screenshot({ path: join(shots, `notes-list-${colorScheme}.png`) })
    void composer
  } finally {
    await context.close()
  }
}

try {
  await capture('light')
  await capture('dark')
  console.log(JSON.stringify({ ok: true, shots, notes }, null, 2))
} finally {
  await browser.close()
}
