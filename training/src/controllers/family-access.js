import { validateCatalog } from '../domain/index.js'

export class FamilyAccessError extends Error {
  constructor(message, status) { super(message); this.name = 'FamilyAccessError'; this.status = status }
}

async function request(path, { method = 'GET', body } = {}, fetcher = fetch) {
  const response = await fetcher(path, { method, credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })
  if (!response.ok) {
    const message = response.status === 401 ? 'Family access is required. Ask a parent for the current access key.' : response.status === 429 ? 'Too many attempts. Wait a minute before trying again.' : response.status === 503 ? 'Family access is not ready on this server yet.' : 'Family access could not be checked. Please try again.'
    throw new FamilyAccessError(message, response.status)
  }
  try { return await response.json() } catch { throw new FamilyAccessError('The server returned an unsupported response. Please try again.', response.status) }
}

export async function fetchFamilySession(fetcher) {
  const session = await request('/api/auth/session', {}, fetcher)
  if (typeof session.authenticated !== 'boolean' || session.expiresAt != null && (!Number.isFinite(session.expiresAt) || session.expiresAt < 0)) throw new FamilyAccessError('The server returned an unsupported access response.', 502)
  return session
}
export async function fetchFamilyCatalog(fetcher) { return validateCatalog(await request('/api/catalog', {}, fetcher)) }
export function loginFamily(accessKey, fetcher) { return request('/api/auth/login', { method: 'POST', body: { accessKey } }, fetcher) }
export function logoutFamily(fetcher) { return request('/api/auth/logout', { method: 'POST', body: {} }, fetcher) }
export function renewFamily(fetcher) { return request('/api/auth/renew', { method: 'POST', body: {} }, fetcher) }
