import { validateAssignment } from './content.js'
import { decodePractice } from './practice-builder.js'

export const MAX_CODE_LENGTH = 12000
const MAX_BYTES = 160000
const encodeBytes = bytes => btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
const decodeBytes = token => Uint8Array.from(atob(token.replaceAll('-', '+').replaceAll('_', '/')), char => char.charCodeAt(0))
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value
async function digest(bytes) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 32)
}
async function transform(bytes, stream) {
  const reader = new Blob([bytes]).stream().pipeThrough(stream).getReader()
  const chunks = []
  let length = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      length += value.length
      if (length > MAX_BYTES) throw new Error('This practice is too large. Ask for a smaller practice.')
      chunks.push(value)
    }
  } finally { await reader.cancel().catch(() => {}) }
  const result = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length }
  return result
}

// IDs belong to the content, so independently shared copies have the same identity.
// Compression bytes may differ across browsers; identity is the uncompressed content hash.
// The payload carries custom instructions and prescriptions without a lookup service.
export async function createPracticeCode(assignment, origin = window.location.origin) {
  const checked = validateAssignment(assignment)
  const payload = { title: checked.title, note: checked.note, drills: checked.drills.map(({ id, media, ...drill }) => ({ ...drill, media: { id: media.id } })) }
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(payload)))
  if (bytes.length > MAX_BYTES) throw new Error('This practice is too large to share.')
  const identity = await digest(bytes)
  const packed = await transform(bytes, new CompressionStream('deflate'))
  const code = `QT2.${encodeBytes(packed)}.${identity}`
  if (code.length > MAX_CODE_LENGTH) throw new Error('Shorten the instructions or share fewer drills.')
  const base = new URL(origin)
  if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password) throw new Error('Open the training site to share this practice.')
  return { code, identity, label: identity.slice(0, 12).toUpperCase().match(/.{4}/g).join('-'), link: `${base.origin}/#/shared/${code}` }
}

export function extractPracticeCode(input) {
  if (typeof input !== 'string' || input.length > MAX_CODE_LENGTH + 300) throw new Error('Paste a complete practice code or link.')
  const text = input.trim()
  if (text.includes('://')) {
    let url
    try { url = new URL(text) } catch { throw new Error('This practice link could not be read.') }
    if (!['https:', 'http:'].includes(url.protocol) || !url.hash.startsWith('#/shared/')) throw new Error('Use a QuickTrack practice link or a code starting QT2.')
    return url.hash.slice('#/shared/'.length)
  }
  return text.replace(/\s/g, '')
}

export async function readPracticeCode(input, catalog) {
  const code = extractPracticeCode(input)
  if (!code.startsWith('QT')) return decodePractice(code, catalog)
  if (code.length > MAX_CODE_LENGTH) throw new Error('This practice code is too long.')
  const match = /^QT2\.([A-Za-z0-9_-]+)\.([a-f0-9]{32})$/.exec(code)
  if (!match) throw new Error('This practice code is incomplete or uses a newer version. Ask for the complete link.')
  let payload
  try {
    const bytes = await transform(decodeBytes(match[1]), new DecompressionStream('deflate'))
    if (await digest(bytes) !== match[2]) throw new Error('Checksum mismatch')
    payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch { throw new Error('This practice code is damaged or too large. Ask for a new copy.') }
  if (!payload || Object.keys(payload).some(key => !['title', 'note', 'drills'].includes(key)) || !Array.isArray(payload.drills)) throw new Error('This practice code has unsupported content.')
  const available = new Map(catalog.assignments.flatMap(item => item.drills).filter(drill => drill.media.status === 'approved').map(drill => [drill.media.id, drill.media]))
  const assignment = validateAssignment({ ...payload, id: `shared-${match[2]}`, revision: 'qt2', status: 'current', drills: payload.drills.map((drill, index) => {
    if (!drill || !drill.media || Object.keys(drill.media).some(key => key !== 'id')) throw new Error('This practice code has unsupported media.')
    return { ...drill, id: `drill-${index + 1}`, media: available.get(drill.media.id) || { id: drill.media.id, status: 'unavailable' } }
  }) })
  return assignment
}
