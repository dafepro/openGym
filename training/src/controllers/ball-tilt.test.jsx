// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import useBallTilt from './useBallTilt.js'

const orientation = (beta, gamma) =>
  window.dispatchEvent(Object.assign(new Event('deviceorientation'), { beta, gamma }))
beforeEach(() => {
  vi.stubGlobal('isSecureContext', true)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

it('requests sensors only on enable, calibrates first reading and disconnects on disable', async () => {
  const requestPermission = vi.fn(async () => 'granted')
  vi.stubGlobal('DeviceOrientationEvent', { requestPermission })
  const remove = vi.spyOn(window, 'removeEventListener')
  const { result, unmount } = renderHook(useBallTilt)
  expect(requestPermission).not.toHaveBeenCalled()
  await act(() => result.current.enable())
  expect(requestPermission).toHaveBeenCalledTimes(1)
  act(() => orientation(20, 4))
  expect(result.current.status).toBe('active')
  expect(result.current.read(performance.now()).x).toBe(0)
  act(() => orientation(20, 18))
  expect(result.current.read(performance.now()).x).toBeGreaterThan(0)
  act(() => result.current.calibrate())
  expect(result.current.read(performance.now()).x).toBe(0)
  act(() => result.current.disable())
  act(() => orientation(20, 30))
  expect(result.current.read(performance.now()).x).toBe(0)
  expect(remove).toHaveBeenCalledWith('deviceorientation', expect.any(Function))
  unmount()
})

it('falls back when permission is denied or no sensor readings arrive', async () => {
  vi.stubGlobal('DeviceOrientationEvent', { requestPermission: async () => 'denied' })
  const { result } = renderHook(useBallTilt)
  await act(() => result.current.enable())
  expect(result.current.status).toBe('denied')
  vi.stubGlobal('DeviceOrientationEvent', {})
  vi.useFakeTimers()
  await act(() => result.current.enable())
  expect(result.current.status).toBe('waiting')
  act(() => vi.advanceTimersByTime(3000))
  expect(result.current.status).toBe('unavailable')
})

it('ignores permission arriving after the game closes', async () => {
  let resolve
  vi.stubGlobal('DeviceOrientationEvent', {
    requestPermission: () =>
      new Promise((done) => {
        resolve = done
      })
  })
  const add = vi.spyOn(window, 'addEventListener')
  const { result, unmount } = renderHook(useBallTilt)
  let pending
  act(() => {
    pending = result.current.enable()
  })
  unmount()
  await act(async () => {
    resolve('granted')
    await pending
  })
  expect(add).not.toHaveBeenCalledWith('deviceorientation', expect.any(Function))
})

it('ignores stale readings and settles back to zero inside the neutral zone', async () => {
  vi.stubGlobal('DeviceOrientationEvent', {})
  const { result } = renderHook(useBallTilt)
  await act(() => result.current.enable())
  act(() => orientation(0, 0))
  act(() => orientation(0, 18))
  expect(result.current.read(performance.now()).x).toBeGreaterThan(0)
  expect(result.current.read(performance.now() + 501)).toEqual({ x: 0, y: 0 })
  act(() => {
    for (let i = 0; i < 20; i++) orientation(0, 0)
  })
  expect(result.current.read(performance.now()).x).toBe(0)
})

it('ignores permission arriving after pause disables tilt', async () => {
  let resolve
  vi.stubGlobal('DeviceOrientationEvent', {
    requestPermission: () =>
      new Promise((done) => {
        resolve = done
      })
  })
  const { result } = renderHook(useBallTilt)
  let pending
  act(() => {
    pending = result.current.enable()
  })
  act(() => result.current.disable())
  await act(async () => {
    resolve('granted')
    await pending
  })
  expect(result.current.status).toBe('off')
  act(() => orientation(0, 18))
  expect(result.current.read(performance.now())).toMatchObject({ x: 0, y: 0 })
})
