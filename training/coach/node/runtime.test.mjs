import { practiceGitHubFixture } from '../test-provider.js'
import { request as httpRequest } from 'node:http'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CoachStore } from './storage.mjs'
import { createCoachServer, validateConfig } from './server.mjs'
import { coachIdentity } from '../auth.js'
import proxy from '../proxy.js'

const owner = 'a'.repeat(64),
  other = 'b'.repeat(64)
const brief =
  'Plan 15 minutes of soccer ball control with two cones and both feet.'
const base = {
  APP_ORIGIN: 'https://train.quicktrack.cc',
  COACH_ORIGIN_HOST: 'coach-origin.quicktrack.cc',
  COACH_GITHUB_REPOSITORY: 'dafepro/openGym',
  OPENAI_API_KEY: 'test',
  OPENAI_MODEL: 'test-model',
  COACH_GITHUB_TOKEN: 'test',
  COACH_READY_SECRET: 'x'.repeat(32),
  COACH_ACCESS_ISSUER: 'https://node-test.cloudflareaccess.com',
  COACH_ACCESS_AUD: 'test-audience',
  COACH_ALLOWED_EMAILS: 'coach@example.com',
  APP_SOURCE_SHA: 'a'.repeat(40),
}
const enqueue = (store, who = owner, id = crypto.randomUUID()) =>
  store.get(who).fetch(
    new Request('https://internal/requests', {
      method: 'POST',
      body: JSON.stringify({ id, owner: who, brief, recipients: [] }),
    }),
  )
