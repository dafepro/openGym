import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchFamilyCatalog, fetchFamilySession, loginFamily, logoutFamily, renewFamily } from './family-access.js'

export default function useFamilyAccess() {
  const [authenticated, setAuthenticated] = useState(false)
  const [catalog, setCatalog] = useState(null)
  const [status, setStatus] = useState('checking')
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [expiresAt, setExpiresAt] = useState(null)
  const serial = useRef(0)

  const check = useCallback(async ({ refreshCatalog = true } = {}) => {
    const requestId = ++serial.current
    setStatus('checking'); setError(null)
    try {
      const session = await fetchFamilySession()
      if (serial.current !== requestId) return
      if (!session.authenticated) { setAuthenticated(false); setStatus('required'); setExpiresAt(null); return false }
      const content = refreshCatalog ? await fetchFamilyCatalog() : null
      if (serial.current !== requestId) return
      if (content) setCatalog(content)
      setAuthenticated(true); setExpiresAt(session.expiresAt || null); setStatus('ready')
      return true
    } catch (failure) {
      if (serial.current !== requestId) return
      setAuthenticated(false); setError(failure.message); setStatus(failure.status === 401 ? 'required' : 'unavailable')
      return false
    }
  }, [])

  useEffect(() => { void check(); return () => { serial.current++ } }, [check])
  useEffect(() => {
    if (!authenticated) return
    const visible = () => { if (document.visibilityState === 'visible') void check({ refreshCatalog: false }) }
    document.addEventListener('visibilitychange', visible)
    const interval = setInterval(visible, 60000)
    const expiry = expiresAt ? setTimeout(() => { setAuthenticated(false); void check({ refreshCatalog: false }) }, Math.max(0, Math.min(2147483647, expiresAt - Date.now()))) : null
    return () => { document.removeEventListener('visibilitychange', visible); clearInterval(interval); clearTimeout(expiry) }
  }, [authenticated, check, expiresAt])

  const login = async key => {
    setStatus('signing-in'); setError(null)
    try { await loginFamily(key); await check() }
    catch (failure) { setAuthenticated(false); setError(failure.message); setStatus(failure.status === 503 ? 'unavailable' : 'required') }
  }
  const logout = async () => {
    try { await logoutFamily(); serial.current++; setAuthenticated(false); setStatus('required'); setNotice(null) }
    catch (failure) { setNotice(failure.message) }
  }
  const renew = async () => {
    try { await renewFamily(); if (await check({ refreshCatalog: false })) setNotice('Family access renewed.') }
    catch (failure) { setAuthenticated(false); setStatus('required'); setError(failure.message) }
  }
  return { authenticated, catalog, status, error, notice, check, login, logout, renew }
}
