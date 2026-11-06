// Local review using an explicitly supplied private catalog. Provider APIs are mocked.
import { chromium, expect } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { loadPrivatePreview } from './private-preview.mjs'
const bundle = loadPrivatePreview(process.env.TRAINING_VISUAL_BUNDLE)
const output = resolve(
  process.env.TRAINING_VISUAL_OUTPUT || '.playwright/coach-visual',
)
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true }),
  measurements = []
async function install(context) {
  await context.route('**/api/catalog', (route) =>
    route.fulfill({ json: bundle.catalog }),
  )
  await context.route('**/api/coach/config', (route) =>
    route.fulfill({
      json: { configured: false, channels: { email: false, sms: false } },
    }),
  )
  await context.route('**/media/*', async (route) => {
    const entry = bundle.media.get(
      new URL(route.request().url()).pathname.slice('/media/'.length),
    )
    if (!entry) return route.fulfill({ status: 404 })
    const file = await readFile(entry.path),
      range = route
        .request()
        .headers()
        .range?.match(/^bytes=(\d+)-(\d*)$/)
    const start = range ? Number(range[1]) : 0,
      end = range?.[2]
        ? Math.min(Number(range[2]), file.length - 1)
        : file.length - 1
    await route.fulfill({
      status: range ? 206 : 200,
      contentType: 'video/mp4',
      headers: {
        'accept-ranges': 'bytes',
        ...(range
          ? { 'content-range': `bytes ${start}-${end}/${file.length}` }
          : {}),
      },
      body: file.subarray(start, end + 1),
    })
  })
}
async function shot(page, name) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    ),
  )
  const geometry = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    overflow: document.documentElement.scrollWidth - innerWidth,
  }))
  expect(geometry.width).toBe(page.viewportSize().width)
  expect(geometry.overflow).toBeLessThanOrEqual(1)
  await page.screenshot({
    path: resolve(output, `${name}.png`),
    animations: 'disabled',
  })
  measurements.push({ name, ...geometry })
}
try {
  for (const [label, width, height] of [
    ['phone', 390, 844],
    ['small', 320, 568],
    ['landscape', 844, 390],
    ['desktop', 1280, 900],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
      isMobile: width < 900,
      hasTouch: width < 900,
    })
    await install(context)
    const page = await context.newPage(),
      errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('http://127.0.0.1:4189/')
    await expect(
      page.getByRole('heading', { name: 'My practices', exact: true }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Save assigned practice', exact: true })
      .click()
    await expect(page.locator('.pb-practice-choice')).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    await shot(page, `${label}-saved-home`)
    await page
      .getByText(
        `See the ${bundle.catalog.assignments[0].drills.length} drills`,
        { exact: true },
      )
      .click()
    const long = bundle.catalog.assignments[0].drills.at(-1)
    await page
      .getByRole('button', { name: `Watch ${long.title}`, exact: true })
      .click()
    const dialog = page.getByRole('dialog'),
      video = dialog.locator('video')
    await expect
      .poll(() => video.evaluate((v) => v.duration > 0 && !v.paused))
      .toBe(true)
    await dialog
      .getByRole('button', { name: 'Pause video', exact: true })
      .click()
    const timeline = dialog.getByRole('slider', {
        name: 'Video position',
        exact: true,
      }),
      box = await timeline.boundingBox()
    await timeline.click({
      position: { x: box.width * 0.35, y: box.height / 2 },
    })
    await expect.poll(() => video.evaluate((v) => !v.seeking)).toBe(true)
    await dialog
      .getByRole('button', { name: 'Repeat section', exact: true })
      .click()
    const start = dialog.getByRole('slider', {
        name: 'Repeat start',
        exact: true,
      }),
      end = dialog.getByRole('slider', { name: 'Repeat end', exact: true })
    for (let i = 0; i < 10; i++) await start.press('ArrowRight')
    for (let i = 0; i < 40; i++) await end.press('ArrowLeft')
    await expect
      .poll(() => video.evaluate((v) => v.readyState >= 2 && !v.seeking))
      .toBe(true)
    const recent = dialog.getByRole('button', {
      name: 'Loop last 5s',
      exact: true,
    })
    await expect
      .poll(() =>
        recent.evaluate((el) => {
          const b = el.getBoundingClientRect()
          return (
            b.bottom <= innerHeight &&
            el.contains(
              document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2),
            )
          )
        }),
      )
      .toBe(true)
    await shot(page, `${label}-repeat-context`)
    await dialog
      .getByRole('button', { name: 'Close dialog', exact: true })
      .click()
    await page.getByRole('button', { name: 'Me', exact: true }).click()
    await shot(page, `${label}-profile`)
    await page.getByRole('link', { name: 'Coach’s desk', exact: true }).click()
    await page
      .getByRole('textbox', {
        name: 'What should the player work on?',
        exact: true,
      })
      .fill(
        '20 minutes of close control. One ball, four cones and a small outdoor space. Both feet. Quick, accurate touches; keep the ball close. Finish with a skill move at game speed.',
      )
    await page.evaluate(() => scrollTo(0, 0))
    await shot(page, `${label}-coach-draft`)
    // Explicit interface preview only: no request, research, issue or notification is sent.
    await page.route('**/api/coach/config', (route) =>
      route.fulfill({
        json: { configured: true, channels: { email: true, sms: true } },
      }),
    )
    await page.route('**/api/coach/requests', (route) =>
      route.fulfill({
        json: {
          requests: [
            {
              id: 'preview-only',
              createdAt: Date.now(),
              brief: 'Preview of the proposal review flow.',
              status: 'submitted',
              recipientCount: 2,
              issueUrl: 'https://github.com/dafepro/openGym/issues',
              plan: {
                title: 'Preview · close control, both feet',
                goal: 'Fast feet. Small, accurate touches.',
                drills: [
                  {
                    title: 'Two-cone control',
                    mode: 'time',
                    sets: 3,
                    durationSec: 60,
                    side: 'each',
                    focus: 'Keep the ball within one step. Use both feet.',
                    sources: [
                      {
                        title: 'Example coaching guide',
                        url: 'https://example.org/coaching-guide-one',
                      },
                    ],
                  },
                  {
                    title: 'Touch rhythm',
                    mode: 'time',
                    sets: 2,
                    durationSec: 45,
                    side: 'both',
                    focus: 'Stay light on your feet.',
                    sources: [
                      {
                        title: 'Example coaching guide',
                        url: 'https://example.org/coaching-guide-two',
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      }),
    )
    await page.reload()
    await page.getByText('2 proposed drills', { exact: true }).click()
    await page
      .getByRole('heading', { name: 'Your requests', exact: true })
      .scrollIntoViewIfNeeded()
    await shot(page, `${label}-coach-proposal-preview`)
    await page
      .locator('.pb-coach-requests')
      .screenshot({
        path: resolve(output, `${label}-coach-proposal-card.png`),
        animations: 'disabled',
      })
    expect(errors).toEqual([])
    await context.unrouteAll({ behavior: 'wait' })
    await context.close()
  }
  await writeFile(
    resolve(output, 'coach-measurements.json'),
    JSON.stringify(measurements, null, 2),
  )
  console.log(JSON.stringify({ output, measurements }))
} finally {
  await browser.close()
}
