/* Provider-independent snapshot replication. Providers expose read({signal}),
 * append(state, {signal}), and compact(sourceIds, {signal}). append MUST create
 * an immutable, verified snapshot, never overwrite a file another client can write.
 * Compaction may delete only snapshots read before that append. Concurrent writes
 * therefore survive as separate heads and join on the next pass. */
import { mergeStates } from './sync-merge.js'

const LOCAL = new Set(['_watch', 'active', '_rev', '_wid', '_wids', '_unstamped', '_prior'])
export function cloudState(state) {
  return Object.fromEntries(Object.entries(state || {}).filter(([key]) => !LOCAL.has(key)))
}
function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, ordered(value[k])]))
  return value
}
// Editing an in-progress session changes _ts but cannot trigger cloud uploads.
// The per-field edit/deletion/reset stamps are content and must travel too.
export const cloudContent = state => JSON.stringify(ordered({ ...cloudState(state), _ts: 0 }))
export const cloudError = code => Object.assign(new Error(code), { code })

export async function syncSnapshots(provider, { getState, apply, current, signal }) {
  const check = () => { if (signal?.aborted || !current()) throw cloudError('cancelled') }
  check()
  const sources = await provider.read({ signal })
  check()
  let remote = null
  for (const snapshot of [...sources].sort((a, b) => a.id.localeCompare(b.id))) {
    remote = mergeStates(remote, snapshot.state, { deterministic: true })
  }
  if (remote) { apply(remote); check() }
  // Re-read after applying, so edits made during the GET and the local active
  // workout are dealt with by the store rather than by a captured stale copy.
  const state = structuredClone(cloudState(getState()))
  const content = cloudContent(state)
  const needsWrite = !remote || content !== cloudContent(remote) || sources.length > 1
  if (needsWrite) {
    await provider.append(state, { signal })
    check()
    // Failure here only leaves redundant snapshots; it cannot unsave this write.
    try { await provider.compact?.(sources.map(s => s.id), { signal }) } catch { /* redundant heads are safe */ }
    check()
  }
  return { pending: content !== cloudContent(getState()), content }
}
