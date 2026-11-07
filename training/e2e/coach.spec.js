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
      demonstrationUrl: 'https://www.youtube.com/watch?v=QKz7fDjPnvg',
      sources: [
        { title: 'Example coaching guide', url: 'https://example.org/soccer' },
      ],
    },
  ],
}
test('coach setup hides the form until the protected service is ready', async ({
  page,
}, testInfo) => {
  await page.route('**/api/coach/config', (route) =>
    route.fulfill({
      json: { configured: false, channels: {} },
    }),
  )
  await page.getByRole('link', { name: 'Coach’s desk', exact: true }).click()
  await expect(
    page.getByRole('heading', {
      name: 'Assistant setup is pending',
    }),
  ).toBeVisible()
  await expect(page.getByRole('textbox')).toHaveCount(0)
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
          recipients: sent.recipients,
          submitterEmail: 'coach@example.org',
          status: 'queued',
        },
      ]
      return route.fulfill({ status: 202, json: requests[0] })
    }
    return route.fulfill({
      json: { requests, coach: { email: 'coach@example.org' } },
    })
  })
  await page.getByRole('link', { name: 'Coach’s desk', exact: true }).click()
  await page
    .getByRole('textbox', {
      name: 'What should the player work on?',
      exact: true,
    })
    .fill(brief)
  await page
    .getByRole('textbox', { name: 'Email address', exact: true })
    .fill('parent@example.org')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.getByRole('button', { name: 'Text', exact: true }).click()
  // An unadded final contact is included on submit, so it cannot be silently lost.
  await page
    .getByRole('textbox', { name: 'Phone number', exact: true })
    .fill('5551234567')
  await expect(
    page.getByRole('button', { name: 'Text', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.waitForTimeout(220) // Capture the settled segmented-control transition.
  await capture(page, testInfo, 'coach-recipient-form')
  await page
    .getByRole('button', { name: 'Create practice', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Your requests', exact: true }),
  ).toBeFocused()
  await expect(page.getByText('Queued', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('textbox', {
      name: 'What should the player work on?',
      exact: true,
    }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'New practice', exact: true }),
  ).toBeVisible()
  expect(sent.brief).toBe(brief)
  expect(Object.keys(sent).sort()).toEqual(['brief', 'id', 'recipients'])
  requests = [
    {
      ...requests[0],
      status: 'submitted',
      plan,
      prUrl: 'https://github.com/dafepro/openGym/pull/123',
    },
  ]
  await expect(
    page.getByRole('heading', { name: plan.title, exact: true }),
  ).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(plan.goal, { exact: true })).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Open pull request', exact: false }),
  ).toHaveAttribute('href', requests[0].prUrl)
  await expect(page.getByText('2 recipients · private', { exact: true })).toBeVisible()
  await page.getByText('1 drill', { exact: true }).click()
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

test('publication enables manual texting and alerts the coach once', async ({
  page,
  context,
}) => {
  const pass = await createPracticeCode(
    catalog.assignments[0],
    page.url(),
    catalog,
  )
  const job = {
    id: '12345678-1234-4234-8234-123456789abc',
    brief,
    plan,
    createdAt: Date.now(),
    status: 'publishing',
    recipientCount: 1,
    recipients: [{ channel: 'sms', address: '+12025550146', name: 'Guardian' }],
  }
  await page.addInitScript(() => {
    window.coachTest = { alerts: [], shares: [], copies: [] }
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: class {
        static permission = sessionStorage.getItem('test-alert-permission') || 'default'
        static async requestPermission() {
          sessionStorage.setItem('test-alert-permission', 'granted')
          this.permission = 'granted'
          return this.permission
        }
        constructor(title, options) {
          window.coachTest.alerts.push({ title, ...options })
        }
      },
    })
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (draft) => {
        window.coachTest.shares.push(draft)
      },
    })
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: () => true,
    })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value) => {
          window.coachTest.copies.push(value)
        },
      },
    })
  })
  await context.route('**/api/coach/config', (route) =>
    route.fulfill({
      json: { configured: true, channels: { email: false, sms: false } },
    }),
  )
  await context.route('**/api/coach/requests', (route) =>
    route.fulfill({
      json: { requests: [job], coach: { email: 'coach@example.org' } },
    }),
  )
  await page.goto('/#/coach')
  await page.reload()
  await expect(
    page.getByText('Publishing practice', { exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Text practice' })).toHaveCount(
    0,
  )
  await page.getByRole('button', { name: 'Browser alerts' }).click()
  await expect(
    page.getByRole('button', { name: 'Browser alerts' }),
  ).toHaveAttribute('aria-pressed', 'true')

  job.status = 'notification_setup'
  job.practiceUrl = pass.link
  await page.evaluate(() =>
    document.dispatchEvent(new Event('visibilitychange')),
  )
  const textPractice = page.getByRole('button', { name: 'Text practice' })
  await expect(textPractice).toBeVisible({ timeout: 12000 })
  await expect(
    page.getByText('Practice ready. Share the link from the request card.'),
  ).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => window.coachTest.alerts.length))
    .toBe(1)
  await textPractice.click()
  await expect
    .poll(() => page.evaluate(() => window.coachTest.shares))
    .toEqual([{ text: 'Your soccer practice is ready.', url: pass.link }])
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined,
    }),
  )
  await textPractice.click()
  await expect(page.getByText('Link copied.', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Open Messages for Guardian' }),
  ).toHaveAttribute('href', 'sms:+12025550146')
  expect(await page.evaluate(() => window.coachTest.copies)).toEqual([
    pass.link,
  ])
  await noHorizontalOverflow(page)

  await page.reload()
  await expect(textPractice).toBeVisible()
  expect(await page.evaluate(() => window.coachTest.alerts)).toEqual([])
})

