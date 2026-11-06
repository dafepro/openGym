// The tiny same-origin edge gateway holds no OpenAI/GitHub/provider credentials.
// Authentication is checked by Access before this route and again by the origin.
import { json, readLimited } from '../worker/http.js'
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (
      url.origin !== 'https://train.quicktrack.cc' ||
      url.search ||
      !/^\/api\/coach\/(config|login|requests|ready\/[a-f0-9]{64}\/[a-f0-9-]{36})$/.test(
        url.pathname,
      ) ||
      !['GET', 'POST'].includes(request.method)
    )
      return json({ error: 'not_found' }, 404)
    if (env.COACH_ORIGIN !== 'https://coach-origin.quicktrack.cc')
      return json({ error: 'Coach service setup pending.' }, 503)
    try {
      const headers = new Headers()
      for (const name of [
        'Cf-Access-Jwt-Assertion',
        'Origin',
        'Content-Type',
        'Sec-Fetch-Site',
        'X-QuickTrack-Timestamp',
        'X-QuickTrack-Signature',
      ]) {
        const value = request.headers.get(name)
        if (value) headers.set(name, value)
      }
      const response = await (env.TEST_FETCH || fetch)(
        env.COACH_ORIGIN + url.pathname,
        {
          method: request.method,
          headers,
          redirect: 'manual',
          ...(request.method === 'POST'
            ? { body: await readLimited(request.body, 16000) }
            : {}),
          signal: AbortSignal.timeout(25000),
        },
      )
      if (response.status >= 300 && response.status < 400) {
        if (
          url.pathname === '/api/coach/login' &&
          response.headers.get('Location') ===
            'https://train.quicktrack.cc/#/coach'
        )
          return Response.redirect('https://train.quicktrack.cc/#/coach', 303)
        return json({ error: 'Coach service unavailable.' }, 502)
      }
      const result = new Response(response.body, response)
      result.headers.set('Cache-Control', 'private, no-store')
      result.headers.delete('Set-Cookie')
      return result
    } catch {
      return json({ error: 'Coach service unavailable.' }, 503)
    }
  },
}