function fixture(t, extra = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'coach-node-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const env = { ...base, ...extra }
  return { filename: join(dir, 'coach.sqlite'), env }
}
const message = (text) => ({
  status: 'completed',
  output: [
    {
      type: 'message',
      content: [{ type: 'output_text', text: JSON.stringify(text) }],
    },
  ],
})
const plan = {
  title: 'Close control',
  goal: 'Keep every touch close.',
  overview: 'Two cones and a ball.',
  drills: [
    {
      title: 'Cone touches',
      setup: 'Set two cones a stride apart.',
      instructions: 'Dribble between the cones.',
      focus: 'Small touches.',
      mode: 'time',
      sets: 2,
      reps: null,
      durationSec: 60,
      restSec: 30,
      side: 'each',
      tags: ['futbol:dribbling'],
      demonstrationUrl: 'https://www.youtube.com/watch?v=QKz7fDjPnvg',
      sources: [
        { title: 'Guide', url: 'https://www.youtube.com/watch?v=QKz7fDjPnvg' },
      ],
    },
  ],
}
function providers() {
  const calls = []
  let model = 0
  const github = practiceGitHubFixture()
  return {
    calls,
    fetch: async (url, options) => {
      calls.push({ url, options })
      if (url === 'https://api.openai.com/v1/responses') {
        model++
        return Response.json(
          model % 3 === 1
            ? message({ accepted: true, reason: 'Soccer.' })
            : model % 3 === 2
              ? {
                  status: 'completed',
                  output: [
                    {
                      type: 'web_search_call',
                      action: {
                        sources: [
                          {
                            url: 'https://www.youtube.com/watch?v=QKz7fDjPnvg',
                          },
                        ],
                      },
                    },
                    {
                      type: 'message',
                      content: [
                        { type: 'output_text', text: 'Small cone touches.' },
                      ],
                    },
                  ],
                }
              : message(plan),
        )
      }
      return github(url, options)
    },
  }
}
test('SQLite restart preserves queue, idempotency, and exactly one PR', async (t) => {
  const f = fixture(t),
    provider = providers()
  f.env.TEST_FETCH = provider.fetch
  let clock = Date.now()
  let store = new CoachStore(f.filename, f.env, { now: () => clock })
  const id = crypto.randomUUID()
  assert.equal((await enqueue(store, owner, id)).status, 202)
  store.close()
  store = new CoachStore(f.filename, f.env, { now: () => clock })
  t.after(() => store.close())
  assert.equal((await enqueue(store, owner, id)).status, 200)
  clock += 2000
  await store.tick()
  await store.tick()
  assert.equal(
    (await store.storage(owner).get(`job:${id}`)).status,
    'submitted',
  )
  assert.equal(
    provider.calls.filter((c) => c.url.includes('api.openai.com')).length,
    3,
  )
  assert.equal(
    provider.calls.filter(
      (c) => c.url.endsWith('/pulls') && c.options?.method === 'POST',
    ).length,
    1,
  )
})
test('global allowance applies atomically across identities and survives restart', async (t) => {
  const f = fixture(t, { COACH_DAILY_REQUESTS: '1' })
  let store = new CoachStore(f.filename, f.env)
  const result = await Promise.allSettled([
    enqueue(store),
    enqueue(store, other),
  ])
  assert.equal(result.filter((r) => r.status === 'fulfilled').length, 1)
  assert.equal(result.find((r) => r.status === 'rejected').reason.status, 429)
  store.close()
  store = new CoachStore(f.filename, f.env)
  t.after(() => store.close())
  await assert.rejects(enqueue(store, other), { status: 429 })
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM records').get().n, 1)
})
test('pending and rolling monthly limits reject before a paid call', async (t) => {
  for (const limit of ['COACH_MAX_PENDING', 'COACH_MONTHLY_REQUESTS']) {
    const f = fixture(t, { [limit]: '1' }),
      store = new CoachStore(f.filename, f.env)
    await enqueue(store)
    await assert.rejects(enqueue(store, other), { status: 429 })
    store.close()
  }
})
test('interrupted side effects require review after process restart', async (t) => {
  for (const status of ['processing', 'creating_issue', 'notifying']) {
    const f = fixture(t),
      provider = providers()
    f.env.TEST_FETCH = provider.fetch
    let store = new CoachStore(f.filename, f.env)
    const job = await (await enqueue(store)).json()
    await store.storage(owner).put(`job:${job.id}`, {
      ...(await store.storage(owner).get(`job:${job.id}`)),
      status,
    })
    store.close()
    store = new CoachStore(f.filename, f.env, { now: () => Date.now() + 2000 })
    await store.tick()
    assert.equal(
      (await store.storage(owner).get(`job:${job.id}`)).status,
      'attention',
    )
    assert.equal(provider.calls.length, 0)
    store.close()
  }
})
test('notification quota reserves before sends; exhausted jobs require attention', async (t) => {
  const f = fixture(t, {
      COACH_DAILY_EMAILS: '1',
      RESEND_API_KEY: 'test',
      COACH_EMAIL_FROM: 'coach@example.org',
    }),
    store = new CoachStore(f.filename, f.env, { now: () => Date.now() + 2000 })
  t.after(() => store.close())
  const job = await (await enqueue(store)).json(),
    storage = store.storage(owner)
  await storage.put(`job:${job.id}`, {
    ...job,
    owner,
    plan,
    status: 'ready',
    recipients: [
      { channel: 'email', address: 'a@example.org' },
      { channel: 'email', address: 'b@example.org' },
    ],
    practiceUrl: 'https://train.quicktrack.cc/#/shared/QT3-example',
  })
  await store.tick()
  const final = await storage.get(`job:${job.id}`)
  assert.equal(final.status, 'notification_attention')
  assert.deepEqual(final.recipients, [])
  assert.equal(
    store.db.prepare('SELECT COUNT(*) AS n FROM deliveries').get().n,
    0,
  )
})
test('a second active runtime cannot use the same database', (t) => {
  const f = fixture(t),
    store = new CoachStore(f.filename, f.env)
  t.after(() => store.close())
  assert.throws(() => new CoachStore(f.filename, f.env), /Another/)
})
async function signedIdentity() {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey)
  jwk.kid = 'node-test-key'
  const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
  return {
    fetch: async () => Response.json({ keys: [jwk] }),
    token: async (email, extra = {}) => {
      const data = `${encode({ alg: 'RS256', kid: jwk.kid })}.${encode({ iss: base.COACH_ACCESS_ISSUER, aud: [base.COACH_ACCESS_AUD], sub: email, email, exp: Date.now() / 1000 + 600, ...extra })}`
      return `${data}.${Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, Buffer.from(data))).toString('base64url')}`
    },
  }
}
test('Google Access identity requires signed, current, audience-bound and allowlisted email', async () => {
  const auth = await signedIdentity()
  for (const [email, extra, allowed] of [
    ['coach@example.com', {}, true],
    ['stranger@example.com', {}, false],
    ['coach@example.com', { exp: 0 }, false],
    ['coach@example.com', { aud: ['other'] }, false],
  ]) {
    const token = await auth.token(email, extra)
    const result = await coachIdentity(
      new Request(base.APP_ORIGIN, {
        headers: { 'Cf-Access-Jwt-Assertion': token },
      }),
      base,
      auth.fetch,
    )
    assert.equal(!!result, allowed)
  }
  assert.equal(
    await coachIdentity(
      new Request(base.APP_ORIGIN, {
        headers: { 'Cf-Access-Authenticated-User-Email': 'coach@example.com' },
      }),
      base,
      auth.fetch,
    ),
    null,
  )
})
test('HTTP has fixed origin, rejects unauthenticated/oversized/paused mutations, and rate-limits traffic', async (t) => {
  const f = fixture(t),
    app = createCoachServer(f.env, {
      filename: f.filename,
      paused: () => true,
    })
  await new Promise((done) => app.server.listen(0, '127.0.0.1', done))
  t.after(() => app.close())
  const origin = `http://127.0.0.1:${app.server.address().port}`
  const fetch = (url, options = {}) =>
    new Promise((resolve, reject) => {
      const req = httpRequest(url, options, (res) => {
        const parts = []
        res.on('data', (chunk) => parts.push(chunk))
        res.on('end', () =>
          resolve(
            new Response(Buffer.concat(parts), {
              status: res.statusCode,
              headers: res.headers,
            }),
          ),
        )
      })
      req.on('error', reject)
      req.end(options.body)
    })
  const headers = { Host: base.COACH_ORIGIN_HOST }
  assert.equal((await fetch(origin + '/healthz')).status, 200)
  assert.equal(
    (await fetch(origin + '/api/coach/requests', { headers })).status,
    401,
  )
  assert.equal(
    (
      await fetch(origin + '/api/coach/requests', {
        headers,
        method: 'POST',
        body: '{}',
      })
    ).status,
    503,
  )
  assert.equal((await fetch(origin + '/api/coach/config')).status, 404)
  for (let i = 0; i < 300; i++)
    await fetch(origin + '/api/coach/config', { headers })
  assert.equal(
    (await fetch(origin + '/api/coach/config', { headers })).status,
    429,
  )
})
test('proxy forwards only required headers, enforces body bound, and never follows upstream redirects', async () => {
  let captured
  const env = {
    COACH_ORIGIN: 'https://coach-origin.quicktrack.cc',
    TEST_FETCH: async (url, options) => {
      captured = { url, options }
      return Response.json({ ok: true })
    },
  }
  const res = await proxy.fetch(
    new Request(base.APP_ORIGIN + '/api/coach/requests', {
      headers: {
        Cookie: 'private',
        Authorization: 'private',
        'Cf-Access-Jwt-Assertion': 'signed',
      },
    }),
    env,
  )
  assert.equal(res.status, 200)
  assert.equal(captured.options.headers.get('Cookie'), null)
  assert.equal(captured.options.headers.get('Authorization'), null)
  assert.equal(
    captured.options.headers.get('Cf-Access-Jwt-Assertion'),
    'signed',
  )
  assert.equal(captured.options.redirect, 'manual')
  assert.equal(
    (
      await proxy.fetch(
        new Request(base.APP_ORIGIN + '/api/coach/requests', {
          method: 'POST',
          body: 'x'.repeat(16001),
        }),
        env,
      )
    ).status,
    503,
  )
  assert.equal(
    (
      await proxy.fetch(
        new Request(base.APP_ORIGIN + '/api/coach/config?redirect=evil'),
        env,
      )
    ).status,
    404,
  )
  env.TEST_FETCH = async () => Response.redirect('https://example.org', 302)
  assert.equal(
    (await proxy.fetch(new Request(base.APP_ORIGIN + '/api/coach/login'), env))
      .status,
    502,
  )
})
test('production refuses missing allowlist or credentials', () => {
  assert.doesNotThrow(() => validateConfig(base))
  for (const key of [
    'COACH_ALLOWED_EMAILS',
    'OPENAI_API_KEY',
    'COACH_ACCESS_AUD',
    'COACH_READY_SECRET',
  ])
    assert.throws(() => validateConfig({ ...base, [key]: '' }))
})

