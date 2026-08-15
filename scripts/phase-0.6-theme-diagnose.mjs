import { chromium } from 'playwright'

const base = 'http://127.0.0.1:11350'
const browser = await chromium.launch()
const context = await browser.newContext({ colorScheme: 'dark', viewport: { width: 1680, height: 1000 } })
const page = await context.newPage()

async function dismissNotice() {
  const button = page.getByRole('button', { name: 'Continue', exact: true })
  try {
    await button.waitFor({ state: 'visible', timeout: 5_000 })
    await button.click()
  } catch {
    // none
  }
}

async function probe(appId, waitFor) {
  await page.goto(`${base}/apps/${appId}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await dismissNotice()
  await page.locator(waitFor).first().waitFor({ state: 'visible', timeout: 60_000 })
  await page.waitForTimeout(2_000)
  return page.evaluate(() => {
    const read = (element) => {
      const style = getComputedStyle(element)
      return {
        background: style.backgroundColor,
        color: style.color,
        colorScheme: style.colorScheme,
        layer1: style.getPropertyValue('--dsw-alias-bg-layer-1').trim(),
        layer2: style.getPropertyValue('--dsw-alias-bg-layer-2').trim(),
        labelPrimary: style.getPropertyValue('--dsw-alias-label-primary').trim(),
      }
    }
    const dialog = document.querySelector('[role="dialog"]')
    const inner = dialog?.querySelector('article') ?? dialog
    const themedAncestors = []
    for (let node = inner; node !== null; node = node.parentElement) {
      const attrs = [...node.attributes].map(a => `${a.name}=${a.value}`).filter(v => /theme|dark|light|scheme/i.test(v))
      if (attrs.length > 0) themedAncestors.push(`${node.tagName}#${node.id || '-'}: ${attrs.join(' ')}`)
    }
    const localOverrides = [...document.querySelectorAll('style')]
      .map(style => style.textContent ?? '')
      .filter(text => /--dsw-alias-bg-layer|color-scheme\s*:/.test(text))
      .map(text => text.slice(0, 400))
    return {
      root: read(document.documentElement),
      body: read(document.body),
      dialog: dialog === null ? null : read(dialog),
      inner: inner === null ? null : read(inner),
      innerTag: inner?.tagName,
      innerClass: inner?.className,
      themedAncestors,
      styleTagsDefiningTokens: localOverrides.length,
      styleSamples: localOverrides,
      matchMediaDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
    }
  })
}

const usage = await probe('wha1echai.usage', '[data-day]')
const notes = await probe('wha1echai.notes', '[data-route]')
console.log(JSON.stringify({ usage, notes }, null, 2))
await browser.close()
