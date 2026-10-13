export const DRIVE_IMPORT_SCOPE = 'https://www.googleapis.com/auth/drive.readonly'
const MAX_BYTES = 5 * 1024 * 1024
export function driveFileId(value) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || !['drive.google.com', 'docs.google.com'].includes(url.hostname)) throw new Error('Paste a Google Drive file link.')
  const id = /\/d\/([a-zA-Z0-9_-]+)/.exec(url.pathname)?.[1] || url.searchParams.get('id')
  if (!/^[a-zA-Z0-9_-]{10,200}$/.test(id || '')) throw new Error('Paste a Google Drive file link.')
  return id
}
export async function readDriveImport(id, auth, { signal, fetcher = fetch } = {}) {
  if (!/^[a-zA-Z0-9_-]{10,200}$/.test(id) || Date.now() >= auth.expiresAt - 30000) throw new Error('Reconnect Google Drive.')
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true }); if (signal?.aborted) abort()
  const timeout = setTimeout(abort, 30000)
  async function read(query) {
    const response = await fetcher('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) + query, {
      credentials: 'omit', redirect: 'error', signal: controller.signal, headers: { Authorization: 'Bearer ' + auth.token }
    })
    if (!response.ok) throw new Error('Could not read the Drive file. Check its link and Google account.')
    if (+response.headers.get('Content-Length') > MAX_BYTES) throw new Error('That file is too large. Maximum 5 MB.')
    const reader = response.body?.getReader(), decoder = new TextDecoder()
    if (!reader) { const text = await response.text(); if (new TextEncoder().encode(text).length > MAX_BYTES) throw new Error('That file is too large. Maximum 5 MB.'); return text }
    let text = '', bytes = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return text + decoder.decode()
      bytes += value.byteLength
      if (bytes > MAX_BYTES) { await reader.cancel(); throw new Error('That file is too large. Maximum 5 MB.') }
      text += decoder.decode(value, { stream: true })
    }
  }
  try {
    const meta = JSON.parse(await read('?fields=id,name,mimeType,size,trashed'))
    if (meta.id !== id || meta.trashed || +meta.size > MAX_BYTES) throw new Error('Could not read the Drive file. Check its link and Google account.')
    // Imported plans and app CSV exports are ordinary files. Do not silently
    // export only the first tab of a multi-sheet training spreadsheet.
    if (meta.mimeType?.startsWith('application/vnd.google-apps.')) throw new Error('Download this sheet as CSV first, then choose the exported file.')
    const text = await read('?alt=media')
    return new File([text], meta.name || 'drive-import.json', { type: meta.mimeType || 'text/plain' })
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort) }
}
