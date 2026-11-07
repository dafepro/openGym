import { importApprovedIssue } from './approved-issues.js'
import { writePracticePR, inspectPracticePR, github } from './github.js'
import { publishedPractice } from './publication.js'
import { json, digest, readLimited } from '../worker/http.js'
import { coachProfile, verifyReadySignature } from './auth.js'
import { researchPractice } from './agent.js'
import {
  notificationChannels,
  sendReady,
  smsReadyMessage,
  textSender,
} from './notifications.js'
import { validateCoachRequest } from '../src/domain/coach-request.js'
import { readPracticeCode } from '../src/domain/practice-code.js'

const PREFIX = '/api/coach'
const uuid = (value) =>
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
    value || '',
  )
const publicJob = (job) => ({
  id: job.id,
  brief: job.brief,
  status: job.status,
  createdAt: job.createdAt,
  reason: job.reason,
  plan: job.plan,
  publishedTitle: job.publishedTitle,
  issueUrl: job.issueUrl,
  prUrl: job.prUrl,
  recipients: job.recipients || [],
  submitterEmail: job.submitterEmail,
  practiceUrl: job.practiceUrl,
  recipientCount: job.recipients?.length || job.recipientCount || 0,
  notifications: job.delivery?.map(({ channel, status }) => ({
    channel,
    status,
  })),
})
const configured = (env) =>
  !!(
    env.OPENAI_API_KEY &&
    env.OPENAI_MODEL &&
    (env.COACH_GITHUB_TOKEN || env.COACH_GITHUB_ACCESS_TOKEN) &&
    /^dafepro\/[A-Za-z0-9_.-]+$/.test(env.COACH_GITHUB_REPOSITORY || '') &&
    env.COACH_ACCESS_ISSUER &&
    env.COACH_ACCESS_AUD &&
    env.COACH_REQUESTS
  )
const body = async (request) =>
  JSON.parse(new TextDecoder().decode(await readLimited(request.body, 16000)))

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.origin !== env.APP_ORIGIN || url.search)
      return json({ error: 'not_found' }, 404)
    try {
      if (url.pathname === `${PREFIX}/config` && request.method === 'GET')
        return json({
          configured: configured(env),
          channels: notificationChannels(env),
          smsSender: textSender(env),
          build: env.APP_SOURCE_SHA || 'local',
          auth: 'google',
          paused: !!env.COACH_PAUSED?.(),
        })
      if (!configured(env))
        return json({ error: 'Coach requests are not configured yet.' }, 503)
      const ready = url.pathname.match(
        /^\/api\/coach\/ready\/([a-f0-9]{64})\/([a-f0-9-]{36})$/,
      )
      if (ready && request.method === 'POST') {
        const text = new TextDecoder().decode(
          await readLimited(request.body, 16000),
        )
        if (
          !uuid(ready[2]) ||
          !(await verifyReadySignature(request, text, env))
        )
          return json({ error: 'unauthorized' }, 401)
        return await env.COACH_REQUESTS.get(
          env.COACH_REQUESTS.idFromName(ready[1]),
        ).fetch(
          new Request(`https://internal/ready/${ready[2]}`, {
            method: 'POST',
            body: text,
          }),
        )
      }
      const profile = await coachProfile(request, env)
      if (!profile)
        return json({ error: 'Sign in as a coach to request a practice.' }, 401)
      if (url.pathname === `${PREFIX}/login` && request.method === 'GET')
        return Response.redirect(`${env.APP_ORIGIN}/#/coach`, 303)
      if (
        request.method === 'POST' &&
        (request.headers.get('Origin') !== env.APP_ORIGIN ||
          request.headers.get('Content-Type')?.split(';')[0] !==
            'application/json' ||
          request.headers.get('Sec-Fetch-Site') === 'cross-site')
      )
        return json({ error: 'Invalid request origin.' }, 403)
      const owner = await digest(profile.identity)
      const stub = env.COACH_REQUESTS.get(env.COACH_REQUESTS.idFromName(owner))
      if (url.pathname === `${PREFIX}/requests` && request.method === 'GET') {
        await stub.fetch(
          new Request('https://internal/profile', {
            method: 'POST',
            body: JSON.stringify({ owner, email: profile.email }),
          }),
        )
        const response = await stub.fetch('https://internal/requests')
        return json({
          ...(await response.json()),
          coach: { email: profile.email },
        })
      }
      if (url.pathname === `${PREFIX}/requests` && request.method === 'POST') {
        let input
        try {
          input = validateCoachRequest(await body(request))
        } catch (error) {
          return json({ error: error.message }, 400)
        }
        if (!uuid(input.id))
          return json({ error: 'Invalid request identifier.' }, 400)
        return await stub.fetch(
          new Request('https://internal/requests', {
            method: 'POST',
            body: JSON.stringify({
              ...input,
              owner,
              submitterEmail: profile.email,
            }),
          }),
        )
      }
      return json({ error: 'not_found' }, 404)
    } catch (error) {
      if (error.status === 429) return json({ error: error.message }, 429)
      return json(
        { error: 'The coaching service is temporarily unavailable.' },
        503,
      )
    }
  },
}

