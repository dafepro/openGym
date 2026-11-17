// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { importFromHevy } from './sheets.jsx'
import { importHevyData, parseHevyAccount } from './lib/import-hevy.js'

vi.mock('./lib/import-hevy.js', async importOriginal => {
  const actual = await importOriginal()
  return { ...actual, importHevyData: vi.fn(), parseHevyAccount: vi.fn(actual.parseHevyAccount) }
})
const exercise = { title: 'Lat Pulldown - Close Grip (Cable)', exercise_template_id: '4E5257DE', sets: [{ type: 'normal', weight_kg: 52, reps: 10 }] }
const RAW = {
  bodyMeasurements: [{ date: '2026-09-01', weight_kg: 80 }],
  templates: [],
  routines: [{ id: 'r1', title: 'Synthetic routine', exercises: [exercise] }],
  workouts: [{ id: 'w1', title: 'Synthetic session', start_time: '2026-09-01T10:00:00Z', end_time: '2026-09-01T11:00:00Z', exercises: [exercise] }],
}
const WARNING = 'Your weight unit changed. Go back and fetch your Hevy data again.'
let host, root
const button = label => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === label)
async function start() {
  act(() => importFromHevy())
  act(() => root.render(useUI.getState().sheets.at(-1).render(() => {})))
  const input = host.querySelector('input[type="password"]')
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'synthetic-test-key')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  // Enter follows the same fetch path as the primary button.
  await act(async () => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })) })
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.clearAllMocks()
  useUI.setState({ sheets: [], toastMsg: '' })
  useStore.setState(s => ({ S: { ...s.S, unit: 'kg', workouts: [], bodyweight: [], routines: [], customEx: [] } }))
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
  importHevyData.mockImplementation(async (_key, opts) => parseHevyAccount(RAW, opts))
})
afterEach(() => { act(() => root.unmount()); document.body.innerHTML = '' })

describe('Hevy preview unit safety', () => {
  it('imports normally when the profile unit is unchanged', async () => {
    await start()
    expect(importHevyData).toHaveBeenCalledOnce()
    expect(button('Import').disabled).toBe(false)
    act(() => button('Import').click())
    expect(useStore.getState().S.bodyweight[0].w).toBe(80)
    expect(useStore.getState().S.workouts[0].entries[0].sets[0].w).toBe(52)
    expect(useStore.getState().S.routines[0].ex[0].weight).toBe(52)
  })
  it('blocks a unit change after preview, without changing records', async () => {
    await start()
    act(() => useStore.setState(s => ({ S: { ...s.S, unit: 'lb' } })))
    expect(host.querySelector('[role="alert"]').textContent).toBe(WARNING)
    expect(button('Import').disabled).toBe(true)
    act(() => button('Import').click())
    expect(useStore.getState().S.bodyweight).toEqual([])
    expect(useStore.getState().S.workouts).toEqual([])
    expect(useStore.getState().S.routines).toEqual([])
  })
  it('captures the unit before the asynchronous fetch completes', async () => {
    let resolve
    importHevyData.mockImplementation((_key, opts) => new Promise(r => { resolve = () => r(parseHevyAccount(RAW, opts)) }))
    await start()
    act(() => useStore.setState(s => ({ S: { ...s.S, unit: 'lb' } })))
    await act(async () => resolve())
    expect(button('Import').disabled).toBe(true)
    expect(host.querySelector('[role="alert"]').textContent).toBe(WARNING)
    expect(useStore.getState().S.bodyweight).toEqual([])
    expect(useStore.getState().S.workouts).toEqual([])
    expect(useStore.getState().S.routines).toEqual([])
  })
  it('keeps choice reparsing in the original preview unit after a profile change', async () => {
    await start()
    act(() => useStore.setState(s => ({ S: { ...s.S, unit: 'lb' } })))
    act(() => host.querySelector('.imp-choices-h').click())
    const toggle = [...host.querySelectorAll('button')].find(b => b.getAttribute('aria-label')?.startsWith('Import '))
    expect(toggle).toBeTruthy()
    act(() => toggle.click())
    expect(parseHevyAccount.mock.calls.at(-1)[1].unit).toBe('kg')
    expect(button('Import').disabled).toBe(true)
    expect(useStore.getState().S.bodyweight).toEqual([])
  })
  it('rechecks at click time before a queued render can enable stale writes', async () => {
    await start()
    const commit = button('Import')
    act(() => {
      useStore.setState(s => ({ S: { ...s.S, unit: 'lb' } }))
      commit.click()
    })
    expect(useStore.getState().S.bodyweight).toEqual([])
    expect(useStore.getState().S.workouts).toEqual([])
    expect(useStore.getState().S.routines).toEqual([])
    expect(useUI.getState().toastMsg).toBe(WARNING)
  })
})
