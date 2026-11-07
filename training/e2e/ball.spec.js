import { test, expect, noHorizontalOverflow } from './fixtures.js'

test('soccer ball bounces, settles, can be kicked again and leaves navigation usable', async ({ page }, testInfo) => {
  const ball = page.getByRole('button', { name: 'Kick the soccer ball' })
  await ball.click()
  if (testInfo.project.name === 'reduced-motion') {
    await expect(page.locator('.pb-kick-ball.is-loose')).toHaveCount(0)
  } else {
    await expect(ball).toHaveAttribute('data-moving', 'true')
    const initial = await ball.boundingBox()
    await expect.poll(async () => Math.abs((await ball.boundingBox()).y - initial.y)).toBeGreaterThan(15)
    await expect(ball).toHaveAttribute('data-moving', 'false', { timeout: 15000 })
    const box = await ball.boundingBox(), viewport = page.viewportSize()
    expect(box.x).toBeGreaterThanOrEqual(-6)
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 6)
    await noHorizontalOverflow(page)
    await ball.focus()
    await ball.press('Enter')
    await expect(ball).toHaveAttribute('data-moving', 'true')
    await ball.press('Escape')
    await expect(page.locator('.pb-kick-ball.is-loose')).toHaveCount(0)
    await expect(ball).toBeFocused()
    await ball.press('Enter')
  }
  await page.getByRole('button', { name: 'New practice', exact: true }).click()
  await expect(page.locator('.pb-kick-ball.is-loose')).toHaveCount(0)
})
