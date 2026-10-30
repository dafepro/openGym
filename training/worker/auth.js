import { HASH, digest, json, readLimited, safeId } from './http.js'

export const COOKIE = '__Host-quicktrack-training'
const MAX_AGE = 7 * 24 * 60 * 60
const encode = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
const decode = value => Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), char => char.charCodeAt(0))
const keyBytes = hex => Uint8Array.from(hex.match(/../g), byte => parseInt(byte, 16))

export function authConfig(env) {
  const origin = new URL(env.APP_ORIGIN)
  const ttl = Number(env.SESSION_TTL_SECONDS || 43200)
  if (origin.protocol !== 'https:' || origin.origin !== env.APP_ORIGIN || !HASH.test(env.FAMILY_ACCESS_SHA256) ||
    !HASH.test(env.SESSION_SIGNING_KEY) || !safeId(env.SESSION_EPOCH) || !Number.isInteger(ttl) || ttl < 900 || ttl > MAX_AGE ||
    typeof env.LOGIN_LIMIT?.limit !== 'function') throw new Error('Family access unavailable')
  return { origin: origin.origin, ttl, epoch: env.SESSION_EPOCH }
}

const signingKey = env => crypto.subtle.importKey('raw', keyBytes(env.SESSION_SIGNING_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])

export async function sessionOf(request, env, config, now = Date.now()) {
  const cookies = (request.headers.get('Cookie') || '').split(';').map(value => value.trim()).filter(value => value.startsWith(COOKIE + '='))
  if (cookies.length !== 1) return null
  const token = cookies[0].slice(COOKIE.length + 1)
  if (token.length > 1500 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return null
  try {
    const [payload, signature] = token.split('.')
    const valid = await crypto.subtle.verify('HMAC', await signingKey(env), decode(signature), new TextEncoder().encode(payload))
    if (!valid) return null
    const data = JSON.parse(new TextDecoder().decode(decode(payload)))
    const seconds = Math.floor(now / 1000)
    if (data.v !== 1 || data.epoch !== config.epoch || !Number.isInteger(data.iat) || !Number.isInteger(data.exp) ||
      data.iat > seconds || data.exp <= seconds || data.exp <= data.iat || data.exp - data.iat > MAX_AGE || !safeId(data.id)) return null
    return data
  } catch { return null }
}

async function issue(env, config, now, prior = null) {
  const seconds = Math.floor(now / 1000)
  const iat = prior?.iat ?? seconds
  const exp = Math.min(seconds + config.ttl, iat + MAX_AGE)
  if (exp <= seconds) return json({ error: 'authentication_required' }, 401)
  const data = { v: 1, iat, exp, epoch: config.epoch, id: crypto.randomUUID() }
  const payload = encode(new TextEncoder().encode(JSON.stringify(data)))
  const signature = encode(new Uint8Array(await crypto.subtle.sign('HMAC', await signingKey(env), new TextEncoder().encode(payload))))
  return json({ authenticated: true, expiresAt: exp * 1000 }, 200, {
    'Set-Cookie': `${COOKIE}=${payload}.${signature}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${exp - seconds}`
  })
}

async function limitLogin(request, env) {
  // One family-wide key also bounds distributed guesses within each edge location.
  const peer = request.headers.get('CF-Connecting-IP') || 'local-unknown'
  const perPeer = await env.LOGIN_LIMIT.limit({ key: 'training-login-peer:' + await digest(peer) })
  const family = await env.LOGIN_LIMIT.limit({ key: 'training-family-login' })
  if (typeof perPeer?.success !== 'boolean' || typeof family?.success !== 'boolean') throw new Error('Rate limiter unavailable')
  return perPeer.success && family.success
}

export async function authRoute(request, env, config, path, now = Date.now()) {
  if (path === '/api/auth/session' && request.method === 'GET') {
    const session = await sessionOf(request, env, config, now)
    return json(session ? { authenticated: true, expiresAt: session.exp * 1000 } : { authenticated: false })
  }
  if (!['/api/auth/login', '/api/auth/logout', '/api/auth/renew'].includes(path) || request.method !== 'POST') return json({ error: 'not_found' }, 404)
  if (request.headers.get('Origin') !== config.origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') return json({ error: 'wrong_origin' }, 403)
  if (path === '/api/auth/logout') return json({ authenticated: false }, 200, {
    'Set-Cookie': `${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`
  })
  if (!await limitLogin(request, env)) return json({ error: 'try_later' }, 429, { 'Retry-After': '60' })
  if (path === '/api/auth/renew') {
    const prior = await sessionOf(request, env, config, now)
    return prior ? issue(env, config, now, prior) : json({ error: 'authentication_required' }, 401)
  }
  if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') return json({ error: 'invalid_request' }, 400)
  let input
  try { input = JSON.parse(new TextDecoder().decode(await readLimited(request.body, 512))) } catch { return json({ error: 'invalid_request' }, 400) }
  if (!input || Object.keys(input).length !== 1 || typeof input.accessKey !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(input.accessKey)) return json({ error: 'invalid_access_key' }, 401)
  const submitted = await digest(input.accessKey)
  let difference = 0
  for (let index = 0; index < 64; index++) difference |= submitted.charCodeAt(index) ^ env.FAMILY_ACCESS_SHA256.charCodeAt(index)
  return difference === 0 ? issue(env, config, now) : json({ error: 'invalid_access_key' }, 401)
}
