import { test, expect, catalog, noHorizontalOverflow } from './fixtures.js'
import { validateCatalog } from '../src/domain/content.js'

// Layout stress only. Synthetic quantities exercise supported UI bounds; they
// are not soccer prescriptions. Routes are local to this file/test context.
const practiceTitle = `Synthetic practice ${'TouchControl'.repeat(24)}`.slice(0, 240)
const parentNote = `Synthetic parent note ${'KeepTheBallClose'.repeat(40)}`.slice(0, 500)
const drillTitle = `Synthetic close touches ${'ControlAndBalance'.repeat(16)}`.slice(0, 240)
const template = catalog.assignments[0].drills[0]
const stressCatalog = validateCatalog({
  ...catalog, revision: 'layout-stress-v1', currentAssignmentId: 'layout-stress', currentAssignmentRevision: 'v1',
  assignments: [{ id: 'layout-stress', revision: 'v1', title: practiceTitle, note: parentNote, status: 'current', assignedOn: '2026-11-04', drills: Array.from({ length: 12 }, (_, index) => ({
    ...structuredClone(template), id: `layout-drill-${index + 1}`,
    title: index === 0 ? drillTitle : index === 11 ? 'Synthetic 24-hour timer boundary' : `Synthetic rail drill ${index + 1}`,
    instructions: 'Synthetic layout test only. Use the controls to verify recording and navigation.',
    ...(index === 0 ? { mode: 'reps', reps: 10000, sets: 1, restSec: 0 }
      : index === 11 ? { mode: 'time', durationSec: 86400, sets: 1, restSec: 0 }
      : { mode: 'practice', sets: 1, restSec: null }),
  })) }],
})

