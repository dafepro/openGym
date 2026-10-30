import { authConfig, authRoute, sessionOf } from './auth.js'
import { loadCatalog } from './catalog.js'
import { json, privateHeaders, safeId } from './http.js'
import { mediaResponse } from './media.js'

const publicAsset = path => ['/', '/index.html', '/source.html', '/fonts/barlow-condensed-latin-600.woff2', '/fonts/OFL.txt', '/licenses/AGPL-3.0.txt'].includes(path) || /^\/assets\/[a-zA-Z0-9_-]+\.(js|css|woff2|svg|png)$/.test(path)

async function routeRequest(request, env, now) {
  const url = new URL(request.url)
  const path = url.pathname
  try {
    if (path === '/api/health' && request.method === 'GET') return json({ app: 'quicktrack-training', ok: true })
    const protectedPath = path.startsWith('/api/auth/') || path === '/api/catalog' || path.startsWith('/media/')
    if (protectedPath) {
      const config = authConfig(env)
      if (url.origin !== config.origin) return json({ error: 'wrong_origin' }, 403)
      if (path.startsWith('/api/auth/')) return await authRoute(request, env, config, path, now)
      if (!await sessionOf(request, env, config, now)) return json({ error: 'authentication_required' }, 401)
      if (!['GET', 'HEAD'].includes(request.method)) return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET, HEAD' })
      const selected = await loadCatalog(env)
      if (path === '/api/catalog') {
        const response = json(selected.catalog)
        return request.method === 'HEAD' ? new Response(null, response) : response
      }
      const id = path.slice('/media/'.length)
      if (!safeId(id) || url.search || !selected.media.has(id)) return json({ error: 'not_found' }, 404)
      return await mediaResponse(request, env, selected.media.get(id))
    }
    if (path.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method) || !publicAsset(path) || url.search) return json({ error: 'not_found' }, 404)
    if (typeof env.ASSETS?.fetch !== 'function') return json({ error: 'service_unavailable' }, 503)
    const assetRequest = path === '/' ? new Request(new URL('/index.html', url), request) : request
    const asset = await env.ASSETS.fetch(assetRequest)
    const headers = privateHeaders(Object.fromEntries(asset.headers))
    headers.set('Cache-Control', 'private, no-store, max-age=0, no-transform')
    headers.set('Vary', 'Cookie')
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' blob:; media-src 'self' blob:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")
    headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    return new Response(request.method === 'HEAD' ? null : asset.body, { status: asset.status, headers })
  } catch {
    // Do not expose private object keys, hashes, access values or service errors in logs.
    return json({ error: 'service_unavailable' }, 503)
  }
}

export async function handleRequest(request, env, now = Date.now()) {
  const response = await routeRequest(request, env, now)
  return request.method === 'HEAD' ? new Response(null, response) : response
}

export default { fetch(request, env) { return handleRequest(request, env) } }
