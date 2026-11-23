export const hostedCoach = () =>
  import.meta.env.VITE_LOCAL_ONLY === '1' && globalThis.location?.origin === 'https://uplift.quicktrack.cc'
export async function invitedSession() {
  const response = await fetch('/api/invited-coach/session', {
    credentials: 'same-origin',
    redirect: 'manual',
    cache: 'no-store',
    signal: AbortSignal.timeout(12000)
  })
  if (response.type === 'opaqueredirect' || [401, 403].includes(response.status)) return false
  if (!response.ok) throw Error('unavailable')
  return (await response.json()).invited === true
}
export async function hostedAttempt(payload) {
  try {
    const r = await fetch('/api/invited-coach/run', {
      method: 'POST',
      credentials: 'same-origin',
      redirect: 'manual',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(100000)
    })
    if (r.type === 'opaqueredirect' || [401, 403].includes(r.status)) {
      globalThis.dispatchEvent(new Event('uplift-coach-sign-in'))
      return { ok: false, errorClass: 'auth' }
    }
    const data = await r.json()
    if (!r.ok) return { ok: false, errorClass: data.code || 'provider' }
    return data
  } catch (e) {
    return { ok: false, errorClass: e.name === 'TimeoutError' ? 'timeout' : 'unreachable' }
  }
}
