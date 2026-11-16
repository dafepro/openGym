import { useEffect, useState } from 'react'
import { fetchTrainingCatalog } from './training-catalog.js'
import { readCatalogCache, recoveryCatalog, writeCatalogCache } from '../storage/catalog-cache.js'

export default function useOfflineCatalog(controller, databaseName) {
  const [state, setState] = useState(() => {
    try {
      const cached = readCatalogCache(window.localStorage)
      if (cached) return { ...cached, source: 'saved', checking: true }
    } catch {
      /* A damaged cache never prevents local progress recovery. */
    }
    return { catalog: null, source: 'none', checking: true }
  })
  const [attempt, setAttempt] = useState(0)
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const connected = () => {
      setOnline(true)
      setAttempt((value) => value + 1)
    }
    const disconnected = () => setOnline(false)
    window.addEventListener('online', connected)
    window.addEventListener('offline', disconnected)
    return () => {
      window.removeEventListener('online', connected)
      window.removeEventListener('offline', disconnected)
    }
  }, [])
  useEffect(() => {
    const abort = new AbortController()
    let disposed = false
    const timeout = setTimeout(() => abort.abort(), 8000)
    setState((previous) => ({ ...previous, checking: true, error: null }))
    fetchTrainingCatalog(fetch, abort.signal)
      .then((catalog) => {
        if (disposed) return
        let cacheError = null
        try {
          writeCatalogCache(window.localStorage, catalog)
        } catch {
          cacheError = 'The library could not be kept for offline use on this device.'
        }
        setState({ catalog, source: 'live', savedAt: Date.now(), checking: false, cacheError })
      })
      .catch(() => {
        if (!disposed)
          setState((previous) => ({ ...previous, checking: false, error: 'The latest library is unavailable.' }))
      })
      .finally(() => clearTimeout(timeout))
    return () => {
      disposed = true
      clearTimeout(timeout)
      abort.abort()
    }
  }, [attempt])
  useEffect(() => {
    if (state.catalog || !controller.ready) return
    let storage
    try {
      storage = window.localStorage
    } catch {
      storage = { getItem: () => null }
    }
    const catalog = recoveryCatalog(controller.progress, storage, databaseName)
    if (catalog) setState((previous) => (previous.catalog ? previous : { ...previous, catalog, source: 'recovered' }))
  }, [state.catalog, controller.ready, controller.progress, databaseName])
  return { ...state, online, retryToken: attempt, retry: () => setAttempt((value) => value + 1) }
}
