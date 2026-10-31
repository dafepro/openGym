export const ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/
export const HASH = /^[a-f0-9]{64}$/
export const safeId = value => typeof value === 'string' && ID.test(value)

export function privateHeaders(extra = {}) {
  return new Headers({
    'Cache-Control': 'private, no-store, max-age=0',
    'Vary': 'Cookie',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Resource-Policy': 'same-origin',
    ...extra
  })
}

export function json(value, status = 200, extra = {}) {
  return new Response(JSON.stringify(value), { status, headers: privateHeaders({ 'Content-Type': 'application/json; charset=utf-8', ...extra }) })
}

export async function digest(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function readLimited(body, maximum) {
  if (!body) return new Uint8Array()
  const reader = body.getReader()
  const parts = []
  let length = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > maximum) { await reader.cancel(); throw new Error('Body too large') }
      parts.push(value)
    }
  } finally { reader.releaseLock() }
  const result = new Uint8Array(length)
  let offset = 0
  for (const part of parts) { result.set(part, offset); offset += part.byteLength }
  return result
}
