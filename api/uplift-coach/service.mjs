import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { runPipeline } from '../coach/core/pipeline.js'
import { CONTRACT, TASKS } from '../coach/core/payload.js'
import { coachProfile } from './access.mjs'

const origin = 'https://uplift.quicktrack.cc'
const maxBody = 128 * 1024
const perDay = 16
const globalDay = 24
const globalMonth = 240
const json = (status, body) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

// One service writer. Each actual provider attempt, including a repair or failure,
// reserves its slot before awaiting the network. Restarts retain the counters.
export function counters(path) {
  const db = new DatabaseSync(path)
  db.exec('CREATE TABLE IF NOT EXISTS usage(day TEXT, subject TEXT, calls INTEGER NOT NULL, PRIMARY KEY(day, subject))')
  const total = db.prepare('SELECT coalesce(sum(calls),0) AS n FROM usage WHERE day >= ? AND day <= ?')
  const count = db.prepare('SELECT calls FROM usage WHERE day=? AND subject=?')
  const bump = db.prepare('INSERT INTO usage VALUES(?,?,1) ON CONFLICT(day,subject) DO UPDATE SET calls = calls + 1')
  return {
    reserve(identity, now = new Date()) {
      const day = now.toISOString().slice(0, 10)
      const subject = createHash('sha256').update(identity).digest('hex')
      db.exec('BEGIN IMMEDIATE')
      try {
        db.prepare('DELETE FROM usage WHERE day < ?').run(day.slice(0, 7) + '-01')
        const allowed =
          (count.get(day, subject)?.calls || 0) < perDay &&
          total.get(day, day).n < globalDay &&
          total.get(day.slice(0, 7) + '-01', day).n < globalMonth
        if (allowed) bump.run(day, subject)
        db.exec('COMMIT')
        return allowed
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    },
    close: () => db.close()
  }
}

async function readBounded(body, limit) {
  const reader = body?.getReader()
  if (!reader) throw Error('empty')
  const chunks = []
  let size = 0
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > limit) {
      await reader.cancel()
      throw Error('size')
    }
    chunks.push(value)
  }
  return JSON.parse(Buffer.concat(chunks).toString())
}

export function createCoach(env, usage, { verify = coachProfile, fetcher = fetch } = {}) {
  if (
    !env.OPENAI_API_KEY ||
    !env.OPENAI_MODEL ||
    !env.COACH_ALLOWED_EMAILS?.trim() ||
    !env.COACH_ACCESS_AUD ||
    !env.COACH_ACCESS_ISSUER
  )
    throw Error('Missing coach configuration')
  let busy = false
  return async (request) => {
    const path = new URL(request.url).pathname
    if (path === '/healthz' && request.method === 'GET') return json(200, { ok: true })
    const run = path === '/api/invited-coach/run' && request.method === 'POST'
    if (!run && !(path === '/api/invited-coach/session' && request.method === 'GET')) return json(404, {})
    const user = await verify(request, env)
    if (!user) return json(403, { code: 'auth' })
    if (!run) return json(200, { invited: true })
    if (
      request.headers.get('Origin') !== origin ||
      request.headers.get('Content-Type')?.split(';')[0] !== 'application/json'
    )
      return json(403, {})
    if (busy) return json(409, { code: 'busy' })
    busy = true
    try {
      let payload
      try {
        payload = await readBounded(request.body, maxBody)
      } catch (err) {
        return json(err.message === 'size' ? 413 : 400, { code: 'invalid' })
      }
      if (
        !payload ||
        payload.coach_contract !== CONTRACT ||
        !TASKS.includes(payload.task) ||
        !payload.plan ||
        !payload.meta ||
        (payload.library && !Array.isArray(payload.library))
      )
        return json(400, { code: 'invalid' })
      const deadline = AbortSignal.timeout(90000)
      let capped = false
      const adapter = {
        spawns: false,
        async invoke({ system, prompt }) {
          if (!usage.reserve(user.identity)) {
            capped = true
            return { code: 1, stderr: '429 quota' }
          }
          const response = await fetcher('https://api.openai.com/v1/responses', {
            method: 'POST',
            redirect: 'error',
            signal: deadline,
            headers: { Authorization: 'Bearer ' + env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: env.OPENAI_MODEL,
              store: false,
              instructions: system,
              input: prompt,
              max_output_tokens: payload.task === 'create' ? 6000 : 2600,
              text: { format: { type: 'json_object' } }
            })
          })
          if (!response.ok) {
            await response.body?.cancel()
            return { code: 1, stderr: 'HTTP ' + response.status }
          }
          const result = await readBounded(response.body, 256 * 1024)
          const text = (result.output || [])
            .flatMap((x) => x.content || [])
            .filter((x) => x.type === 'output_text')
            .map((x) => x.text)
            .join('')
          return { code: 0, text }
        }
      }
      const result = await runPipeline({ adapter, kind: payload.task, payload, cfg: {}, model: env.OPENAI_MODEL })
      if (capped) return json(429, { code: 'cap' })
      if (!result.ok) return json(200, { ok: false, errorClass: result.errorClass || 'unusable' })
      return json(200, result)
    } catch (error) {
      return json(503, { code: error.name === 'TimeoutError' ? 'timeout' : 'provider' })
    } finally {
      busy = false
    }
  }
}
