import { decodeVisibleQR } from '../e2e/qr.js'
import { chromium, expect } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { loadPrivatePreview } from './private-preview.mjs'

const bundle = loadPrivatePreview(process.env.TRAINING_VISUAL_BUNDLE)
const output = resolve(process.env.TRAINING_VISUAL_OUTPUT || '.playwright/practice-pass-visual')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const measurements = []
async function install(context) {
  await context.route('**/api/catalog', route => route.fulfill({ json: bundle.catalog }))
  await context.route('**/media/*', async route => {
    const id = new URL(route.request().url()).pathname.slice('/media/'.length)
    const entry = bundle.media.get(id)
    if (!entry) return route.fulfill({ status: 404 })
    const file = await readFile(entry.path)
    const range = route.request().headers().range?.match(/^bytes=(\d+)-(\d*)$/)
    const start = range ? Number(range[1]) : 0, end = range?.[2] ? Math.min(Number(range[2]), file.length - 1) : file.length - 1
    await route.fulfill({ status: range ? 206 : 200, contentType: 'video/mp4', headers: { 'accept-ranges': 'bytes', ...(range ? { 'content-range': `bytes ${start}-${end}/${file.length}` } : {}) }, body: file.subarray(start, end + 1) })
  })
}
async function shot(page, name, fullPage = false) {
  await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))))
  await expect(page.locator('h1').first()).toBeVisible()
  await page.screenshot({ path: resolve(output, `${name}.png`), animations: 'disabled', fullPage })
  measurements.push({ name, ...await page.evaluate(() => ({ width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth - innerWidth, title: document.querySelector('h1')?.textContent })) })
}
try {
  for (const [label, width, height] of [['phone',390,844],['compact',320,740],['desktop',1280,900]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: width < 900, hasTouch: width < 900 })
    await install(context)
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('http://127.0.0.1:4189/')
    await expect(page.getByRole('heading', { name: 'My practices', exact: true })).toBeVisible()
    await shot(page, `${label}-home`)
    await page.getByRole('button', { name: 'Save assigned practice', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Remove assigned practice from My practices', exact: true })).toBeVisible()
    await page.locator('.pb-practice-choice').first().click()
    await expect.poll(() => page.getByRole('region', { name: 'Selected whole practice', exact: true }).locator('video').evaluateAll(videos => videos.length > 0 && videos.every(video => video.readyState >= 2))).toBe(true)
    await page.getByRole('region', { name: 'Your practice collection' }).scrollIntoViewIfNeeded()
    await expect.poll(() => page.getByRole('region', { name: 'Selected whole practice', exact: true }).locator('video').evaluateAll(videos => videos.every(video => video.currentTime >= 0.12 && !video.seeking))).toBe(true)
    await shot(page, `${label}-saved`)
    await page.getByRole('button', { name: 'Share', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('img', { name: 'Scan to open this practice' })).toBeVisible()
    const scanned = await decodeVisibleQR(page)
    expect(scanned).toMatch(/\/#\/shared\/QT[23]\./)
    await shot(page, `${label}-pass`)
    await dialog.getByText('View link and code', { exact: true }).click()
    const link = await dialog.getByRole('textbox', { name: 'Practice link', exact: true }).inputValue()
    expect(scanned).toBe(link)
    measurements.push({ name: `${label}-pass-size`, linkLength: link.length, qrDecoded: true })
    await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click()
    await page.getByRole('button', { name: 'Add a practice', exact: true }).click()
    await shot(page, `${label}-add`)
    await dialog.getByRole('textbox', { name: 'Practice link or code', exact: true }).fill(link)
    await dialog.getByRole('button', { name: 'Open practice', exact: true }).click()
    await expect(page.getByText('Shared practice', { exact: true })).toBeVisible()
    await shot(page, `${label}-received`)
    await page.getByRole('button', { name: 'Save practice', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Remove from My practices', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Start practice', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Practice controls' })).toHaveAttribute('data-phase', 'working')
    await shot(page, `${label}-started`)
    expect(errors).toEqual([])
    await context.unrouteAll({ behavior: 'wait' })
    await context.close()
  }
  expect(measurements.filter(row => row.overflow > 1)).toEqual([])
  await writeFile(resolve(output, 'measurements.json'), JSON.stringify(measurements, null, 2))
  console.log(JSON.stringify({ output, measurements }))
} finally { await browser.close() }
