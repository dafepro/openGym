import { createServer } from 'node:http'
import { Readable } from 'node:stream'
import { existsSync, mkdirSync, chmodSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import worker from '../worker.js'
import { json } from '../../worker/http.js'
import { installationTokenProvider } from './github-app.mjs'
import { CoachStore } from './storage.mjs'

export function validateConfig(env) {
  if (
    env.APP_ORIGIN !== 'https://train.quicktrack.cc' ||
    env.COACH_GITHUB_REPOSITORY !== 'dafepro/openGym' ||
    !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(
      env.COACH_ACCESS_ISSUER || '',
    ) ||
    !env.COACH_ACCESS_AUD ||
    !env.COACH_ALLOWED_EMAILS?.trim() ||
    !env.OPENAI_MODEL ||
    !env.OPENAI_API_KEY ||
    !(
      env.COACH_GITHUB_TOKEN ||
      (env.COACH_GITHUB_APP_PRIVATE_KEY_B64 &&
        env.COACH_GITHUB_APP_ID &&
        env.COACH_GITHUB_INSTALLATION_ID)
    ) ||
    (env.COACH_READY_SECRET || '').length < 32 ||
    env.COACH_ORIGIN_HOST !== 'coach-origin.quicktrack.cc'
  )
    throw new Error('Coach server configuration is incomplete or invalid')
  if (!/^[a-f0-9]{40}$/.test(env.APP_SOURCE_SHA || ''))
    throw new Error('Exact source SHA required')
}

export function createCoachServer(
  env,
  { filename, now = Date.now, paused = () => false } = {},
) {
  if (env.COACH_GITHUB_APP_PRIVATE_KEY_B64)
    env.COACH_GITHUB_ACCESS_TOKEN = installationTokenProvider(
      env,
      env.TEST_FETCH || fetch,
    )
  const store = new CoachStore(filename, env, { now })
  env.COACH_REQUESTS = store
  env.COACH_PAUSED = paused
  const upstream = env.TEST_FETCH || fetch
  env.TEST_FETCH = (url, options) => {
    store.lease()
    if (paused()) throw new Error('Coach service paused')
    return upstream(url, options)
  }
  let closing = false,
    unhealthy = false,
    windowStart = now(),
    count = 0,
    active = 0
  const server = createServer(
    { maxHeaderSize: 16384, requestTimeout: 15000, headersTimeout: 10000 },
    async (req, res) => {
      let response
      try {
        if (req.url === '/healthz' && req.method === 'GET') {
          response = json(
            { ok: !closing && !unhealthy, build: env.APP_SOURCE_SHA },
            closing || unhealthy ? 503 : 200,
          )
        } else {
          if (now() - windowStart >= 60000) {
            windowStart = now()
            count = 0
          }
          if (++count > 300 || active >= 16)
            response = json(
              { error: 'Please wait before trying again.' },
              429,
              { 'Retry-After': '60' },
            )
          else if (closing || unhealthy)
            response = json({ error: 'Service restarting.' }, 503)
          else if (
            req.headers.host?.split(':')[0] !== env.COACH_ORIGIN_HOST ||
            !/^\/api\/coach\/(config|login|requests|ready\/[a-f0-9]{64}\/[a-f0-9-]{36})$/.test(
              req.url || '',
            ) ||
            !['GET', 'POST'].includes(req.method)
          )
            response = json({ error: 'not_found' }, 404)
          else if (req.method === 'POST' && paused())
            response = json({ error: 'Coach requests are paused.' }, 503)
          else {
            active++
            try {
              // The public origin is fixed, never derived from Forwarded headers.
              const request = new Request(env.APP_ORIGIN + req.url, {
                method: req.method,
                headers: req.headers,
                ...(req.method === 'POST'
                  ? { body: Readable.toWeb(req), duplex: 'half' }
                  : {}),
              })
              response = await worker.fetch(request, env)
            } finally {
              active--
            }
          }
        }
      } catch {
        response = json({ error: 'Service temporarily unavailable.' }, 503)
      }
      res.writeHead(response.status, Object.fromEntries(response.headers))
      res.end(Buffer.from(await response.arrayBuffer()))
    },
  )
  server.keepAliveTimeout = 5000
  server.maxRequestsPerSocket = 100
  server.maxConnections = 128
  let timer
  const heartbeat = setInterval(() => {
    try {
      store.lease()
    } catch {
      unhealthy = true
    }
  }, 10000)
  heartbeat.unref()
  return {
    server,
    store,
    startJobs() {
      timer = setInterval(() => {
        if (!closing && !unhealthy && !paused())
          void store.tick().catch(() => {
            unhealthy = true
          })
      }, 1000)
      timer.unref()
    },
    async close() {
      closing = true
      clearInterval(timer)
      // Let a started paid call finish and checkpoint; Docker allows six minutes.
      await new Promise((resolveClose) => server.close(resolveClose))
      while (store.running) await new Promise((done) => setTimeout(done, 25))
      clearInterval(heartbeat)
      store.close()
    },
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    process.umask(0o077)
    const env = { ...process.env }
    validateConfig(env)
    const filename = env.COACH_DATABASE || '/data/coach.sqlite'
    mkdirSync(dirname(filename), { recursive: true, mode: 0o700 })
    const app = createCoachServer(env, {
      filename,
      paused: () => existsSync(resolve(dirname(filename), 'PAUSED')),
    })
    chmodSync(filename, 0o600)
    app.server.listen(Number(env.PORT || 8787), '0.0.0.0', () =>
      console.log('Coach server ready'),
    )
    app.startJobs()
    let stopping = false
    const stop = () => {
      if (!stopping) {
        stopping = true
        void app.close().then(() => process.exit(0))
      }
    }
    process.on('SIGTERM', stop)
    process.on('SIGINT', stop)
  } catch {
    console.error(
      'Coach server could not start; check configuration and database ownership.',
    )
    process.exitCode = 1
  }
}
