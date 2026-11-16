import { test, expect, catalog, noHorizontalOverflow, capture } from './fixtures.js'
import { createAssignment, changeAssignment } from '../src/assignments/model.js'

test('coach assignment stays with practice through local save, explicit sharing, feedback and a fresh repeat', async ({
  page
}, testInfo) => {
  let records = []
  let failSubmission = true
  const requests = []
  await page.route('**/api/*/assignments', async (route) => {
    const coach = route.request().url().includes('/coach/')
    if (route.request().method() === 'GET') return route.fulfill({ json: { records } })
    const input = route.request().postDataJSON()
    requests.push(input)
    if (input.action === 'submit' && failSubmission) {
      failSubmission = false
      return route.fulfill({ status: 503, json: { error: 'Connection interrupted. Try again.' } })
    }
    if (input.action === 'create')
      records.unshift({ ...createAssignment(input, 'coach-test'), coachEmail: 'coach@example.com' })
    else
      records = records.map((record) =>
        record.id === input.id ? changeAssignment(record, input, coach ? 'coach' : 'player') : record
      )
    await route.fulfill({ json: { ok: true } })
  })
  await page.goto('/#/assignments-coach')
  await page.getByRole('button', { name: 'Assign practice', exact: true }).click()
  await page.getByRole('textbox', { name: 'Player email', exact: true }).fill('player@example.com')
  await page
    .getByRole('combobox', { name: 'Practice', exact: true })
    .selectOption({ label: `${catalog.assignments[0].title} · 2026-11-04` })
  await page.getByRole('button', { name: 'Send assignment', exact: true }).click()
  await expect(page.getByRole('article', { name: catalog.assignments[0].title })).toBeVisible()
  await page.getByRole('link', { name: 'Practice', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Accept assignment', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start practice', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Accept assignment', exact: true }).click()
  await page.getByRole('button', { name: 'Start practice', exact: true }).click()
  await page.getByRole('button', { name: 'Quit practice', exact: true }).click()
  await page.getByRole('button', { name: 'Save and leave', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Session saved', exact: true })).toBeVisible()
  expect(requests.filter((r) => r.action === 'submit')).toHaveLength(0)
  await page
    .getByRole('textbox', { name: 'Note to coach (optional)', exact: true })
    .fill('Synthetic partial session — no athletic work performed.')
  await page.getByRole('button', { name: 'Send to coach', exact: true }).click()
  await expect(page.getByText('Connection interrupted. Try again.', { exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Note to coach (optional)', exact: true })).toHaveValue(
    'Synthetic partial session — no athletic work performed.'
  )
  await page.getByRole('button', { name: 'Send to coach', exact: true }).click()
  await expect(page.getByText('Sent to coach', { exact: true })).toBeVisible()
  expect(records[0].result.rows.filter((r) => r.status === 'done')).toHaveLength(0)
  await page.goto('/#/assignments-coach')
  await page
    .getByRole('textbox', { name: 'Feedback (optional)', exact: true })
    .fill('Keep the touches close before adding speed.')
  await page.getByRole('button', { name: 'Send feedback', exact: true }).click()
  await expect(page.getByText('Keep the touches close before adding speed.', { exact: true })).toBeVisible()
  await capture(page, testInfo, 'coach-player-result')
  await page.getByRole('button', { name: 'Assign again', exact: true }).click()
  await page.getByRole('button', { name: 'Send assignment', exact: true }).click()
  await expect.poll(() => records.length).toBe(2)
  await page.goto('/#/today')
  await page.getByRole('button', { name: 'Accept assignment', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start practice', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send to coach', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Previous sessions · 1', exact: true }).click()
  await expect(
    page
      .getByRole('region', { name: 'Coach assignments', exact: true })
      .getByText('Keep the touches close before adding speed.', { exact: true })
  ).toBeVisible()
  await noHorizontalOverflow(page)
  await expect(page.locator('[data-motion-snapshot], .qt-content-enter')).toHaveCount(0)
  await capture(page, testInfo, 'practice-first-feedback-journal')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Start practice', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send to coach', exact: true })).toHaveCount(0)
})
