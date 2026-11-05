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

const drillPayload = ({ id, media, ...drill }) => ({ ...drill, media: { id: media.id } })
const serialize = value => new TextEncoder().encode(JSON.stringify(canonical(value)))
const targets = ['mode', 'sets', 'reps', 'durationSec', 'side', 'restSec']
const core = drill => JSON.stringify(canonical(Object.fromEntries(Object.entries(drill).filter(([key]) => !targets.includes(key)))))
async function dictionary(catalog) {
  const drills = catalog.assignments.flatMap(item => item.drills).map(drillPayload)
  return { drills, hash: await digest(serialize(drills)) }
}
async function archive(revision) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(revision)) throw new Error('Invalid catalog edition.')
  const response = await fetch(`/api/catalogs/${revision}`, { credentials: 'same-origin' })
  if (!response.ok) throw new Error('This catalog edition is unavailable. Ask your coach for a new link.')
  const reader = response.body.getReader(); let size = 0; const chunks = []
  try { while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 1048576) throw new Error('Catalog too large.'); chunks.push(value) } }
  finally { await reader.cancel().catch(() => {}) }
  return JSON.parse(await new Blob(chunks).text())
}

// IDs belong to the content, so independently shared copies have the same identity.
// Compression bytes may differ across browsers; identity is the uncompressed content hash.
// The payload carries custom instructions and prescriptions without a lookup service.
export async function createPracticeCode(assignment, origin = window.location.origin, catalog) {
  const checked = validateAssignment(assignment)
  const payload = { title: checked.title, note: checked.note, drills: checked.drills.map(drillPayload) }
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(payload)))
  if (bytes.length > MAX_BYTES) throw new Error('This practice is too large to share.')
  const identity = await digest(bytes)
  let version = 'QT2', encoded = bytes
  if (catalog) {
    const dict = await dictionary(catalog)
    let references = 0
    const drills = payload.drills.map(drill => {
      const index = dict.drills.findIndex(candidate => core(candidate) === core(drill))
      if (index < 0) return drill
      references++
      const overrides = {}
      for (const key of targets) if (drill[key] !== dict.drills[index][key]) overrides[key] = drill[key] ?? null
      return Object.keys(overrides).length ? [index, overrides] : [index]
    })
    if (references) { version = 'QT3'; encoded = serialize({ c: [catalog.revision, dict.hash], t: payload.title, ...(payload.note ? { n: payload.note } : {}), d: drills }) }
  }
  const packed = await transform(encoded, new CompressionStream('deflate'))
  const code = `${version}.${encodeBytes(packed)}.${identity}`
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
    if (!['https:', 'http:'].includes(url.protocol) || !url.hash.startsWith('#/shared/')) throw new Error('Use a QuickTrack practice link or a code starting QT2 or QT3.')
    return url.hash.slice('#/shared/'.length)
  }
  return text.replace(/\s/g, '')
}

export async function readPracticeCode(input, catalog, loadArchive = archive) {
  const code = extractPracticeCode(input)
  if (!code.startsWith('QT')) return decodePractice(code, catalog)
  if (code.length > MAX_CODE_LENGTH) throw new Error('This practice code is too long.')
  const match = /^QT[23]\.([A-Za-z0-9_-]+)\.([a-f0-9]{32})$/.exec(code)
  if (!match) throw new Error('This practice code is incomplete or uses a newer version. Ask for the complete link.')
  let payload
  try {
    const bytes = await transform(decodeBytes(match[1]), new DecompressionStream('deflate'))
    if (code.startsWith('QT2.') && await digest(bytes) !== match[2]) throw new Error('Checksum mismatch')
    payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch { throw new Error('This practice code is damaged or too large. Ask for a new copy.') }
  if (code.startsWith('QT3.')) {
    if (!payload || Object.keys(payload).some(key => !['c', 't', 'n', 'd'].includes(key)) || !Array.isArray(payload.c) || payload.c.length !== 2 || !Array.isArray(payload.d) || payload.d.length > 100) throw new Error('Invalid reference practice.')
    const edition = payload.c[0] === catalog.revision ? catalog : await loadArchive(payload.c[0])
    const dict = await dictionary(edition)
    if (edition.revision !== payload.c[0] || dict.hash !== payload.c[1]) throw new Error('This catalog edition has changed. Ask your coach for a new link.')
    const drills = payload.d.map(entry => {
      if (!Array.isArray(entry)) return entry
      if (entry.length < 1 || entry.length > 2 || !Number.isInteger(entry[0]) || !dict.drills[entry[0]]) throw new Error('Unknown drill reference.')
      const changes = entry[1] || {}
      if (typeof changes !== 'object' || Array.isArray(changes) || Object.keys(changes).some(key => !targets.includes(key))) throw new Error('Invalid drill targets.')
      const drill = structuredClone(dict.drills[entry[0]])
      for (const [key, value] of Object.entries(changes)) { if (value === null) delete drill[key]; else drill[key] = value }
      // restSec=null is a meaningful prescription, rather than an absent field.
      if (Object.hasOwn(changes, 'restSec')) drill.restSec = changes.restSec
      return drill
    })
    payload = { title: payload.t, ...(payload.n ? { note: payload.n } : {}), drills }
    if (await digest(serialize(payload)) !== match[2]) throw new Error('This practice code is damaged. Ask for a new copy.')
  }
  if (!payload || Object.keys(payload).some(key => !['title', 'note', 'drills'].includes(key)) || !Array.isArray(payload.drills)) throw new Error('This practice code has unsupported content.')
  const available = new Map(catalog.assignments.flatMap(item => item.drills).filter(drill => drill.media.status === 'approved').map(drill => [drill.media.id, drill.media]))
  const assignment = validateAssignment({ ...payload, id: `shared-${match[2]}`, revision: 'qt2', status: 'current', drills: payload.drills.map((drill, index) => {
    if (!drill || !drill.media || Object.keys(drill.media).some(key => key !== 'id')) throw new Error('This practice code has unsupported media.')
    return { ...drill, id: `drill-${index + 1}`, media: available.get(drill.media.id) || { id: drill.media.id, status: 'unavailable' } }
  }) })
  return assignment
}
