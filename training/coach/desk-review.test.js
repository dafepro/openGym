import { beforeEach, describe, expect, it, vi } from 'vitest'
import worker, { CoachRequests } from './worker.js'
import { DESK_REVIEWER, deskApproved, editedPlan, reviewChange } from './desk-review.js'
import { approvalDecision, REQUIRED_CHECKS, PRACTICE_PATH, RELEASE_BRANCH, REVIEWER_ID } from './github.js'
import { compilePractice } from './compiler.js'
import { coachProfile } from './auth.js'
import { reviewJob } from '../fixtures/coach-review.js'
vi.mock('./auth.js', async (original) => ({ ...(await original()), coachProfile: vi.fn() }))
const reviewer = { email: DESK_REVIEWER }
const input = (action, extra = {}) => ({ action, headSha: reviewJob.headSha, reviewer, ...extra })
const pr = {
  state: 'open',
  user: { type: 'Bot', login: 'quicktrack-coach-publisher[bot]' },
  base: { ref: RELEASE_BRANCH, sha: 'b'.repeat(40) },
  head: { sha: reviewJob.headSha, ref: `coach-practice-${reviewJob.id}`, repo: { full_name: 'dafepro/openGym' } }
}
const files = [{ filename: PRACTICE_PATH, status: 'modified' }]
const checks = REQUIRED_CHECKS.map((name) => ({
  name,
  app: { slug: 'github-actions' },
  status: 'completed',
  conclusion: 'success'
}))
function setup(overrides = {}) {
  const records = new Map([[`job:${reviewJob.id}`, structuredClone(reviewJob)]])
  const storage = {
    get: async (key) => structuredClone(records.get(key)),
    put: async (key, value) => records.set(key, structuredClone(value)),
    list: async () => new Map(records),
    setAlarm: vi.fn(),
    transaction: async (fn) => fn(storage)
  }
  const env = {
    APP_ORIGIN: 'https://train.quicktrack.cc',
    COACH_GITHUB_TOKEN: 'synthetic',
    COACH_GITHUB_REPOSITORY: 'dafepro/openGym',
    TEST_FETCH: vi.fn(async (url, options = {}) => {
      expect(options.method || 'GET').toBe('GET')
      if (url.endsWith('/pulls/123')) return Response.json(overrides.pr || pr)
      if (url.includes('/pulls/123/files')) return Response.json(overrides.files || files)
      if (url.includes('/contents/')) {
        const data = {
          schemaVersion: 1,
          practices: url.endsWith(reviewJob.headSha) ? [compilePractice(overrides.job || reviewJob)] : []
        }
        return Response.json({
          encoding: 'base64',
          size: 1000,
          content: Buffer.from(JSON.stringify(data)).toString('base64')
        })
      }
      throw new Error(`Unexpected transport: ${url}`)
    }),
    ...overrides.env
  }
  const ctx = { storage, blockConcurrencyWhile: (fn) => fn() }
  const queue = new CoachRequests(ctx, env)
  const post = (data, id = reviewJob.id) =>
    queue.fetch(new Request(`https://internal/review/${id}`, { method: 'POST', body: JSON.stringify(data) }))
  return { records, storage, ctx, env, queue, post }
}
beforeEach(() => vi.clearAllMocks())
describe('coach desk review', () => {
  it('records an exact-head approval and retains all publication checks and GitHub vetoes', async () => {
    const { post, storage } = setup()
    expect((await post(input('approve'))).status).toBe(202)
    const saved = await storage.get(`job:${reviewJob.id}`)
    expect(deskApproved(JSON.parse(JSON.stringify(saved)))).toBe(true)
    expect(deskApproved({ ...saved, headSha: 'e'.repeat(40) })).toBe(false)
    expect(deskApproved({ ...saved, owner: 'other' })).toBe(false)
    expect(approvalDecision(pr, [], checks, files, saved, undefined, false, deskApproved(saved))).toBe(true)
    expect(approvalDecision(pr, [], [], files, saved, undefined, false, true)).toBe(false)
    expect(approvalDecision(pr, [], checks, [...files, { filename: 'app.js' }], saved, undefined, false, true)).toBe(
      false
    )
    expect(
      approvalDecision(
        pr,
        [{ id: 1, user: { id: REVIEWER_ID }, state: 'CHANGES_REQUESTED' }],
        checks,
        files,
        saved,
        undefined,
        false,
        true
      )
    ).toBe(false)
  })
  it('persists edits without research, removes approval and requires a new review after restart', async () => {
    const { post, storage, ctx, env } = setup()
    const target = { sets: 3, restSec: 45 }
    const response = await post(input('targets', { targets: [target] }))
    expect(response.status).toBe(202)
    const job = await storage.get(`job:${reviewJob.id}`)
    expect(job).toMatchObject({ status: 'creating_pr', revisions: 1 })
    expect(job.plan.drills[0]).toMatchObject(target)
    expect(job.plan.drills[0].sources).toEqual(reviewJob.plan.drills[0].sources)
    expect(deskApproved(job)).toBe(false)
    const reopened = await new CoachRequests(ctx, env).fetch(new Request('https://internal/requests'))
    expect((await reopened.json()).requests[0].reviewPractice.drills[0].restSec).toBe(45)
  })
  it('checkpoints bounded feedback and does not call research during submission', async () => {
    const { post, storage } = setup()
    expect((await post(input('revise', { feedback: 'Use a wall demonstration instead.' }))).status).toBe(202)
    expect(await storage.get(`job:${reviewJob.id}`)).toMatchObject({
      status: 'retrying_revision',
      revisionFeedback: 'Use a wall demonstration instead.',
      revisions: 1
    })
    expect((await post(input('revise', { feedback: 'Duplicate retry' }))).status).toBe(409)
  })
  it('rejects stale heads, wrong owners, modified remote content and unexpected files without writing', async () => {
    for (const overrides of [
      { pr: { ...pr, head: { ...pr.head, sha: 'e'.repeat(40) } } },
      { files: [{ filename: 'app.js', status: 'modified' }] },
      { job: { ...reviewJob, plan: { ...reviewJob.plan, title: 'Unexpected title' } } }
    ]) {
      const { post, storage } = setup(overrides)
      expect((await post(input('approve'))).status).toBe(409)
      expect(await storage.get(`job:${reviewJob.id}`)).toEqual(reviewJob)
    }
    const { post } = setup()
    expect((await post(input('approve', { headSha: 'e'.repeat(40) }))).status).toBe(409)
    expect((await post(input('approve', { reviewer: { email: 'other@example.org' } }))).status).toBe(409)
    expect((await post(input('approve'), crypto.randomUUID())).status).toBe(404)
  })
  it('does not race an active scheduler or request paid research while paused', async () => {
    const active = setup()
    active.queue.running = true
    expect((await active.post(input('approve'))).status).toBe(409)
    const paused = setup({ env: { COACH_PAUSED: () => true } })
    expect((await paused.post(input('revise', { feedback: 'Change it.' }))).status).toBe(409)
    expect((await paused.post(input('approve'))).status).toBe(202)
  })
  it('validates quantities without allowing title, source or video replacement', () => {
    for (const targets of [
      [{ sets: 0 }],
      [{ restSec: -1 }],
      [{ durationSec: 0 }],
      [{ sets: 2.5 }],
      [{ title: 'Injected' }],
      []
    ])
      expect(() => editedPlan(reviewJob.plan, targets)).toThrow()
    expect(() => reviewChange(reviewJob, input('revise', { feedback: '' }), reviewer)).toThrow()
    expect(() => reviewChange(reviewJob, input('targets', { targets: [{ sets: 2 }] }), reviewer)).toThrow()
    expect(() =>
      reviewChange({ ...reviewJob, revisions: 3 }, input('revise', { feedback: 'More' }), reviewer)
    ).toThrow()
  })
  it('derives review authority from the signed profile, not the posted reviewer', async () => {
    const forward = vi.fn()
    const env = {
      OPENAI_API_KEY: 'synthetic',
      OPENAI_MODEL: 'synthetic',
      COACH_GITHUB_TOKEN: 'synthetic',
      COACH_GITHUB_REPOSITORY: 'dafepro/openGym',
      COACH_ACCESS_ISSUER: 'https://example.cloudflareaccess.com',
      COACH_ACCESS_AUD: 'synthetic',
      APP_ORIGIN: 'https://train.quicktrack.cc',
      COACH_REQUESTS: { idFromName: (value) => value, get: () => ({ fetch: forward }) }
    }
    coachProfile.mockResolvedValue({ identity: 'signed-other', email: 'other@example.org' })
    const request = new Request(`${env.APP_ORIGIN}/api/coach/requests`, {
      method: 'POST',
      headers: { Origin: env.APP_ORIGIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input('approve'), reviewRequestId: reviewJob.id })
    })
    expect((await worker.fetch(request, env)).status).toBe(403)
    expect(forward).not.toHaveBeenCalled()
  })
})
