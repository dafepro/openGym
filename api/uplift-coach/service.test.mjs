import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateKeyPairSync, sign } from 'node:crypto'
import { counters, createCoach } from './service.mjs'
import { coachProfile } from './access.mjs'

const env = {
  COACH_ACCESS_ISSUER: 'https://test.cloudflareaccess.com',
  COACH_ACCESS_AUD: 'uplift',
  COACH_ALLOWED_EMAILS: 'owner@example.test',
  OPENAI_API_KEY: 'fixture',
  OPENAI_MODEL: 'fixture-model'
}
const payload = {
  coach_contract: 1,
  task: 'ask',
  meta: { unit: 'kg' },
  plan: {},
  question: 'What should I train?',
  coachProfile: { notes: 'fixture preference' },
  conversation: [{ who: 'user', text: 'fixture follow-up' }],
  window: { workouts: [{ name: 'fixture workout' }] }
}
const request = (path = 'run', body = payload, extra = {}) =>
  new Request('https://example.test/api/invited-coach/' + path, {
    method: path === 'run' ? 'POST' : 'GET',
    ...(path === 'run' ? { body: JSON.stringify(body) } : {}),
    headers: { Origin: 'https://uplift.quicktrack.cc', 'Content-Type': 'application/json', ...extra }
  })
test('signed invite checks signature, owner, audience and time before any provider request', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const key = { ...publicKey.export({ format: 'jwk' }), kid: 'fixture' }
  const keys = async () => Response.json({ keys: [key] })
  const jwt = (overrides = {}) => {
    const b64 = (x) => Buffer.from(JSON.stringify(x)).toString('base64url')
    const data =
      b64({ kid: 'fixture', alg: 'RS256' }) +
      '.' +
      b64({
        iss: env.COACH_ACCESS_ISSUER,
        sub: 'owner',
        aud: ['uplift'],
        exp: Math.floor(Date.now() / 1000) + 300,
        email: env.COACH_ALLOWED_EMAILS,
        ...overrides
      })
    return data + '.' + sign('RSA-SHA256', Buffer.from(data), privateKey).toString('base64url')
  }
  let calls = 0
  const handle = createCoach(
    env,
    {
      reserve() {
        calls++
        return true
      }
    },
    { verify: (r, e) => coachProfile(r, e, keys) }
  )
  for (const token of [
    '',
    jwt({ exp: 1 }),
    jwt({ email: 'other@example.test' }),
    jwt({ aud: ['elsewhere'] }),
    jwt() + '.invalid'
  ]) {
    assert.equal((await handle(request('run', payload, { 'Cf-Access-Jwt-Assertion': token }))).status, 403)
  }
  assert.equal((await handle(request('session', null, { 'Cf-Access-Jwt-Assertion': jwt() }))).status, 200)
  assert.equal(calls, 0)
})
test('validated reply uses only the server-selected provider, counts a repair, and withholds raw failures', async () => {
  const calls = []
  let reservations = 0
  const handle = createCoach(
    env,
    {
      reserve() {
        reservations++
        return true
      }
    },
    {
      verify: async () => ({ identity: 'me' }),
      fetcher: async (url, init) => {
        assert.equal(url, 'https://api.openai.com/v1/responses')
        const b = JSON.parse(init.body)
        calls.push(b)
        return Response.json({
          output: [
            {
              content: [
                {
                  type: 'output_text',
                  text: calls.length === 1 ? 'invalid' : JSON.stringify({ coach_contract: 1, answer: 'Fixture reply' })
                }
              ]
            }
          ]
        })
      }
    }
  )
  assert.equal((await handle(request('run', payload, { Origin: 'https://another.example' }))).status, 403)
  assert.equal((await handle(request('run', { ...payload, question: 'x'.repeat(140000) }))).status, 413)
  assert.deepEqual(await (await handle(request())).json(), { ok: true, result: { answer: 'Fixture reply' } })
  assert.equal(reservations, 2)
  assert.equal(calls[0].store, false)
  assert.equal(calls[0].model, env.OPENAI_MODEL)
  for (const word of ['fixture preference', 'fixture follow-up', 'fixture workout'])
    assert.ok(calls[0].input.includes(word))
})
test('quotas survive restart and bound all identities together', () => {
  const dir = mkdtempSync(join(tmpdir(), 'uplift-quota-'))
  try {
    const path = join(dir, 'quota.sqlite'),
      now = new Date('2026-04-01')
    let q = counters(path)
    for (let i = 0; i < 16; i++) assert.equal(q.reserve('me', now), true)
    q.close()
    q = counters(path)
    assert.equal(q.reserve('me', now), false)
    for (let i = 0; i < 8; i++) assert.equal(q.reserve('other', now), true)
    assert.equal(q.reserve('third', now), false)
    for (let day = 2; day <= 10; day++) {
      now.setUTCDate(day)
      for (let i = 0; i < 24; i++) assert.equal(q.reserve(String(i), now), true)
    }
    now.setUTCDate(11)
    assert.equal(q.reserve('owner', now), false)
    now.setUTCMonth(4)
    assert.equal(q.reserve('owner', now), true)
    q.close()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
