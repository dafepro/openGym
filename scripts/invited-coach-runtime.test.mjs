import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'

test('workerd reaches the signed origin and refuses to forward assertions on redirects', async () => {
  const code = await readFile(new URL('../worker/invited-coach.ts', import.meta.url), 'utf8')
  const calls = []
  const runtime = new Miniflare(
    convertV4MiniflareOptions({
      cf: false,
      modules: true,
      compatibilityDate: '2026-09-28',
      script: stripTypeScriptTypes(code) + '\nexport default {fetch(request){return invitedCoach(request)}}',
      outboundService(request) {
        calls.push([request.url, request.headers.get('Cf-Access-Jwt-Assertion')])
        return calls.length === 1 ? Response.json({ invited: true }) : Response.redirect('https://elsewhere.invalid/')
      }
    })
  )
  try {
    const session = 'https://uplift.quicktrack.cc/api/invited-coach/session'
    const options = { headers: { 'Cf-Access-Jwt-Assertion': 'test-only' } }
    const ok = await runtime.dispatchFetch(session, options)
    assert.equal(ok.status, 200)
    assert.deepEqual(await ok.json(), { invited: true })
    assert.equal((await runtime.dispatchFetch(session, options)).status, 502)
    assert.deepEqual(
      calls,
      Array(2).fill(['https://uplift-coach-origin.quicktrack.cc/api/invited-coach/session', 'test-only'])
    )
  } finally {
    await runtime.dispose()
  }
})
