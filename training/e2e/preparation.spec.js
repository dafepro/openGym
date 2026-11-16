import { test, expect, catalog, capture, noHorizontalOverflow } from './fixtures.js'

test('players see setup before starting and can inspect a saved practice without starting it', async ({
  page
}, testInfo) => {
  const preparation = page.getByRole('region', { name: 'Before you start', exact: true })
  await expect(preparation).toContainText('Self-paced')
  await expect(preparation).toContainText('Ball')
  await expect(preparation).toContainText('6 × 6 m')
  await expect(preparation).toContainText('Solo')
  await expect(preparation).toContainText('Ball control · Passing')
  const start = page.getByRole('button', { name: 'Start practice', exact: true })
  expect((await preparation.boundingBox()).y).toBeLessThan((await start.boundingBox()).y)
  await noHorizontalOverflow(page)
  await capture(page, testInfo, 'preparation-before-start')
  await page.getByRole('button', { name: 'Save assigned practice', exact: true }).click()
  const saved = page.getByLabel('Saved practices', { exact: true })
  await saved.getByRole('button', { name: new RegExp(catalog.assignments[0].title) }).click()
  await expect(saved.getByRole('region', { name: 'Before you start' })).toContainText('6 × 6 m')
  await expect(page.getByRole('region', { name: 'Practice controls' })).toHaveCount(0)
  await saved.getByRole('button', { name: 'Start this practice', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Practice controls' })).toBeVisible()
})

test('incomplete setup never appears as no equipment or a solo-only practice', async ({ page, context }) => {
  const partial = structuredClone(catalog)
  delete partial.assignments[0].drills[1].metadata.requirements
  await context.route('**/api/catalog', (route) => route.fulfill({ json: partial }))
  await page.reload()
  const preparation = page.getByRole('region', { name: 'Before you start' })
  await expect(preparation).toContainText('Partial list')
  await expect(preparation).toContainText('Some drills unspecified')
  await expect(preparation).toContainText('Check drill instructions for missing setup details.')
  await expect(page.getByRole('button', { name: 'Start practice', exact: true })).toBeEnabled()
})
