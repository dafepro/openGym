import { test, expect, noHorizontalOverflow } from './fixtures.js'

async function pullDown(page, ball, endY) {
  const box = await ball.boundingBox()
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, endY ?? y + 130, { steps: 4 })
  return { x, y }
}

test('pulling back aims and charges the kick; tap returns the ball', async ({
  page,
}, testInfo) => {
  const home = page.getByRole('button', { name: 'Kick the soccer ball' })
  const ball = page.getByRole('button', { name: 'Return soccer ball' })
  const arrow = page.locator('.pb-kick-aim')
  const origin = await home.boundingBox()
  await home.click()
  await expect(ball).toHaveCount(0)

  const { x, y } = await pullDown(page, home, origin.y + origin.height / 2 + 12)
  await expect(arrow).toBeVisible()
  const guide = () =>
    arrow.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        width: parseFloat(style.width),
        color: style.color,
        direction: new DOMMatrix(style.transform).b,
      }
    })
  const light = await guide()
  expect(light.direction).toBeCloseTo(-1)
  const [lightRed, lightGreen] = light.color.match(/\d+/g).map(Number)
  expect(lightGreen).toBeGreaterThan(lightRed)
  await page.mouse.move(x, y + 130, { steps: 5 })
  const full = await guide()
  const [fullRed, fullGreen] = full.color.match(/\d+/g).map(Number)
  expect(fullRed).toBeGreaterThan(fullGreen * 2)
  expect(full.width).toBeGreaterThan(light.width + 50)
  await page.mouse.move(x, y + 154)
  expect((await guide()).width).toBe(full.width)
  await page.mouse.up()
  await expect(arrow).toBeHidden()

  if (testInfo.project.name === 'reduced-motion') {
    await expect(ball).toHaveCount(0)
  } else {
    await expect(ball).toHaveAttribute('data-moving', 'true')
    await expect
      .poll(async () => (await ball.boundingBox()).y)
      .toBeLessThan(origin.y - 15)
    await expect(ball).toHaveAttribute('data-moving', 'false', {
      timeout: 15000,
    })
    await noHorizontalOverflow(page)

    // Even with little space to pull at the floor, full power reaches the top.
    await pullDown(page, ball, page.viewportSize().height - 1)
    await page.mouse.up()
    await expect
      .poll(async () => (await ball.boundingBox()).y, {
        intervals: [16],
        timeout: 4000,
      })
      .toBeLessThan(16)
    await expect(ball).toHaveAttribute('data-moving', 'false', {
      timeout: 15000,
    })
    if (testInfo.project.use.hasTouch) await ball.tap()
    else await ball.click()
    await expect(home).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'My practices' }),
    ).toBeVisible()
    expect((await home.boundingBox()).y).toBeCloseTo(origin.y)

    await home.focus()
    await home.press('Enter')
    await expect(ball).toBeFocused()
    await ball.press('Escape')
    await expect(home).toBeFocused()
    await home.press('Enter')
  }
  await page.getByRole('button', { name: 'New practice', exact: true }).click()
  await expect(ball).toHaveCount(0)
  await expect(arrow).toHaveCount(0)
})
