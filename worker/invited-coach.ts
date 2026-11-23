const site = 'https://uplift.quicktrack.cc'
const base = '/api/invited-coach/'
const origin = 'https://uplift-coach-origin.quicktrack.cc'
export async function invitedCoach(request: Request, fetcher: typeof fetch = fetch) {
  const url = new URL(request.url)
  const action = url.pathname.slice(base.length)
  const fail = (status: number) => Response.json({ ok: false }, { status, headers: { 'Cache-Control': 'no-store' } })
  if (url.origin !== site || url.search || !['login', 'session', 'run'].includes(action)) return fail(404)
  if (request.method !== (action === 'run' ? 'POST' : 'GET')) return fail(405)
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion')
  if (!jwt) return fail(403)
  if (
    action === 'run' &&
    (request.headers.get('Origin') !== site || request.headers.get('Content-Type') !== 'application/json')
  )
    return fail(403)
  const headers: Record<string, string> = { 'Cf-Access-Jwt-Assertion': jwt }
  if (action === 'run') Object.assign(headers, { Origin: site, 'Content-Type': 'application/json' })
  try {
    const response = await fetcher(origin + base + (action === 'login' ? 'session' : action), {
      method: request.method,
      headers,
      body: action === 'run' ? request.body : undefined,
      redirect: 'error'
    })
    if (action === 'login' && response.ok)
      return new Response(null, { status: 303, headers: { Location: site + '/#/coach', 'Cache-Control': 'no-store' } })
    if (!response.headers.get('Content-Type')?.includes('application/json')) return fail(503)
    return new Response(response.body, {
      status: response.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    })
  } catch {
    return fail(503)
  }
}
