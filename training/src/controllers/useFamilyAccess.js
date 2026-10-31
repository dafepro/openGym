import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createFamilyMutations, fetchFamilyCatalog, fetchFamilySession } from './family-access.js'

export default function useFamilyAccess() {
  const [authenticated, setAuthenticated] = useState(false)
  const [catalog, setCatalog] = useState(null)
  const catalogCache = useRef(null)
  const [status, setStatus] = useState('checking')
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [expiresAt, setExpiresAt] = useState(null)
  const [pending, setPending] = useState(false)
  const pendingCount = useRef(0)
  const serial = useRef(0)
  const mutations = useMemo(() => createFamilyMutations(), [])
  const clearPrivateAccess = useCallback(() => {
    setAuthenticated(false); catalogCache.current = null; setCatalog(null); setExpiresAt(null); setNotice(null)
  }, [])

  const check = useCallback(async ({ refreshCatalog = true } = {}) => {
    if (pendingCount.current) return false
    const requestId = ++serial.current
    setStatus('checking'); setError(null)
    try {
      const session = await fetchFamilySession()
      if (serial.current !== requestId) return false
      if (!session.authenticated) { clearPrivateAccess(); setStatus('required'); return false }
      const content = refreshCatalog || !catalogCache.current ? await fetchFamilyCatalog() : null
      if (serial.current !== requestId) return false
      if (content) { catalogCache.current = content; setCatalog(content) }
      setAuthenticated(true); setExpiresAt(session.expiresAt || null); setStatus('ready')
      return true
    } catch (failure) {
      if (serial.current !== requestId) return false
      clearPrivateAccess(); setError(failure.message); setStatus(failure.status === 401 ? 'required' : 'unavailable')
      return false
    }
  }, [clearPrivateAccess])

  useEffect(() => { void check(); return () => { serial.current++ } }, [check])
  useEffect(() => {
    if (!authenticated) return
    const visible = () => { if (document.visibilityState === 'visible') void check({ refreshCatalog: false }) }
    document.addEventListener('visibilitychange', visible)
    const interval = setInterval(visible, 60000)
    const expiry = expiresAt ? setTimeout(() => { clearPrivateAccess(); void check({ refreshCatalog: false }) }, Math.max(0, Math.min(2147483647, expiresAt - Date.now()))) : null
    return () => { document.removeEventListener('visibilitychange', visible); clearInterval(interval); clearTimeout(expiry) }
  }, [authenticated, check, clearPrivateAccess, expiresAt])

  const mutate = async (type, key) => {
    const operationId = ++serial.current
    pendingCount.current++; setPending(true); setError(null)
    if (type === 'logout') { clearPrivateAccess(); setStatus('signing-out'); setNotice(null) }
    else if (type === 'login') setStatus('signing-in')
    let failure
    try { await mutations[type](key) } catch (caught) { failure = caught }
    finally { pendingCount.current--; setPending(pendingCount.current > 0) }
    if (operationId !== serial.current) return
    if (failure) {
      clearPrivateAccess(); setError(failure.message); setStatus(failure.status === 503 ? 'unavailable' : 'required')
      return
    }
    if (type === 'logout') { setStatus('required'); return }
    if (await check({ refreshCatalog: type === 'login' }) && type === 'renew') setNotice('Family access renewed.')
  }
  return { authenticated, catalog, status, error, notice, pending, check, login: key => mutate('login', key), logout: () => mutate('logout'), renew: () => mutate('renew') }
}
