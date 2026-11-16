import { createStartedSession, reduceSession } from '../../src/domain/session.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { assignmentAPI } from './assignments.mjs'
const practice = {
  id: 'p',
  revision: 'v1',
  title: 'Practice',
  status: 'current',
  drills: [
    {
      id: 'd',
      title: 'Drill',
      instructions: 'Practice',
      mode: 'reps',
      sets: 1,
      reps: 4,
      side: 'both',
      restSec: 0,
      media: { id: 'demo', status: 'unavailable' }
    }
  ]
}
test('signed coach/player isolation, acceptance, persistence and stale writes', async () => {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  )
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey)
  jwk.kid = 'assignment-test'
  const env = {
    APP_ORIGIN: 'https://train.quicktrack.cc',
    COACH_ACCESS_ISSUER: 'https://assignment-test.cloudflareaccess.com',
    COACH_ACCESS_AUD: 'coach',
    PLAYER_ACCESS_AUD: 'player',
    COACH_ALLOWED_EMAILS: 'coach@example.com,other-coach@example.com',
    TEST_FETCH: async () => Response.json({ keys: [jwk] })
  }
  const db = new DatabaseSync(':memory:'),
    store = { db, lease() {} }
  const encode = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  async function call(role, email, input, path = 'assignments') {
    const data = `${encode({ alg: 'RS256', kid: jwk.kid })}.${encode({ iss: env.COACH_ACCESS_ISSUER, aud: [role], sub: email, email, exp: Date.now() / 1000 + 60 })}`
    const token = `${data}.${Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, Buffer.from(data))).toString('base64url')}`
    return assignmentAPI(
      new Request(`${env.APP_ORIGIN}/api/${role}/${path}`, {
        method: input ? 'POST' : 'GET',
        headers: { 'Cf-Access-Jwt-Assertion': token, Origin: env.APP_ORIGIN, 'Content-Type': 'application/json' },
        ...(input ? { body: JSON.stringify(input) } : {})
      }),
      env,
      store
    )
  }
  try {
    assert.equal(
      (await call('player', 'p@example.com', { action: 'create', email: 'p@example.com', practice })).status,
      400
    )
    assert.equal(
      (await call('coach', 'coach@example.com', { action: 'create', email: 'p@example.com', practice })).status,
      200
    )
    const records = (await (await call('player', 'p@example.com')).json()).records
    assert.equal(records.length, 1)
    assert.equal(records[0].owner, undefined)
    assert.equal((await (await call('player', 'stranger@example.com')).json()).records.length, 0)
    assert.equal((await (await call('coach', 'other-coach@example.com')).json()).records.length, 0)
    const input = { id: records[0].id, revision: 0, action: 'accept' }
    assert.equal((await call('player', 'stranger@example.com', input)).status, 400)
    assert.equal((await call('player', 'p@example.com', input)).status, 200)
    assert.equal((await call('player', 'p@example.com', input)).status, 400)
    assert.equal((await (await call('coach', 'coach@example.com')).json()).records[0].status, 'accepted')
    let session = {
      ...createStartedSession(practice, { id: 'verified-session', now: Date.now() }),
      coachAssignmentId: records[0].id
    }
    session = reduceSession(session, {
      type: 'DONE',
      id: 'record',
      sessionId: session.id,
      rowId: session.currentRowId,
      actual: 3,
      now: Date.now()
    })
    session = reduceSession(session, { type: 'FINISH', id: 'finish', sessionId: session.id, now: Date.now() })
    const submission = { id: records[0].id, revision: 1, action: 'submit', session, note: 'Synthetic live-flow check' }
    assert.equal((await call('player', 'stranger@example.com', submission)).status, 400)
    assert.equal((await call('player', 'p@example.com', submission)).status, 200)
    const submitted = (await (await call('coach', 'coach@example.com')).json()).records[0]
    assert.equal(submitted.result.rows[0].actual, 3)
    assert.equal(submitted.result.note, submission.note)
    const review = { id: records[0].id, revision: 2, action: 'review', comment: 'Repeat this practice' }
    assert.equal((await call('coach', 'other-coach@example.com', review)).status, 400)
    assert.equal((await call('coach', 'coach@example.com', review)).status, 200)
    const reviewed = (await (await call('player', 'p@example.com')).json()).records[0]
    assert.equal(reviewed.status, 'reviewed')
    assert.equal(reviewed.comment, review.comment)
    assert.equal(
      (await call('coach', 'coach@example.com', { action: 'create', email: 'p@example.com', practice })).status,
      200
    )
    const repeated = (await (await call('player', 'p@example.com')).json()).records
    assert.equal(repeated[0].status, 'pending')
    assert.equal(repeated[1].status, 'reviewed')
    assert.equal((await call('coach', 'coach@example.com', null, 'assignment-login')).status, 303)
  } finally {
    db.close()
  }
})
