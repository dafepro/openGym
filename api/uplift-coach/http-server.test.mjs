import assert from 'node:assert/strict'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'
import { createCoachServer } from './http-server.mjs'

test('completed onboarding uploads stay connected while a plan is generated', async (t) => {
  const server = createCoachServer(async (request) => {
    assert.equal((await request.json()).task, 'create')
    await delay(16000)
    return Response.json({ ok: true })
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => server.close())
  const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/invited-coach/run', {
    method: 'POST',
    body: JSON.stringify({ task: 'create' }),
    signal: AbortSignal.timeout(25000)
  })
  assert.deepEqual(await response.json(), { ok: true })
})
