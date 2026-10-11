import { cloudError, cloudState } from './cloud-sync.js'
import { sanitizeCustomMedia } from './backup-media.js'
import { validCloudState } from './cloud-schema.js'

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const MAX_BYTES = 5 * 1024 * 1024
const TAG = "appProperties has { key='opengymSync' and value='snapshot' }"
export const validClientId = id => /^\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(id || '')

let library = null
export function loadGoogleIdentity() {
  if (globalThis.google?.accounts?.oauth2) return Promise.resolve()
  if (library) return library
  library = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    const timer = setTimeout(() => fail(), 15000)
    function fail() { clearTimeout(timer); script.remove(); library = null; reject(cloudError('google-load')) }
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => { clearTimeout(timer); globalThis.google?.accounts?.oauth2 ? resolve() : fail() }
    script.onerror = fail
    document.head.appendChild(script)
  })
  return library
}

// Call synchronously from a tap after loadGoogleIdentity has finished: Google
// requires a user gesture. Tokens stay in memory and never enter localStorage/S.
export function authorizeDrive(clientId, scope = DRIVE_SCOPE) {
  if (!validClientId(clientId)) return Promise.reject(cloudError('client-id'))
  const oauth = globalThis.google?.accounts?.oauth2
  if (!oauth) return Promise.reject(cloudError('google-load'))
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(cloudError('google-timeout')), 120000)
    const fail = code => { clearTimeout(timer); reject(cloudError(code)) }
    const client = oauth.initTokenClient({
      client_id: clientId, scope, include_granted_scopes: false,
      callback: r => {
        clearTimeout(timer)
        if (r.error || !r.access_token || !oauth.hasGrantedAllScopes(r, scope)) return fail('google-denied')
        resolve({ token: r.access_token, expiresAt: Date.now() + Number(r.expires_in || 0) * 1000 })
      },
      error_callback: () => fail('google-popup'),
    })
    client.requestAccessToken({ prompt: 'select_account' })
  })
}

// No openGym API/Cloudflare headers here: only this Google token, sent to fixed
// Google origins. Fetch and body reads share one timeout; no session cookies.
export function googleDriveProvider({ token, expiresAt, fetcher = globalThis.fetch }) {
  const cache = new Map()
  async function request(path, { signal, upload = false, ...opts } = {}) {
    if (Date.now() >= expiresAt - 30000) throw cloudError('google-auth')
    const controller = new AbortController()
    const abort = () => controller.abort()
    if (signal?.aborted) abort()
    signal?.addEventListener('abort', abort, { once: true })
    const timer = setTimeout(abort, 30000)
    try {
      const response = await fetcher((upload ? UPLOAD : API) + path, {
        ...opts, credentials: 'omit', redirect: 'error', signal: controller.signal,
        headers: { ...opts.headers, Authorization: 'Bearer ' + token },
      })
      if (!response.ok) throw Object.assign(cloudError(response.status === 401 ? 'google-auth' : 'google-http'), { status: response.status })
      if (response.status === 204) return null
      // Drive metadata and state responses are bounded, even without Content-Length.
      const declared = Number(response.headers.get('Content-Length'))
      if (declared > MAX_BYTES) throw cloudError('google-size')
      const reader = response.body?.getReader()
      let body = ''
      if (reader) {
        const decoder = new TextDecoder(); let bytes = 0
        for (;;) {
          const { value, done } = await reader.read()
          if (done) { body += decoder.decode(); break }
          bytes += value.byteLength
          if (bytes > MAX_BYTES) { await reader.cancel(); throw cloudError('google-size') }
          body += decoder.decode(value, { stream: true })
        }
      } else { body = await response.text(); if (new TextEncoder().encode(body).length > MAX_BYTES) throw cloudError('google-size') }
      try { return JSON.parse(body) } catch { throw cloudError('google-data') }
    } catch (e) {
      if (signal?.aborted) throw cloudError('cancelled')
      if (e.code) throw e
      throw cloudError('google-network')
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort) }
  }
  const download = id => '/files/' + encodeURIComponent(id) + '?alt=media'
  function decode(value) {
    const s = value?.state
    if (value?.format !== 'opengym-sync' || value.version !== 1 || !validCloudState(s)) throw cloudError('google-data')
    return sanitizeCustomMedia(cloudState(s))
  }
  return {
    id: 'google-drive',
    async account({ signal } = {}) {
      const r = await request('/about?fields=user(permissionId,displayName,emailAddress)', { signal })
      if (!r?.user?.permissionId) throw cloudError('google-data')
      return { id: r.user.permissionId, label: r.user.emailAddress || r.user.displayName || 'Google Drive' }
    },
    async read({ signal } = {}) {
      const files = [], pages = new Set(); let page = ''
      do {
        const q = new URLSearchParams({ spaces: 'appDataFolder', q: 'trashed = false and ' + TAG,
          fields: 'nextPageToken,incompleteSearch,files(id,size)', pageSize: '1000', ...(page ? { pageToken: page } : {}) })
        const r = await request('/files?' + q, { signal })
        if (!Array.isArray(r.files) || r.incompleteSearch) throw cloudError('google-data')
        files.push(...r.files)
        if (files.length > 10000 || (r.nextPageToken && pages.has(r.nextPageToken))) throw cloudError('google-size')
        page = r.nextPageToken || ''; pages.add(page)
      } while (page)
      const out = []
      // Sequential reads keep memory and request pressure bounded. Nothing is
      // applied/uploaded if even one snapshot fails to download or validate.
      for (const file of files) {
        if (typeof file.id !== 'string' || +file.size > MAX_BYTES) throw cloudError('google-data')
        if (!cache.has(file.id)) cache.set(file.id, decode(await request(download(file.id), { signal })))
        out.push({ id: file.id, state: cache.get(file.id) })
      }
      const live = new Set(files.map(f => f.id))
      for (const id of cache.keys()) if (!live.has(id)) cache.delete(id)
      return out
    },
    async append(state, { signal } = {}) {
      const envelope = { format: 'opengym-sync', version: 1, state: cloudState(state) }
      if (!validCloudState(envelope.state)) throw cloudError('google-data')
      const json = JSON.stringify(envelope)
      if (new TextEncoder().encode(json).length > MAX_BYTES) throw cloudError('google-size')
      const boundary = 'opengym_' + crypto.randomUUID().replaceAll('-', '')
      const metadata = { name: 'opengym-sync-' + crypto.randomUUID() + '.json', parents: ['appDataFolder'], appProperties: { opengymSync: 'snapshot' }, mimeType: 'application/json' }
      const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`
      const r = await request('/files?uploadType=multipart&fields=id', { signal, upload: true, method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body })
      if (typeof r?.id !== 'string') throw cloudError('google-data')
      // Verify the bytes before allowing the coordinator to compact ancestors.
      const saved = await request(download(r.id), { signal })
      decode(saved)
      if (JSON.stringify(saved) !== json) throw cloudError('google-data')
      cache.set(r.id, decode(saved))
      return r.id
    },
    async compact(ids, { signal } = {}) {
      for (const id of ids) {
        await request('/files/' + encodeURIComponent(id), { signal, method: 'DELETE' }).catch(e => { if (e.status !== 404) throw e })
        cache.delete(id)
      }
    },
  }
}