async function installStressCatalog(page, context) {
  await context.route('**/api/catalog', route => route.fulfill({ json: stressCatalog }))
  await page.reload()
  await expect(page.getByRole('heading', { name: practiceTitle, exact: true })).toBeVisible()
}
async function settle(page) {
  await expect(page.locator('[data-motion-snapshot], .qt-content-enter, .qt-dock-enter')).toHaveCount(0)
}
async function screenshot(page, testInfo, name) {
  await settle(page)
  const path = testInfo.outputPath(`${name}.png`)
  await page.screenshot({ path, fullPage: false })
  await testInfo.attach(name, { path, contentType: 'image/png' })
}
async function expectDockReachable(page) {
  await settle(page)
  await noHorizontalOverflow(page)
  const dock = page.getByRole('region', { name: 'Practice controls' })
  const geometry = await dock.evaluate(element => {
    const rectangle = node => {
      const { x, y, width, height, right, bottom } = node.getBoundingClientRect()
      return { x, y, width, height, right, bottom }
    }
    return {
      viewport: { width: innerWidth, height: innerHeight }, dock: rectangle(element),
      actions: [...element.querySelectorAll('button')].map(button => {
        const box = rectangle(button)
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
        return { name: button.getAttribute('aria-label') || button.textContent, box, hit: hit === button || button.contains(hit), disabled: button.disabled }
      }),
    }
  })
  expect(geometry.dock.x).toBeGreaterThanOrEqual(-1)
  expect(geometry.dock.y).toBeGreaterThanOrEqual(-1)
  expect(geometry.dock.right).toBeLessThanOrEqual(geometry.viewport.width + 1)
  expect(geometry.dock.bottom).toBeLessThanOrEqual(geometry.viewport.height + 1)
  for (const action of geometry.actions) {
    expect(action.box.width, `${action.name} retains a 44 px target`).toBeGreaterThanOrEqual(43.5)
    expect(action.box.height, `${action.name} retains a 44 px target`).toBeGreaterThanOrEqual(43.5)
    if (!action.disabled) expect(action.hit, `${action.name} is reachable at its visible center`).toBe(true)
  }
  await dock.getByRole('button', { name: 'Quit practice', exact: true }).click({ trial: true })
}
async function expectWholeNumericValue(input, value) {
  await expect(input).toHaveValue(value)
  const measurement = await input.evaluate(element => {
    const style = getComputedStyle(element)
    const probe = document.createElement('span')
    Object.assign(probe.style, { position: 'fixed', visibility: 'hidden', whiteSpace: 'pre', padding: '0', border: '0',
      fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight, fontStyle: style.fontStyle,
      fontStretch: style.fontStretch, fontVariantNumeric: style.fontVariantNumeric,
      fontFeatureSettings: style.fontFeatureSettings, letterSpacing: style.letterSpacing })
    probe.textContent = element.value
    document.body.append(probe)
    const scale = element.getBoundingClientRect().width / element.offsetWidth
    const required = probe.getBoundingClientRect().width / scale
    probe.remove()
    return { value: element.value, required,
      available: element.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight) }

  })
  expect(measurement.available, `All ${value.length} digits fit the numeric field without horizontal clipping`).toBeGreaterThanOrEqual(measurement.required - 1)
}
async function enterRepBoundary(page) {
  await page.getByRole('button', { name: 'Start practice', exact: true }).click()
  const input = page.getByRole('spinbutton', { name: 'Repetitions completed', exact: true })
  await input.fill('10000')
  await expectWholeNumericValue(input, '10000')
  await expect(page.getByRole('button', { name: 'Add one repetition', exact: true })).toBeDisabled()
  await expectDockReachable(page)
}
async function reachTimerBoundary(page) {
  await page.getByRole('button', { name: 'Next drill', exact: true }).click()
  for (let index = 1; index < 11; index++) {
    await expect(page.getByRole('heading', { name: stressCatalog.assignments[0].drills[index].title, exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Start drill', exact: true }).click()
    await page.getByRole('button', { name: 'Next drill', exact: true }).click()
  }
  await expect(page.getByRole('heading', { name: 'Synthetic 24-hour timer boundary', exact: true })).toBeVisible()
  await expect(page.getByRole('timer', { name: 'Work time remaining', exact: true })).toHaveText('1440:00')
  await page.getByRole('button', { name: 'Start set', exact: true }).click({ trial: true })
  await expectDockReachable(page)
  const rail = await page.locator('.pb-drill-index').evaluate(element => {
    const current = element.querySelector('[aria-current="step"]')
    const rail = element.getBoundingClientRect(), item = current.getBoundingClientRect()
    return { total: element.children.length, scrollable: element.scrollWidth > element.clientWidth, scrollLeft: element.scrollLeft,
      visibleCurrent: item.left >= rail.left - 1 && item.right <= rail.right + 1, current: current.textContent }
  })
  expect(rail.total).toBe(12)
  expect(rail.current).toBe('12')
  expect(rail.visibleCurrent, 'The current drill stays visible in the internal rail').toBe(true)
  if (rail.scrollable) expect(rail.scrollLeft).toBeGreaterThan(0)
  const collision = await page.getByRole('region', { name: 'Practice controls' }).evaluate(element => {
    const timer = element.querySelector('[role="timer"]').getBoundingClientRect()
    const start = element.querySelector('.qt-control-play').getBoundingClientRect()
    return timer.right > start.left && timer.left < start.right && timer.bottom > start.top && timer.top < start.bottom
  })
  expect(collision, 'The 24-hour readout does not collide with Start').toBe(false)
}

test('320×568 compact layout retains long text, five digits, and a 12-drill rail with 24-hour target', async ({ page, context }, testInfo) => {
  test.skip(!['mobile-chromium', 'mobile-webkit', 'reduced-motion'].includes(testInfo.project.name), 'Run compact boundary once per mobile engine/motion configuration.')
  await page.setViewportSize({ width: 320, height: 568 })
  await installStressCatalog(page, context)
  await noHorizontalOverflow(page)
  const note = page.locator('.pb-practice-note')
  await expect(note).toHaveText(parentNote)
  expect(await page.getByRole('button', { name: 'Start practice', exact: true }).evaluate((button, text) => {
    const note = [...document.querySelectorAll('.pb-practice-note')].find(item => item.textContent === text)
    return !!(button.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING)
  }, parentNote), 'Start remains ahead of arbitrary parent prose').toBe(true)
  await screenshot(page, testInfo, 'compact320-long-practice')
  await note.scrollIntoViewIfNeeded()
  await noHorizontalOverflow(page)
  await screenshot(page, testInfo, 'compact320-long-note')
  await enterRepBoundary(page)
  await screenshot(page, testInfo, 'compact320-10000-reps')
  await reachTimerBoundary(page)
  await screenshot(page, testInfo, 'compact320-12-drill-rail-24h')
})

test('desktop 200% CSS zoom layout stress retains full numeric fields and essential controls', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'CSS zoom stress is a desktop Chromium fixture, not OS text scaling or browser zoom evidence.')
  await page.setViewportSize({ width: 1280, height: 900 })
  await installStressCatalog(page, context)
  await page.evaluate(() => { document.documentElement.style.zoom = '2' })
  await testInfo.attach('zoom-scope', { body: 'CSS zoom: 200% at 1280×900. This is a layout stress fixture, not evidence of OS text scaling or actual browser zoom.', contentType: 'text/plain' })
  await noHorizontalOverflow(page)
  await screenshot(page, testInfo, 'desktop-css-zoom200-long-practice')
  await enterRepBoundary(page)
  await screenshot(page, testInfo, 'desktop-css-zoom200-10000-reps')
  await reachTimerBoundary(page)
  await screenshot(page, testInfo, 'desktop-css-zoom200-24h')
})
