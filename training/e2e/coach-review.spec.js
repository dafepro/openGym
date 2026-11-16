import { test, expect, capture, noHorizontalOverflow } from './fixtures.js'
import { reviewJob } from '../fixtures/coach-review.js'
import { compilePractice } from '../coach/compiler.js'

async function desk(page, canReview = true) {
  let job = { ...structuredClone(reviewJob), reviewPractice: compilePractice(reviewJob).assignment }
  const mutations = []
  let reject = false
  await page.route('https://www.youtube-nocookie.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<p>Synthetic demonstration</p>' })
  )
  await page.route('https://www.youtube.com/iframe_api', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `
    window.YT = { Player: class {
      constructor(frame, options) { this.frame = frame; this.events = options.events; this.state = 2; this.time = 0; setTimeout(() => this.events.onReady(), 20); }
      getIframe() { return this.frame } getCurrentTime() { return this.time } getDuration() { return 90 } getPlayerState() { return this.state }
      mute() {} unMute() {} getPlaybackRate() { return 1 } setPlaybackRate() {}
      playVideo() { this.state = 1; this.events.onStateChange({ data: 1 }); } pauseVideo() { this.state = 2; this.events.onStateChange({ data: 2 }); }
      seekTo(value) { this.time = value; } destroy() { this.frame.remove(); }
    }}; window.onYouTubeIframeAPIReady();
  `
    })
  )
  await page.route('**/api/coach/config', (route) =>
    route.fulfill({ json: { configured: true, paused: false, channels: { email: false, sms: false } } })
  )
  await page.route('**/api/coach/requests', async (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({ json: { requests: [job], coach: { email: 'coach@example.org', canReview } } })
    const input = route.request().postDataJSON()
    mutations.push(input)
    if (reject) return route.fulfill({ status: 409, json: { error: 'The service could not save this review.' } })
    if (input.action === 'targets') {
      job.plan.drills = job.plan.drills.map((drill, index) => ({ ...drill, ...input.targets[index] }))
      job.headSha = 'e'.repeat(40)
      job.reviewPractice = compilePractice(job).assignment
    } else job = { ...job, status: input.action === 'approve' ? 'publishing' : 'retrying_revision' }
    return route.fulfill({ json: job })
  })
  await page.getByRole('link', { name: 'Coach’s desk', exact: true }).click()
  await page.getByRole('button', { name: 'Review practice', exact: true }).click()
  return {
    mutations,
    get job() {
      return job
    },
    fail(value) {
      reject = value
    }
  }
}

test('coach previews the player view, edits quantities and approves the newly reviewed version', async ({
  page
}, testInfo) => {
  const state = await desk(page)
  const review = page.getByRole('dialog', { name: reviewJob.plan.title, exact: true })
  await expect(review).toHaveCSS('opacity', '1')
  await capture(page, testInfo, 'coach-review-editor')
  await expect(review.getByRole('button', { name: 'Approve for publishing' })).toBeDisabled()
  await review.getByRole('button', { name: 'Preview as player' }).click()
  const preview = page.getByRole('dialog', { name: 'Player preview', exact: true })
  await expect(preview.getByRole('heading', { name: reviewJob.plan.title })).toBeVisible()
  await expect(preview.getByRole('button', { name: 'Start practice', exact: true })).toBeDisabled()
  await preview.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await expect(preview).toHaveCount(0)
  await review.getByRole('button', { name: 'Review video: Synthetic cone touches', exact: true }).click()
  const video = page.getByRole('dialog', { name: 'Synthetic cone touches', exact: true })
  await expect(video.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/QKz7fDjPnvg/)
  await video.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await expect(video).toHaveCount(0)
  await expect(page.locator('iframe')).toHaveCount(0)
  await review.getByLabel('Sets', { exact: true }).fill('3')
  await review.getByLabel('Rest seconds', { exact: true }).fill('45')
  await expect(review.getByRole('button', { name: 'Save target changes' })).toBeEnabled()
  await expect(review.getByRole('button', { name: 'Approve for publishing' })).toBeDisabled()
  await review.getByRole('button', { name: 'Save target changes' }).click()
  await expect(review).toHaveCount(0)
  expect(state.mutations[0]).toMatchObject({
    action: 'targets',
    headSha: reviewJob.headSha,
    targets: [{ sets: 3, restSec: 45 }]
  })
  await page.getByRole('button', { name: 'Review practice', exact: true }).click()
  await expect(review.getByLabel('Sets', { exact: true })).toHaveValue('3')
  await review.getByRole('checkbox').check()
  await noHorizontalOverflow(page)
  await capture(page, testInfo, 'coach-review-ready-to-approve')
  await review.getByRole('button', { name: 'Approve for publishing' }).click()
  expect(state.mutations.at(-1)).toMatchObject({ action: 'approve', headSha: 'e'.repeat(40) })
  await expect(page.getByText('Publishing practice', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open practice', exact: true })).toHaveCount(0)
  await page.getByText('Technical details', { exact: true }).click()
  await expect(page.getByRole('link', { name: 'Open pull request' })).toBeVisible()
})

test('failed revision preserves feedback and prevents accidental approval', async ({ page }) => {
  const state = await desk(page)
  state.fail(true)
  const review = page.getByRole('dialog', { name: reviewJob.plan.title, exact: true })
  await review.getByLabel('Revision feedback').fill('Use a wall for the passing drill.')
  await expect(review.getByRole('checkbox')).toBeDisabled()
  await review.getByRole('button', { name: 'Request changes' }).click()
  await expect(review.getByText('Review not saved', { exact: true })).toBeVisible()
  await expect(review.getByLabel('Revision feedback')).toHaveValue('Use a wall for the passing drill.')
  state.fail(false)
  await review.getByRole('button', { name: 'Request changes' }).click()
  await expect(review).toHaveCount(0)
  expect(state.mutations.at(-1)).toMatchObject({
    action: 'revise',
    feedback: 'Use a wall for the passing drill.',
    headSha: reviewJob.headSha
  })
})

test('a newer version cannot be approved from an older open editor', async ({ page }) => {
  const state = await desk(page)
  state.job.headSha = 'e'.repeat(40)
  await expect(page.getByText('A newer version is available', { exact: true })).toBeVisible({ timeout: 12000 })
  const review = page.getByRole('dialog', { name: reviewJob.plan.title, exact: true })
  await expect(review.getByRole('checkbox')).toBeDisabled()
  await review.getByRole('button', { name: 'Reload review and discard target edits' }).click()
  await review.getByRole('checkbox').check()
  await review.getByRole('button', { name: 'Approve for publishing' }).click()
  expect(state.mutations.at(-1).headSha).toBe('e'.repeat(40))
})

test('other authorized coaches can preview but cannot publish', async ({ page }) => {
  const state = await desk(page, false)
  const review = page.getByRole('dialog', { name: reviewJob.plan.title, exact: true })
  await expect(review.getByRole('button', { name: 'Preview as player' })).toBeEnabled()
  await expect(review.getByLabel('Sets', { exact: true })).toBeDisabled()
  await expect(review.getByRole('button', { name: 'Approve for publishing' })).toBeDisabled()
  expect(state.mutations).toHaveLength(0)
})
