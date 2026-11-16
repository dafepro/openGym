import { test, expect, noHorizontalOverflow } from './fixtures.js'

const openGame = async (page) => {
  await page.getByRole('button', { name: 'Play soccer ball game' }).click()
  const dialog = page.getByRole('dialog', { name: 'Pocket pitch' })
  await expect(dialog).toBeVisible()
  await expect
    .poll(() =>
      dialog.evaluate(
        (element) => element.getAnimations().filter((animation) => animation.playState === 'running').length
      )
    )
    .toBe(0)
}
const blue = (page) => page.locator('.pb-score-blue strong')
const gold = (page) => page.locator('.pb-score-gold strong')
const ready = (page) => expect(page.locator('.pb-game-announcement')).toHaveText('')

test('flat pitch, both goals, pause, score reset and modal lifecycle', async ({ page }, testInfo) => {
  await openGame(page)
  const ball = page.getByRole('button', { name: 'Soccer ball', exact: true })
  const start = await ball.boundingBox()
  await expect(ball).toHaveAttribute('data-moving', 'false')
  // Observe several frames: an untouched ball must stay on the flat tabletop.
  await page.waitForTimeout(250)
  const settled = await ball.boundingBox()
  expect(settled.y).toBeCloseTo(start.y, 0)
  expect(settled.x).toBeCloseTo(start.x, 0)
  await noHorizontalOverflow(page)
  for (const name of ['Kick left', 'Kick up', 'Kick down', 'Kick right', 'Enable tilt', 'Reset score']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeInViewport()
  }
  await page.getByRole('button', { name: 'Kick up', exact: true }).click()
  await expect(blue(page)).toHaveText('1')
  await ready(page)
  await page.getByRole('button', { name: 'Kick down', exact: true }).click()
  await expect(gold(page)).toHaveText('1')
  await ready(page)
  await expect(blue(page)).toHaveText('1')
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(ball).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Kick up', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await expect(ball).toBeEnabled()
  await page.screenshot({ path: testInfo.outputPath('pocket-pitch.png'), fullPage: false })
  await page.getByRole('button', { name: 'Close dialog' }).press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Play soccer ball game' })).toBeFocused()
  await openGame(page)
  await expect(blue(page)).toHaveText('1')
  await expect(gold(page)).toHaveText('1')
  await page.getByRole('button', { name: 'Reset score' }).click()
  await expect(blue(page)).toHaveText('0')
  await expect(gold(page)).toHaveText('0')
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await page.getByRole('button', { name: 'New practice', exact: true }).click()
  await expect(ball).toHaveCount(0)
})

test('pull-back aiming and keyboard kicks work without sensors', async ({ page }) => {
  await openGame(page)
  const ball = page.getByRole('button', { name: 'Soccer ball', exact: true })
  const box = await ball.boundingBox()
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + 100, { steps: 6 })
  await expect(page.locator('.pb-game-aim line')).toHaveCount(1)
  await expect(page.locator('.pb-game-aim')).toBeVisible()
  expect(
    await page
      .locator('.pb-game-aim line')
      .evaluate((line) => Number(line.getAttribute('y2')) < Number(line.getAttribute('y1')))
  ).toBe(true)
  await page.mouse.up()
  await expect(page.locator('.pb-game-aim line')).toHaveCount(0)
  await expect(blue(page)).toHaveText('1')
  await ready(page)
  await ball.focus()
  await ball.press('ArrowDown')
  await expect(gold(page)).toHaveText('1')
})

test('tilt is opt-in, calibrates, and stops when backgrounded', async ({ page }) => {
  await page.evaluate(() => {
    window.__motionRequests = 0
    window.DeviceOrientationEvent = {
      requestPermission: async () => {
        window.__motionRequests++
        return 'granted'
      }
    }
  })
  await openGame(page)
  expect(await page.evaluate(() => window.__motionRequests)).toBe(0)
  await page.getByRole('button', { name: 'Enable tilt' }).click()
  await expect(page.getByText('Hold the phone comfortably while tilt connects…')).toBeVisible()
  const orient = (gamma) =>
    page.evaluate((value) => {
      window.dispatchEvent(
        Object.assign(new Event('deviceorientation'), {
          beta: value * Math.sin(((screen.orientation?.angle ?? window.orientation ?? 0) * Math.PI) / 180),
          gamma: value * Math.cos(((screen.orientation?.angle ?? window.orientation ?? 0) * Math.PI) / 180)
        })
      )
    }, gamma)
  await orient(0)
  await expect(page.getByText('Tilt to roll. Set level again whenever you change your hold.')).toBeVisible()
  const ball = page.getByRole('button', { name: 'Soccer ball', exact: true })
  const start = await ball.boundingBox()
  await orient(18)
  await expect
    .poll(async () => {
      await orient(18)
      const box = await ball.boundingBox()
      return box.x + box.width / 2
    })
    .toBeGreaterThan(start.x + start.width / 2 + 4)
  await page.getByRole('button', { name: 'Set level' }).click()
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible()
  await expect(ball).toBeDisabled()
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(ball).toHaveAttribute('data-moving', 'false')
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Enable tilt' })).toBeEnabled()
  expect(await page.evaluate(() => window.__motionRequests)).toBe(1)
})

test('declining motion still allows a goal', async ({ page }) => {
  await page.evaluate(() => {
    window.DeviceOrientationEvent = { requestPermission: async () => 'denied' }
  })
  await openGame(page)
  await page.getByRole('button', { name: 'Enable tilt' }).click()
  await expect(page.getByText('Motion access was declined. Pull back or use the arrows to play.')).toBeVisible()
  await page.getByRole('button', { name: 'Kick up', exact: true }).click()
  await expect(blue(page)).toHaveText('1')
})