// One private queue per authenticated coach; requests survive browser closures.
// External side effects are checkpointed. Ambiguous results require review,
// rather than silently charging again or sending duplicate messages.
export class CoachRequests {
  constructor(ctx, env) {
    this.ctx = ctx
    this.env = env
    this.running = false
  }
  async fetch(request) {
    const path = new URL(request.url).pathname
    if (path === '/profile' && request.method === 'POST') {
      const profile = await request.json(),
        previous = await this.ctx.storage.get('profile')
      await this.ctx.storage.put('profile', { ...previous, ...profile })
      if (!previous) await this.ctx.storage.setAlarm(Date.now() + 1000)
      return json({ ok: true })
    }
    if (path === '/requests' && request.method === 'GET') {
      const jobs = await this.ctx.storage.list({ prefix: 'job:' })
      return json({
        requests: [...jobs.values()]
          .sort((a, b) => b.createdAt - a.createdAt)
          .map(publicJob),
      })
    }
    if (path === '/requests' && request.method === 'POST') {
      const input = await request.json()
      return this.ctx.blockConcurrencyWhile(async () => {
        const requestHash = await digest(
          JSON.stringify({ brief: input.brief, recipients: input.recipients }),
        )
        const existing = await this.ctx.storage.get(`job:${input.id}`)
        if (existing)
          return (existing.requestHash ||
            (await digest(
              JSON.stringify({
                brief: existing.brief,
                recipients: existing.recipients,
              }),
            ))) === requestHash
            ? json(publicJob(existing))
            : json({ error: 'This request identifier was already used.' }, 409)
        const jobs = await this.ctx.storage.list({ prefix: 'job:' })
        const now = Date.now()
        if (
          [...jobs.values()].filter((job) => job.createdAt > now - 86400000)
            .length >= 10 ||
          jobs.size >= 100
        )
          return json(
            {
              error: 'The request limit has been reached. Try again tomorrow.',
            },
            429,
          )
        const job = {
          ...input,
          requestHash,
          status: 'queued',
          createdAt: now,
          recipientCount: input.recipients.length,
        }
        await this.ctx.storage.transaction(async (tx) => {
          await tx.put(`job:${input.id}`, job)
          await tx.setAlarm(now + 1000)
        })
        return json(publicJob(job), 202)
      })
    }
    if (path.startsWith('/ready/') && request.method === 'POST') {
      const id = path.slice('/ready/'.length)
      let input, url
      try {
        input = await request.json()
        url = new URL(input.practiceUrl)
      } catch {
        return json({ error: 'Use a valid published practice URL.' }, 400)
      }
      const job = await this.ctx.storage.get(`job:${id}`)
      if (
        !job ||
        ![
          'submitted',
          'publishing',
          'ready',
          'notifying',
          'notified',
          'notification_attention',
        ].includes(job.status)
      )
        return json(
          { error: 'The practice request is not awaiting publication.' },
          409,
        )
      if (job.practiceUrl)
        return job.practiceUrl === input.practiceUrl
          ? json(publicJob(job))
          : json({ error: 'A different practice was already published.' }, 409)
      if (
        url.origin !== this.env.APP_ORIGIN ||
        url.pathname !== '/' ||
        url.search ||
        !url.hash.startsWith('#/shared/') ||
        url.hash.length > 12300 ||
        !/^[a-f0-9]{40}$/.test(input.sourceSha || '')
      )
        return json(
          {
            error:
              'Use a published QuickTrack practice link and exact source SHA.',
          },
          400,
        )
      if (
        job.recipients.some((recipient) => recipient.channel === 'sms') &&
        smsReadyMessage({ ...job, practiceUrl: url.href }).length > 1600
      )
        return json(
          {
            error:
              'This practice link is too long for a text. Create a compact catalog-based practice pass before marking it ready.',
          },
          400,
        )
      const fetcher = this.env.TEST_FETCH || fetch
      const source = await fetcher(`${this.env.APP_ORIGIN}/source.html`, {
        signal: AbortSignal.timeout(15000),
      })
      if (
        !source.ok ||
        !(await source.text()).includes(`/tree/${input.sourceSha}/training`)
      )
        return json(
          { error: 'The selected application version is not live.' },
          409,
        )
      const response = await fetcher(`${this.env.APP_ORIGIN}/api/catalog`, {
        signal: AbortSignal.timeout(15000),
      })
      if (!response.ok)
        return json({ error: 'The player catalog is unavailable.' }, 409)
      const catalog = await response.json()
      const published = await readPracticeCode(
        url.hash.slice('#/shared/'.length),
        catalog,
        async (revision) => {
          if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(revision))
            throw new Error('Invalid edition')
          const edition = await fetcher(
            `${this.env.APP_ORIGIN}/api/catalogs/${revision}`,
            { signal: AbortSignal.timeout(15000) },
          )
          if (!edition.ok) throw new Error('Edition unavailable')
          return edition.json()
        },
      )
      return this.ctx.blockConcurrencyWhile(async () => {
        const latest = await this.ctx.storage.get(`job:${id}`)
        if (!latest)
          return json({ error: 'This practice request has expired.' }, 409)
        if (latest.practiceUrl)
          return latest.practiceUrl === input.practiceUrl
            ? json(publicJob(latest))
            : json(
                { error: 'A different practice was already published.' },
                409,
              )
        await this.ctx.storage.put(`job:${id}`, {
          ...latest,
          practiceUrl: url.href,
          publishedTitle: published.title,
          status: 'ready',
        })
        await this.ctx.storage.setAlarm(Date.now() + 1000)
        return json({ status: 'ready' })
      })
    }
    return json({ error: 'not_found' }, 404)
  }
  async alarm() {
    if (this.running) return
    this.running = true
    try {
      const profile = await this.ctx.storage.get('profile')
      if (profile && (profile.nextIssuePoll || 0) <= Date.now()) {
        await this.ctx.storage.put('profile', {
          ...profile,
          nextIssuePoll: Date.now() + 60000,
        })
        try {
          await importApprovedIssue(this, profile)
        } catch {
          /* Bounded next poll; no model retry. */
        }
      }
      const jobs = await this.ctx.storage.list({ prefix: 'job:' })
      for (const [key, job] of [...jobs].sort(
        (a, b) => a[1].createdAt - b[1].createdAt,
      )) {
        if (job.createdAt < Date.now() - 30 * 86400000) {
          await this.ctx.storage.delete(key)
          continue
        }
        if (
          ['processing', 'revising', 'notifying', 'creating_issue'].includes(
            job.status,
          )
        ) {
          await this.ctx.storage.put(key, {
            ...job,
            status: 'attention',
            reason:
              'The previous operation was interrupted. Check the pull request or delivery provider before submitting again.',
          })
          continue
        }
        if (
          ['creating_pr', 'submitted', 'publishing'].includes(job.status) &&
          (job.nextPollAt || 0) <= Date.now()
        ) {
          await this.follow(job)
          break
        }
        if (job.status === 'queued') {
          await this.prepare(job)
          break
        }
        if (job.status === 'ready') {
          await this.notify(job)
          break
        }
      }
    } finally {
      this.running = false
      await this.ctx.blockConcurrencyWhile(async () => {
        const jobs = await this.ctx.storage.list({ prefix: 'job:' })
        const pending = [...jobs.values()].some((job) =>
          ['queued', 'ready'].includes(job.status),
        )
        const watched = [...jobs.values()].filter((job) =>
          ['creating_pr', 'submitted', 'publishing'].includes(job.status),
        )
        const profile = await this.ctx.storage.get('profile')
        if (profile) await this.ctx.storage.setAlarm(Date.now() + 60000)
        if (jobs.size)
          await this.ctx.storage.setAlarm(
            Date.now() +
              (pending
                ? 1000
                : watched.length
                  ? Math.max(
                      1000,
                      Math.min(
                        60000,
                        ...watched.map(
                          (job) => (job.nextPollAt || 0) - Date.now(),
                        ),
                      ),
                    )
                  : profile
                    ? 60000
                    : 86400000),
          )
      })
    }
  }
  async prepare(job, feedback) {
    const key = `job:${job.id}`,
      fetcher = this.env.TEST_FETCH || fetch
    await this.ctx.storage.put(key, {
      ...job,
      status: feedback ? 'revising' : 'processing',
    })
    try {
      let brief = job.brief
      for (const recipient of job.recipients || []) {
        if (recipient.name?.length > 1) {
          brief = brief.split(recipient.name).join('[player]')
          if (feedback)
            feedback = feedback.split(recipient.name).join('[player]')
        }
      }
      const context = feedback ? { previousPractice: job.plan, feedback } : {}
      const result = await researchPractice(brief, this.env, fetcher, context)
      if (result.rejected) {
        await this.ctx.storage.put(key, {
          ...job,
          status: feedback ? 'attention' : 'rejected',
          reason: result.reason,
          nextPollAt: Date.now() + 60000,
        })
        return
      }
      job = {
        ...job,
        plan: result.plan,
        videos: result.videos,
        status: 'creating_pr',
        reason: undefined,
        nextPollAt: Date.now(),
      }
      await this.ctx.storage.put(key, job)
      await this.follow(job)
    } catch {
      await this.ctx.storage.put(key, {
        ...job,
        status: feedback ? 'attention' : 'failed',
        reason:
          'The assistant could not finish this request. Your brief is preserved; revise it to try again.',
        nextPollAt: Date.now() + 60000,
      })
    }
  }
  async follow(job) {
    const key = `job:${job.id}`
    try {
      let update
      if (job.status === 'creating_pr')
        update = await writePracticePR(job, this.env)
      else if (job.status === 'publishing')
        update = (await publishedPractice(job, this.env)) || {
          status: 'publishing',
        }
      else update = await inspectPracticePR(job, this.env)
      if (update.feedback) {
        if ((job.revisions || 0) >= 3) {
          await this.ctx.storage.put(key, {
            ...job,
            status: 'attention',
            reason:
              'Three revisions are complete. Review this PR manually or start a new brief.',
          })
          return
        }
        job = {
          ...job,
          revisions: (job.revisions || 0) + 1,
          feedbackIds: [
            ...(job.feedbackIds || []),
            ...update.feedback.consumed,
          ],
        }
        // Checkpoint the feedback before any paid work, so a poll cannot charge twice.
        await this.ctx.storage.put(key, { ...job, status: 'revising' })
        await this.prepare(job, update.feedback.text)
        return
      }
      await this.ctx.storage.put(key, {
        ...job,
        ...update,
        reason: update.reason,
        pollFailures: 0,
        nextPollAt: Date.now() + 60000,
      })
      if (update.status === 'ready' && job.sourceIssueNumber) {
        // Closing is idempotent and happens only after HTTPS publication qualification.
        try {
          await github(this.env, `/issues/${job.sourceIssueNumber}`, 'PATCH', {
            state: 'closed',
            state_reason: 'completed',
          })
        } catch {
          /* The ready practice link remains available even if GitHub is temporarily down. */
        }
      }
    } catch {
      const failures = (job.pollFailures || 0) + 1
      await this.ctx.storage.put(key, {
        ...job,
        pollFailures: failures,
        status: failures >= 10 ? 'attention' : job.status,
        reason:
          failures >= 10
            ? 'Publishing needs attention. Check the linked PR and deployment; research has not been repeated.'
            : 'Waiting for GitHub or publication. Your practice is preserved.',
        nextPollAt: Date.now() + Math.min(900000, 60000 * failures),
      })
    }
  }
  async notify(job) {
    const key = `job:${job.id}`,
      delivery = []
    await this.ctx.storage.put(key, { ...job, status: 'notifying', delivery })
    for (let index = 0; index < job.recipients.length; index++) {
      const recipient = { ...job.recipients[index], index }
      // Persist intent first. Neither a crash nor an ambiguous provider response
      // causes an automatic SMS resend. Accepted is not a delivery receipt.
      delivery.push({ channel: recipient.channel, status: 'sending' })
      await this.ctx.storage.put(key, {
        ...job,
        status: 'notifying',
        delivery,
      })
      if (!notificationChannels(this.env)[recipient.channel]) {
        delivery[index] = {
          channel: recipient.channel,
          status: 'not_configured',
        }
        continue
      }
      try {
        delivery[index] = {
          channel: recipient.channel,
          ...(await sendReady(
            recipient,
            job,
            this.env,
            this.env.TEST_FETCH || fetch,
          )),
        }
      } catch {
        delivery[index] = {
          channel: recipient.channel,
          status: 'needs_review',
        }
      }
      await this.ctx.storage.put(key, {
        ...job,
        status: 'notifying',
        delivery,
      })
    }
    await this.ctx.storage.put(key, {
      ...job,
      status: delivery.some((item) => item.status === 'not_configured')
        ? 'notification_setup'
        : delivery.some((item) => item.status !== 'accepted')
          ? 'notification_attention'
          : 'notified',
      delivery,
      recipients: job.recipients,
    })
  }
}
