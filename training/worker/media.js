import { privateHeaders } from './http.js'

export function byteRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header)
  if (!match || !match[1] && !match[2]) return null
  const first = match[1] === '' ? null : Number(match[1])
  const last = match[2] === '' ? null : Number(match[2])
  if (first != null && !Number.isSafeInteger(first) || last != null && !Number.isSafeInteger(last)) return null
  if (first === null) return last > 0 ? { offset: Math.max(0, size - last), length: Math.min(last, size) } : null
  const end = last === null ? size - 1 : Math.min(last, size - 1)
  return first < size && end >= first ? { offset: first, length: end - first + 1 } : null
}

function matchesObject(object, media) {
  return object && object.size === media.byteLength && object.httpMetadata?.contentType === media.contentType && object.customMetadata?.sha256 === media.sha256
}

export async function mediaResponse(request, env, media) {
  const key = 'media/' + media.id
  const head = await env.TRAINING_CONTENT.head(key)
  if (!head) return new Response(null, { status: 404, headers: privateHeaders() })
  if (!matchesObject(head, media)) throw new Error('Media metadata mismatch')
  const etag = head.httpEtag
  if (typeof etag !== 'string' || typeof head.etag !== 'string') throw new Error('Media metadata unavailable')
  const headers = privateHeaders({ 'Content-Type': media.contentType, 'Accept-Ranges': 'bytes', 'ETag': etag })
  const notModified = request.headers.get('If-None-Match')?.split(',').map(value => value.trim().replace(/^W\//, '')).some(value => value === '*' || value === etag)
  if (notModified) return new Response(null, { status: 304, headers })
  let range = null
  const rangeHeader = request.method === 'GET' ? request.headers.get('Range') : null
  const ifRange = request.headers.get('If-Range')
  if (rangeHeader && (!ifRange || ifRange === etag)) {
    range = byteRange(rangeHeader, head.size)
    if (!range) { headers.set('Content-Range', `bytes */${head.size}`); return new Response(null, { status: 416, headers }) }
  }
  headers.set('Content-Length', String(range?.length ?? head.size))
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers })
  const stored = await env.TRAINING_CONTENT.get(key, { onlyIf: { etagMatches: head.etag }, ...(range ? { range } : {}) })
  if (!stored?.body || stored.etag !== head.etag || !matchesObject(stored, media)) throw new Error('Media changed during read')
  if (range) headers.set('Content-Range', `bytes ${range.offset}-${range.offset + range.length - 1}/${head.size}`)
  return new Response(stored.body, { status: range ? 206 : 200, headers })
}
