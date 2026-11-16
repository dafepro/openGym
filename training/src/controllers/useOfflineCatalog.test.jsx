// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { syntheticCatalog } from '../../fixtures/catalog.js'
import { emptyProgress } from '../storage/index.js'
import { writeCatalogCache, CATALOG_CACHE_KEY } from '../storage/catalog-cache.js'
import useOfflineCatalog from './useOfflineCatalog.js'

const controller = { ready: true, progress: emptyProgress() }
afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})
it('opens the saved library immediately while a slow network request is still pending', () => {
  writeCatalogCache(window.localStorage, syntheticCatalog, 1)
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {}))
  )
  const { result } = renderHook(() => useOfflineCatalog(controller, 'test'))
  expect(result.current.catalog).toEqual(syntheticCatalog)
  expect(result.current.source).toBe('saved')
  expect(result.current.checking).toBe(true)
})
it('times out an unreachable first request without destroying local data', async () => {
  vi.useFakeTimers()
  window.localStorage.setItem(CATALOG_CACHE_KEY, '{damaged')
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_url, options) =>
        new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(Error('aborted'))))
    )
  )
  const { result } = renderHook(() => useOfflineCatalog(controller, 'test'))
  await act(() => vi.advanceTimersByTimeAsync(8001))
  expect(result.current.checking).toBe(false)
  expect(result.current.catalog).toBeNull()
  expect(result.current.error).toContain('unavailable')
  expect(window.localStorage.getItem(CATALOG_CACHE_KEY)).toBe('{damaged')
})
it('a malformed server catalog cannot replace a previously validated offline copy', async () => {
  writeCatalogCache(window.localStorage, syntheticCatalog, 1)
  const previous = window.localStorage.getItem(CATALOG_CACHE_KEY)
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ assignments: [] }))
  )
  const { result } = renderHook(() => useOfflineCatalog(controller, 'test'))
  await waitFor(() => expect(result.current.checking).toBe(false))
  expect(result.current.catalog).toEqual(syntheticCatalog)
  expect(window.localStorage.getItem(CATALOG_CACHE_KEY)).toBe(previous)
})