test('authenticated HTTP request goes through SQLite, research and PR creation; retries and CSRF cannot spend again', async (t) => {
  const f = fixture(t, {
    COACH_DAILY_REQUESTS: '1',
    COACH_ACCESS_ISSUER: 'https://http-test.cloudflareaccess.com',
  })
  const auth = await signedIdentity(),
    token = await auth.token('coach@example.com', {
      iss: f.env.COACH_ACCESS_ISSUER,
    })
  assert.ok(
    await coachIdentity(
      new Request(base.APP_ORIGIN, {
        headers: { 'Cf-Access-Jwt-Assertion': token },
      }),
      f.env,
      auth.fetch,
    ),
  )
  const provider = providers()
  f.env.TEST_FETCH = provider.fetch
  let clock = Date.now()
  const app = createCoachServer(f.env, {
    filename: f.filename,
    now: () => clock,
  })
  await new Promise((done) => app.server.listen(0, '127.0.0.1', done))
  t.after(() => app.close())
  const origin = `http://127.0.0.1:${app.server.address().port}`
  const headers = {
    Host: base.COACH_ORIGIN_HOST,
    Origin: base.APP_ORIGIN,
    'Content-Type': 'application/json',
    'Cf-Access-Jwt-Assertion': token,
  }
  const call = (path, options = {}) =>
    new Promise((resolve, reject) => {
      const req = httpRequest(origin + path, { headers, ...options }, (res) => {
        const parts = []
        res.on('data', (chunk) => parts.push(chunk))
        res.on('end', () =>
          resolve(
            new Response(Buffer.concat(parts), {
              status: res.statusCode,
              headers: res.headers,
            }),
          ),
        )
      })
      req.on('error', reject)
      req.end(options.body)
    })
  const payload = {
    id: crypto.randomUUID(),
    brief,
    recipients: '',
    consent: false,
  }
  const request = { method: 'POST', body: JSON.stringify(payload) }
  assert.equal(
    (
      await call('/api/coach/requests', {
        ...request,
        headers: { ...headers, Origin: 'https://attacker.example' },
      })
    ).status,
    403,
  )
  assert.equal((await call('/api/coach/requests', request)).status, 202)
  assert.equal((await call('/api/coach/requests', request)).status, 200)
  assert.equal(
    (
      await call('/api/coach/requests', {
        ...request,
        body: JSON.stringify({ ...payload, id: crypto.randomUUID() }),
      })
    ).status,
    429,
  )
  clock += 2000
  await app.store.tick()
  const result = await (await call('/api/coach/requests')).json()
  assert.equal(result.requests[0].status, 'submitted')
  assert.equal(
    result.requests[0].prUrl,
    'https://github.com/dafepro/openGym/pull/123',
  )
  assert.equal(
    provider.calls.filter((c) => c.url.includes('api.openai.com')).length,
    3,
  )
  assert.equal((await call('/api/coach/login')).status, 303)
})