test('coach draft survives navigation and reload, and can be cleared', async ({
  page,
}) => {
  await page.route('**/api/coach/config', (route) =>
    route.fulfill({
      json: { configured: true, channels: { email: false, sms: false } },
    }),
  )
  await page.route('**/api/coach/requests', (route) =>
    route.fulfill({
      json: { requests: [], coach: { email: 'coach@example.org' } },
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
  await expect(
    page.getByRole('textbox', { name: 'Email address', exact: true }),
  ).toHaveValue('')
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await expect(
    page.getByText('2 recipients · link available after publication', {
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

test('coach Google gate preserves draft and paused service clearly disables paid submission', async ({
  page,
}, testInfo) => {
  await page.route('**/api/coach/config', (route) =>
    route.fulfill({
      json: {
        configured: true,
        auth: 'google',
        paused: true,
        channels: { email: false, sms: false },
      },
    }),
  )
  await page.route('**/api/coach/requests', (route) =>
    route.fulfill({ status: 401, json: { error: 'Sign in.' } }),
  )
  await page.getByRole('link', { name: 'Coach’s desk', exact: true }).click()
  const signIn = page.getByRole('link', { name: 'Continue with Google' })
  await expect(signIn).toHaveAttribute('href', '/api/coach/login')
  await expect(page.getByRole('textbox')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Create practice', exact: true }),
  ).toHaveCount(0)
  await page.reload()
  await expect(signIn).toBeVisible()
  await expect(page.getByRole('textbox')).toHaveCount(0)
  await capture(page, testInfo, 'coach-google-gate')
})

test('recipient entry handles batch paste, duplicates, mistakes and switching channels without losing a typed contact', async ({
  page,
}, testInfo) => {
  let sent
  await page.route('**/api/coach/config', (route) =>
    route.fulfill({
      json: { configured: true, channels: { email: false, sms: false } },
    }),
  )
  await page.route('**/api/coach/requests', (route) => {
    if (route.request().method() === 'POST') {
      sent = route.request().postDataJSON()
      return route.fulfill({
        status: 202,
        json: {
          ...sent,
          status: 'queued',
          createdAt: Date.now(),
          recipientCount: sent.recipients.length,
        },
      })
    }
    return route.fulfill({
      json: { requests: [], coach: { email: 'coach@example.org' } },
    })
  })
  await page.getByRole('link', { name: 'Coach’s desk', exact: true }).click()
  await page
    .getByRole('textbox', {
      name: 'What should the player work on?',
      exact: true,
    })
    .fill(brief)
  const address = page.getByRole('textbox', {
    name: 'Email address',
    exact: true,
  })
  await address.fill('bad address')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Enter an email address')
  await address.fill('parent@example.org')
  await page.getByRole('button', { name: 'Text', exact: true }).click()
  await expect(
    page.getByRole('button', {
      name: 'Remove parent@example.org',
      exact: true,
    }),
  ).toBeVisible()
  const phone = page.getByRole('textbox', { name: 'Phone number', exact: true })
  await phone.fill('2025550146')
  await page.getByRole('button', { name: 'Email', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Remove +12025550146', exact: true }),
  ).toBeVisible()
  await address.evaluate((element) => {
    const data = new DataTransfer()
    data.setData(
      'text/plain',
      'parent@example.org; second@example.org\n+44 20 7946 0958',
    )
    element.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    )
  })
  await expect(page.locator('.pb-recipient-list li')).toHaveCount(4)
  await page.getByRole('button', { name: 'Add me', exact: true }).click()
  await page.getByRole('button', { name: 'Add me', exact: true }).click()
  await expect(page.locator('.pb-recipient-list li')).toHaveCount(5)
  await page
    .getByRole('button', { name: 'Remove second@example.org', exact: true })
    .click()
  await expect(page.locator('.pb-recipient-list li')).toHaveCount(4)
  await expect(
    page.getByText(/Email isn’t connected/),
  ).toBeVisible()
  await noHorizontalOverflow(page)
  await capture(page, testInfo, 'coach-contacts-private')
  await page
    .getByRole('button', { name: 'Create practice', exact: true })
    .click()
  await expect.poll(() => sent?.recipients.length).toBe(4)
  expect(sent).not.toHaveProperty('consent')
})

test('coach access check never flashes the form and returning to an existing request keeps it central', async ({
  page,
}) => {
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  await page.route('**/api/coach/config', (route) =>
    route.fulfill({ json: { configured: true, channels: {} } }),
  )
  await page.route('**/api/coach/requests', async (route) => {
    await gate
    return route.fulfill({
      json: {
        requests: [
          {
            id: 'existing',
            brief,
            plan,
            status: 'submitted',
            createdAt: Date.now(),
            recipientCount: 0,
            prUrl: 'https://github.com/dafepro/openGym/pull/123',
          },
        ],
        coach: { email: 'coach@example.org' },
      },
    })
  })
  await page.getByRole('link', { name: 'Coach’s desk', exact: true }).click()
  await expect(
    page.getByText('Checking coach access…', { exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('textbox')).toHaveCount(0)
  await expect(
    page.getByRole('link', { name: 'Continue with Google' }),
  ).toHaveCount(0)
  release()
  await expect(
    page.getByRole('heading', { name: plan.title, exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('textbox')).toHaveCount(0)
  await page.getByRole('button', { name: 'New practice', exact: true }).click()
  const field = page.getByRole('textbox', {
    name: 'What should the player work on?',
    exact: true,
  })
  await expect(field).toBeFocused()
  await field.fill(
    'An unfinished practice brief about fast, close soccer touches.',
  )
  await page.getByRole('button', { name: 'Close draft', exact: true }).click()
  await expect(page.getByRole('textbox')).toHaveCount(0)
  await expect(page.getByText('Draft saved', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /New practice/ }).click()
  await expect(field).toHaveValue(
    'An unfinished practice brief about fast, close soccer touches.',
  )
})
