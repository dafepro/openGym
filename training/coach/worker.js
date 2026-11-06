import { json, digest, readLimited } from '../worker/http.js'
import { coachIdentity, verifyReadySignature } from './auth.js'
import { researchPractice, issueBody } from './agent.js'
import {
  notificationChannels,
  sendReady,
  readyMessage,
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
    env.COACH_GITHUB_TOKEN &&
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
          build: env.APP_SOURCE_SHA || 'local',
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
        return env.COACH_REQUESTS.get(
          env.COACH_REQUESTS.idFromName(ready[1]),
        ).fetch(
          new Request(`https://internal/ready/${ready[2]}`, {
            method: 'POST',
            body: text,
          }),
        )
      }
      const identity = await coachIdentity(request, env)
      if (!identity)
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
      const owner = await digest(identity)
      const stub = env.COACH_REQUESTS.get(env.COACH_REQUESTS.idFromName(owner))
      if (url.pathname === `${PREFIX}/requests` && request.method === 'GET')
        return stub.fetch('https://internal/requests')
      if (url.pathname === `${PREFIX}/requests` && request.method === 'POST') {
        let input
        try {
          input = validateCoachRequest(await body(request))
        } catch (error) {
          return json({ error: error.message }, 400)
        }
        if (!uuid(input.id))
          return json({ error: 'Invalid request identifier.' }, 400)
        const channels = notificationChannels(env)
        if (input.recipients.some((recipient) => !channels[recipient.channel]))
          return json(
            {
              error:
                'A requested notification channel is not configured. Remove those recipients or configure the channel first.',
            },
            400,
          )
        return stub.fetch(
          new Request('https://internal/requests', {
            method: 'POST',
            body: JSON.stringify({ ...input, owner }),
          }),
        )
      }
      return json({ error: 'not_found' }, 404)
    } catch {
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
        readyMessage({ ...job, practiceUrl: url.href }).length > 1600
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
      if (
        job.recipients.some((recipient) => recipient.channel === 'sms') &&
        readyMessage({
          ...job,
          practiceUrl: url.href,
          publishedTitle: published.title,
        }).length > 1600
      )
        return json(
          {
            error:
              'Use a shorter catalog-based practice pass for text notifications.',
          },
          400,
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
      const jobs = await this.ctx.storage.list({ prefix: 'job:' })
      for (const [key, job] of [...jobs].sort(
        (a, b) => a[1].createdAt - b[1].createdAt,
      )) {
        if (job.createdAt < Date.now() - 30 * 86400000) {
          await this.ctx.storage.delete(key)
          continue
        }
        if (
          ['processing', 'creating_issue', 'notifying'].includes(job.status)
        ) {
          await this.ctx.storage.put(key, {
            ...job,
            status: 'attention',
            reason:
              'The previous operation was interrupted. Check the issue or delivery provider before submitting again.',
          })
          continue
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
        if (jobs.size)
          await this.ctx.storage.setAlarm(
            Date.now() + (pending ? 1000 : 86400000),
          )
      })
    }
  }
  async prepare(job) {
    const key = `job:${job.id}`,
      fetcher = this.env.TEST_FETCH || fetch
    await this.ctx.storage.put(key, { ...job, status: 'processing' })
    try {
      const result = await researchPractice(job.brief, this.env, fetcher)
      if (result.rejected) {
        await this.ctx.storage.put(key, {
          ...job,
          status: 'rejected',
          reason: result.reason,
          recipients: [],
        })
        return
      }
      job = { ...job, plan: result.plan, status: 'creating_issue' }
      await this.ctx.storage.put(key, job)
      const response = await fetcher(
        `https://api.github.com/repos/${this.env.COACH_GITHUB_REPOSITORY}/issues`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.env.COACH_GITHUB_TOKEN}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'QuickTrack-Coach',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: `Practice proposal: ${result.plan.title}`.replaceAll(
              '@',
              '＠',
            ),
            body: issueBody(`${job.owner}.${job.id}`, result.plan),
          }),
          signal: AbortSignal.timeout(20000),
        },
      )
      if (!response.ok) throw new Error('Issue creation did not finish.')
      const issue = await response.json()
      if (!Number.isSafeInteger(issue.number) || issue.number < 1)
        throw new Error('Invalid issue response')
      await this.ctx.storage.put(key, {
        ...job,
        status: 'submitted',
        issueUrl: `https://github.com/${this.env.COACH_GITHUB_REPOSITORY}/issues/${issue.number}`,
      })
    } catch {
      await this.ctx.storage.put(key, {
        ...job,
        status: job.status === 'creating_issue' ? 'attention' : 'failed',
        reason:
          job.status === 'creating_issue'
            ? 'Check GitHub before retrying: issue creation could not be confirmed.'
            : 'The assistant could not finish this request. Your brief is preserved; try again later.',
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
      await this.ctx.storage.put(key, { ...job, status: 'notifying', delivery })
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
        delivery[index] = { channel: recipient.channel, status: 'needs_review' }
      }
      await this.ctx.storage.put(key, { ...job, status: 'notifying', delivery })
    }
    await this.ctx.storage.put(key, {
      ...job,
      status: delivery.some((item) => item.status === 'needs_review')
        ? 'notification_attention'
        : 'notified',
      delivery,
      recipients: [],
    })
  }
}
