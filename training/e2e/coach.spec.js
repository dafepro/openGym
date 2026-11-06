import {
  test,
  expect,
  capture,
  noHorizontalOverflow,
  catalog,
} from './fixtures.js'
import { createPracticeCode } from '../src/domain/practice-code.js'
const brief =
  'Twenty minutes of close control, one ball and four cones. Both feet. Keep touches quick and close.'
const plan = {
  title: 'Close control, both feet',
  goal: 'Fast feet. Small, accurate touches.',
  overview: 'Build confidence with the ball.',
  drills: [
    {
      title: 'Two-cone touches',
      setup: 'One ball, two cones.',
      instructions: 'Move between the cones with small touches.',
      focus: 'Keep the ball close.',
      mode: 'time',
      sets: 3,
      reps: null,
      durationSec: 60,
      restSec: 30,
      side: 'each',
      tags: ['futbol:ball-control'],
      sources: [
        { title: 'Example coaching guide', url: 'https://example.org/soccer' },
      ],
    },
  ],
}
test('coach setup is honest while drafting remains available', async ({
  page,
}, testInfo) => {
  await page.route('**/api/coach/config', (route) =>
    route.fulfill({
      json: { configured: false, channels: { email: false, sms: false } },
    }),
  )
  await page.getByRole('link', { name: 'Coach’s desk', exact: true }).click()
  await expect(
    page.getByRole('heading', {
      name: 'Give practice a purpose.',
      exact: true,
    }),
  ).toBeVisible()
  const field = page.getByRole('textbox', {
    name: 'What should the player work on?',
    exact: true,
  })
  await field.fill(brief)
  await expect(
    page.getByRole('button', { name: 'Request a practice', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByText('Assistant setup is pending', { exact: true }),
  ).toBeVisible()
  await expect(field).toHaveAttribute('maxlength', '1000')
  await noHorizontalOverflow(page)
  await capture(page, testInfo, 'coach-pending-setup')
})
test('coach submits recipients and follows research into a reviewable proposal', async ({
  page,
}, testInfo) => {
  let requests = [],
    sent
  await page.route('**/api/coach/config', (route) =>
    route.fulfill({
      json: { configured: true, channels: { email: true, sms: true } },
    }),
  )
  await page.route('**/api/coach/requests', async (route) => {
    if (route.request().method() === 'POST') {
      sent = route.request().postDataJSON()
      requests = [
        {
          id: sent.id,
          brief: sent.brief,
          createdAt: Date.now(),
          recipientCount: 2,
          status: 'queued',
        },
      ]
      return route.fulfill({ status: 202, json: requests[0] })
    }
    return route.fulfill({ json: { requests } })
  })
  await page.getByRole('link', { name: 'Coach’s desk', exact: true }).click()
  await page
    .getByRole('textbox', {
      name: 'What should the player work on?',
      exact: true,
    })
    .fill(brief)
  await page
    .getByText('Notify players when it’s ready', { exact: true })
    .click()
  await page
    .getByRole('textbox', { name: 'Emails or phone numbers', exact: true })
    .fill('parent@example.org\n+1 555 123 4567')
  await page
    .getByRole('checkbox', {
      name: 'These players or guardians expect this practice notification.',
      exact: true,
    })
    .check()
  await page
    .getByRole('button', { name: 'Request a practice', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Your requests', exact: true }),
  ).toBeFocused()
  await expect(page.getByText('Queued', { exact: true })).toBeVisible()
  expect(sent.brief).toBe(brief)
  expect(Object.keys(sent).sort()).toEqual([
    'brief',
    'consent',
    'id',
    'recipients',
  ])
  requests = [
    {
      ...requests[0],
      status: 'submitted',
      plan,
      issueUrl: 'https://github.com/dafepro/openGym/issues/123',
    },
  ]
  await expect(
    page.getByRole('heading', { name: plan.title, exact: true }),
  ).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(plan.goal, { exact: true })).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Review proposal', exact: false }),
  ).toHaveAttribute('href', requests[0].issueUrl)
  await expect(
    page.getByText('2 recipients · notified after publication', {
      exact: true,
    }),
  ).toBeVisible()
  await page.getByText('1 proposed drill', { exact: true }).click()
  await expect(
    page.getByRole('link', { name: 'Example coaching guide', exact: false }),
  ).toBeVisible()
  await noHorizontalOverflow(page)
  await capture(page, testInfo, 'coach-review-proposal')
})
test('star is fully tappable, saved cards stay closed, and profile lives in the header', async ({
  page,
}, testInfo) => {
  const star = page.getByRole('button', {
      name: 'Save assigned practice',
      exact: true,
    }),
    box = await star.boundingBox()
  const card = await page
    .getByRole('region', { name: 'Complete practice', exact: true })
    .boundingBox()
  expect(box.x).toBeGreaterThanOrEqual(card.x)
  expect(box.y).toBeGreaterThanOrEqual(card.y)
  expect(box.x + box.width).toBeLessThanOrEqual(card.x + card.width)
  expect(
    await star.evaluate((el) => {
      const r = el.getBoundingClientRect()
      return el.contains(
        document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
      )
    }),
  ).toBe(true)
  const profile = page.getByRole('button', { name: 'Me', exact: true }),
    profileBox = await profile.boundingBox()
  expect(profileBox.y).toBeLessThan(90)
  expect(profileBox.x + profileBox.width).toBeLessThanOrEqual(
    page.viewportSize().width,
  )
  await star.click()
  await expect(page.locator('.pb-practice-choice')).toHaveAttribute(
    'aria-expanded',
    'false',
  )
  await expect(page.locator('.qt-navigation--playbook')).toHaveCount(0)
  await profile.click()
  await expect(
    page.getByRole('heading', { name: 'Me', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Practice', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'My practices', exact: true }),
  ).toBeVisible()
  await noHorizontalOverflow(page)
  await capture(page, testInfo, 'saved-and-profile')
})

test('coach draft survives navigation and reload, and can be cleared', async ({
  page,
}) => {
  await page.route('**/api/coach/config', (route) =>
    route.fulfill({
      json: { configured: false, channels: { email: false, sms: false } },
    }),
  )
  await page.getByRole('link', { name: 'Coach’s desk', exact: true }).click()
  const field = page.getByRole('textbox', {
    name: 'What should the player work on?',
    exact: true,
  })
  await field.fill(brief)
  await page.getByRole('button', { name: 'Practice', exact: true }).click()
  await page.getByRole('link', { name: 'Coach’s desk', exact: true }).click()
  await expect(field).toHaveValue(brief)
  await page.reload()
  await expect(field).toHaveValue(brief)
  await page.getByRole('button', { name: 'Clear draft', exact: true }).click()
  await page.reload()
  await expect(field).toHaveValue('')
})

test('a rejected request can be revised without silently reusing notification recipients', async ({
  page,
}) => {
  const job = {
    id: '12345678-1234-4234-8234-123456789abc',
    brief,
    createdAt: Date.now(),
    status: 'rejected',
    reason: 'Add a clear soccer training goal.',
    recipientCount: 2,
  }
  await page.route('**/api/coach/config', (route) =>
    route.fulfill({
      json: { configured: true, channels: { email: true, sms: true } },
    }),
  )
  await page.route('**/api/coach/requests', (route) =>
    route.fulfill({ json: { requests: [job] } }),
  )
  await page.getByRole('link', { name: 'Coach’s desk', exact: true }).click()
  await page.getByRole('button', { name: 'Revise brief', exact: true }).click()
  const field = page.getByRole('textbox', {
    name: 'What should the player work on?',
    exact: true,
  })
  await expect(field).toBeFocused()
  await expect(field).toHaveValue(brief)
  await page
    .getByText('Notify players when it’s ready', { exact: true })
    .click()
  await expect(
    page.getByRole('textbox', { name: 'Emails or phone numbers', exact: true }),
  ).toHaveValue('')
  await expect(page.getByRole('checkbox')).not.toBeChecked()
  await expect(
    page.getByText('2 recipients · notified after publication', {
      exact: true,
    }),
  ).toHaveCount(0)
})

test('published coach review opens the final practice with its reviewed title', async ({
  page,
}) => {
  const published = {
    ...catalog.assignments[0],
    title: 'Reviewed close control practice',
  }
  const pass = await createPracticeCode(published, 'http://127.0.0.1:4188')
  const job = {
    id: 'published-example',
    brief,
    createdAt: Date.now(),
    status: 'notified',
    plan,
    publishedTitle: published.title,
    practiceUrl: pass.link,
    recipientCount: 1,
    notifications: [{ channel: 'email', status: 'accepted' }],
  }
  await page.route('**/api/coach/config', (route) =>
    route.fulfill({
      json: { configured: true, channels: { email: true, sms: false } },
    }),
  )
  await page.route('**/api/coach/requests', (route) =>
    route.fulfill({ json: { requests: [job] } }),
  )
  await page.getByRole('link', { name: 'Coach’s desk', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: published.title, exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText('Notifications accepted for sending.', { exact: true }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Open practice', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: published.title, exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Start practice', exact: true }),
  ).toBeVisible()
})
