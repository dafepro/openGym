import { test, expect, firstTitle, capture } from './fixtures.js'

test('native video obeys repeat handles and speed, then reopens muted with fresh controls', async ({ page }, testInfo) => {
  const open = page.getByRole('button', { name: `Watch ${firstTitle}`, exact: true })
  await open.click()
  const demo = page.getByRole('dialog', { name: firstTitle, exact: true })
  const video = demo.locator('video')
  await expect.poll(() => video.evaluate(element => !element.paused && element.muted && element.duration > 4)).toBe(true)
  await demo.getByRole('combobox', { name: 'Playback speed', exact: true }).selectOption('0.5')
  await expect.poll(() => video.evaluate(element => element.playbackRate)).toBe(0.5)
  await demo.getByRole('combobox', { name: 'Playback speed', exact: true }).selectOption('1.5')
  await expect.poll(() => video.evaluate(element => element.playbackRate)).toBe(1.5)
  await demo.getByRole('button', { name: 'Pause video', exact: true }).click()
  await expect.poll(() => video.evaluate(element => element.paused)).toBe(true)

  await demo.getByRole('button', { name: 'Repeat section', exact: true }).click()
  const start = demo.getByRole('slider', { name: 'Repeat start', exact: true })
  const end = demo.getByRole('slider', { name: 'Repeat end', exact: true })
  await expect(start).toBeVisible()
  await expect(end).toBeVisible()
  // Real native range input keyboard actions exercise the same onChange path as
  // dragging the handles; no programmatic assignment of playback time or bounds.
  await start.press('Home')
  for (let step = 0; step < 10; step++) await start.press('ArrowRight')
  await expect.poll(async () => Number(await start.inputValue())).toBeCloseTo(1, 3)
  await end.press('Home')
  await expect.poll(async () => Number(await end.inputValue())).toBeCloseTo(1.5, 3)
  for (let step = 0; step < 15; step++) await end.press('ArrowRight')
  await expect.poll(async () => Number(await end.inputValue())).toBeCloseTo(3, 3)
  await expect(start).toHaveAttribute('aria-valuetext', 'A: 0:01.0')
  await expect(end).toHaveAttribute('aria-valuetext', 'B: 0:03.0')
  await expect(demo.getByRole('button', { name: 'Repeat section', exact: true })).toHaveAttribute('aria-pressed', 'true')

  await video.evaluate(element => {
    const samples = []
    let frame, running = true
    const sample = () => {
      samples.push(element.currentTime)
      if (running) frame = requestAnimationFrame(sample)
    }
    sample()
    window.__videoLoopProbe = {
      samples,
      stop: () => { running = false; cancelAnimationFrame(frame); return samples },
    }
  })
  try {
    await demo.getByRole('button', { name: 'Play video', exact: true }).click()
    await expect.poll(() => page.evaluate(() => window.__videoLoopProbe.samples.some((time, index, values) => index > 0 && values[index - 1] > 2.4 && time >= 0.95 && time < 1.6)), { intervals: [50, 100, 150], message: 'Playback reaches B, then actually seeks back to A' }).toBe(true)
  } finally {
    const samples = await page.evaluate(() => window.__videoLoopProbe.stop())
    await testInfo.attach('native-video-loop-times', { body: JSON.stringify(samples), contentType: 'application/json' })
  }
  await demo.getByRole('button', { name: 'Unmute video', exact: true }).click()
  await expect.poll(() => video.evaluate(element => element.muted)).toBe(false)
  await capture(page, testInfo, 'video-repeat-handles')
  await demo.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await expect(demo).toHaveCount(0)
  await open.click()
  await expect.poll(() => video.evaluate(element => !element.paused && element.muted && element.playbackRate === 1)).toBe(true)
  await expect(demo.getByRole('button', { name: 'Unmute video', exact: true })).toBeVisible()
  await expect(demo.getByRole('button', { name: 'Repeat section', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await expect(demo.getByRole('slider', { name: 'Repeat start', exact: true })).toHaveCount(0)
  await demo.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await expect(demo).toHaveCount(0)
  await page.getByRole('button', { name: 'Start practice', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Practice controls' })).toHaveAttribute('data-phase', 'working')
})

test('failed help playback closes cleanly, retries, and leaves the active drill usable', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Start practice', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Practice controls' })).toHaveAttribute('data-phase', 'working')
  let failPlayback = true
  await page.route('**/media/e2e-touches', async route => {
    if (failPlayback) await route.fulfill({ status: 503, contentType: 'text/plain', body: 'Synthetic playback failure' })
    else await route.fallback()
  })
  const demo = page.getByRole('dialog', { name: firstTitle, exact: true })
  try {
    await page.getByRole('button', { name: 'Watch demonstration', exact: true }).click()
    await expect(demo.getByText('Video could not play', { exact: true })).toBeVisible()
    await capture(page, testInfo, 'recoverable-video-failure')
    await demo.getByRole('button', { name: 'Close dialog', exact: true }).click()
    await expect(demo).toHaveCount(0)
    await expect(page.getByRole('heading', { name: firstTitle, exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Do the drill', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Resume practice timer', exact: true })).toBeEnabled()
    const timer = page.getByRole('timer', { name: 'Time practiced' })
    const pausedAt = await timer.textContent()
    await page.getByRole('button', { name: 'Watch demonstration', exact: true }).click()
    await expect(demo.getByRole('button', { name: 'Retry video', exact: true })).toBeVisible()
    failPlayback = false
    await demo.getByRole('button', { name: 'Retry video', exact: true }).click()
    await expect.poll(() => demo.locator('video').evaluate(element => element.readyState >= 2 && !element.error && element.duration > 0)).toBe(true)
    await expect(demo.getByText('Video could not play', { exact: true })).toHaveCount(0)
    await demo.getByRole('button', { name: 'Close dialog', exact: true }).click()
    await expect(demo).toHaveCount(0)
    await expect(timer).toHaveText(pausedAt)
    await page.getByRole('button', { name: 'Resume practice timer', exact: true }).click()
    await expect(timer).not.toHaveText(pausedAt)
    await page.getByRole('button', { name: 'Next drill', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Synthetic passing count', exact: true })).toBeVisible()
  } finally { await page.unrouteAll({ behavior: 'wait' }) }
})
