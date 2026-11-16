import { test, expect } from './fixtures.js'

test('full-screen night overlay scores a drag and closes on a tap', async ({ page }) => {
  await page.getByRole('button', { name: 'Play soccer ball game' }).click()
  const overlay = page.getByRole('dialog', { name: 'Soccer game' })
  await expect(overlay).toBeVisible()
  await expect
    .poll(() => overlay.evaluate((e) => e.getAnimations().filter((a) => a.playState === 'running').length))
    .toBe(0)
  expect((await overlay.innerText()).replace(/\s/g, '')).toBe('00')
  const bounds = await overlay.boundingBox()
  expect(bounds.width).toBe(page.viewportSize().width)
  expect(bounds.height).toBe(page.viewportSize().height)
  const ball = page.getByRole('button', { name: 'Soccer ball: drag to kick, tap to close' })
  const box = await ball.boundingBox()
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + 100, { steps: 6 })
  await page.mouse.up()
  await expect(page.locator('.pb-night-goal--blue strong')).toHaveText('1')
  await expect(overlay).toBeVisible()
  await ball.click()
  await expect(overlay).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Play soccer ball game' })).toBeFocused()
})
