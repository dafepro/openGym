import { test as base, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { validateCatalog } from '../src/domain/index.js'

const requirements = { settings: ['indoor', 'outdoor'], equipment: ['ball'], participants: { min: 1, max: 1, roles: [] }, space: { lengthM: 6, widthM: 6 } }
const unmeasuredRequirements = structuredClone(requirements)
delete unmeasuredRequirements.space
const drill = (id, title, skill, extra = {}) => ({
  id, title, instructions: 'Synthetic software test only. Set up the fixture and record the work you actually complete.',
  mode: 'practice', sets: 1, side: 'both', restSec: null,
  media: { id: `e2e-${id}`, status: 'approved', path: `/media/e2e-${id}` },
  metadata: { version: 1, registryVersion: 1, tags: [skill], requirements: structuredClone(requirements) },
  ...extra,
})
export const assignedTitle = 'Synthetic assigned practice'
export const firstTitle = 'Synthetic close touches'
export const repsTitle = 'Synthetic passing count'
export const catalog = validateCatalog({
  schemaVersion: 1, synthetic: true, revision: 'e2e-v1', currentAssignmentId: 'e2e-assigned', currentAssignmentRevision: 'e2e-v1',
  assignments: [
    { id: 'e2e-assigned', revision: 'e2e-v1', title: assignedTitle, assignedOn: '2026-11-04', status: 'current', drills: [
      drill('touches', firstTitle, 'futbol:ball-control'),
      drill('passing', repsTitle, 'futbol:passing', { mode: 'reps', sets: 1, reps: 3, restSec: 0 }),
    ] },
    { id: 'e2e-library', revision: 'e2e-v1', title: 'Synthetic library examples', assignedOn: '2026-11-03', status: 'archived', drills: [
      drill('agility', 'Synthetic agility steps', 'futbol:agility'),
      drill('wall', 'Synthetic wall required', 'futbol:first-touch', { metadata: { version: 1, registryVersion: 1, tags: ['futbol:first-touch'], requirements: { ...structuredClone(requirements), equipment: ['ball', 'wall'] } } }),
      drill('unknown', 'Synthetic unknown setup', 'futbol:shooting', { metadata: { version: 1, registryVersion: 1, tags: ['futbol:shooting'] } }),
      drill('unmeasured', 'Synthetic unmeasured space', 'futbol:dribbling', { metadata: { version: 1, registryVersion: 1, tags: ['futbol:dribbling'], requirements: unmeasuredRequirements } }),
      drill('watch', 'Synthetic watch only', 'futbol:passing', { mode: 'watch' }),
    ] },
  ],
})

export async function installSyntheticRoutes(context) {
  const clip = await readFile(new URL('../fixtures/media/playback-test.mp4', import.meta.url))
  await context.route('**/api/catalog', route => route.fulfill({ json: catalog }))
  await context.route('**/media/e2e-*', async route => {
    const request = route.request()
    const headers = { 'content-type': 'video/mp4', 'accept-ranges': 'bytes', 'cache-control': 'no-store' }
    const range = request.headers().range?.match(/^bytes=(\d+)-(\d*)$/)
    const start = range ? Number(range[1]) : 0
    const end = range?.[2] ? Math.min(Number(range[2]), clip.length - 1) : clip.length - 1
    if (start > end || start >= clip.length) return route.fulfill({ status: 416, headers: { ...headers, 'content-range': `bytes */${clip.length}` } })
    const body = clip.subarray(start, end + 1)
    await route.fulfill({ status: range ? 206 : 200, headers: { ...headers, 'content-length': String(body.length), ...(range ? { 'content-range': `bytes ${start}-${end}/${clip.length}` } : {}) }, body: request.method() === 'HEAD' ? Buffer.alloc(0) : body })
  })
}

export const test = base.extend({
  page: async ({ page, context }, use) => {
    await installSyntheticRoutes(context)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('/')
    await expect(page.getByRole('heading', { name: assignedTitle, exact: true })).toBeVisible()
    await use(page)
    expect(errors, 'Uncaught browser errors').toEqual([])
  },
})
export { expect }

export async function capture(page, testInfo, name) {
  const path = testInfo.outputPath(`${name}.png`)
  await page.screenshot({ path, fullPage: true })
  await testInfo.attach(name, { path, contentType: 'image/png' })
}

export async function noHorizontalOverflow(page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
}

export async function expectSavedRecap(page) {
  await expect(page.getByRole('heading', { name: /Practice complete|Session saved/ })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Practice controls' })).toHaveCount(0)
}
