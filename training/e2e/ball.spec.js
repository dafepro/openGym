import { test, expect } from './fixtures.js'

test('contact launches the home ball, pull shows force, and a shot scores', async ({ page }, testInfo) => {
  const homeBall = page.getByRole('button', { name: 'Play soccer ball game' })
  const home = await homeBall.boundingBox()
  await homeBall.click()
  const overlay = page.getByRole('dialog', { name: 'Soccer game' })
  await expect(overlay).toBeVisible()
  await expect
    .poll(() => overlay.evaluate((e) => e.getAnimations().filter((a) => a.playState === 'running').length))
    .toBe(0)
  await expect(page.locator('.pb-night-goal strong')).toHaveText(['0', '0'])
  const bounds = await overlay.boundingBox()
  expect(bounds.width).toBe(page.viewportSize().width)
  expect(bounds.height).toBe(page.viewportSize().height)
  const ball = page.getByRole('button', { name: 'Soccer ball: tap to nudge, pull to aim and kick' })
  const box = await ball.boundingBox()
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  // Launch stays near the source rather than teleporting to the field center.
  expect(Math.hypot(x - home.x - home.width / 2, y - home.y - home.height / 2)).toBeLessThan(180)
  const dx = bounds.width / 2 - x,
    dy = -y
  const length = Math.hypot(dx, dy)
  await page.mouse.move(x - (dx / length) * 45, y - (dy / length) * 45, { steps: 3 })
  const arrow = page.locator('.pb-restored-kick-aim')
  await expect(arrow).toBeVisible()
  const short = await arrow.evaluate((e) => parseFloat(e.style.width))
  await page.mouse.move(x - (dx / length) * 100, y - (dy / length) * 100, { steps: 6 })
  expect(await arrow.evaluate((e) => parseFloat(e.style.width))).toBeGreaterThan(short)
  await page.screenshot({ path: testInfo.outputPath('kick-arrow-and-nets.png') })
  await page.mouse.up()
  await expect(page.locator('.pb-night-goal--blue strong')).toHaveText('1')
  await expect(overlay).toBeVisible()
  await ball.click()
  await expect(overlay).toBeVisible()
  await page.getByRole('button', { name: 'Close soccer game' }).click()
  await expect(overlay).toHaveCount(0)
  await expect(homeBall).toBeFocused()
  // The original pull guide also works before opening the game.
  const parked = await homeBall.boundingBox()
  await page.mouse.move(parked.x + parked.width / 2, parked.y + parked.height / 2)
  await page.mouse.down()
  await page.mouse.move(parked.x + parked.width / 2, parked.y + parked.height / 2 + 80, { steps: 4 })
  await expect(arrow).toBeVisible()
  await page.mouse.up()
  await expect(overlay).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(overlay).toHaveCount(0)
  await expect(homeBall).toBeFocused()
})
