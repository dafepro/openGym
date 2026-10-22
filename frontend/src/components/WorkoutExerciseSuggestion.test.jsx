// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WorkoutExerciseSuggestion from './WorkoutExerciseSuggestion.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { registerCustom } from '../lib/exercises.js'
import { bindUI } from './ui.jsx'

vi.mock('../lib/exercises.js', async (original) => ({ ...(await original()), allExercises: (s) => s.customEx }))
vi.mock('../lib/sound.js', () => ({
  beep: vi.fn(),
  chime: vi.fn(),
  vibrate: vi.fn(),
  alertBuzz: vi.fn(),
  unlock: vi.fn()
}))
globalThis.IS_REACT_ACT_ENVIRONMENT = true
bindUI(useUI)
const NOW = Date.UTC(2026, 9, 22, 12)
const catalog = [
  { id: 'suggest-chest', n: 'Push-up', bp: 'chest', eq: 'body weight', muscleWeights: { chest: 1 } },
  { id: 'suggest-legs', n: 'Bodyweight squat', bp: 'upper legs', eq: 'body weight', muscleWeights: { quadriceps: 1 } },
  { id: 'suggest-db', n: 'Dumbbell biceps curl', bp: 'upper arms', eq: 'dumbbell', muscleWeights: { biceps: 1 } }
]
let roots, host, onPick, close, onBrowse
const click = (label, node = host) => {
  const button = [...node.querySelectorAll('button')].find((b) => b.textContent.trim() === label)
  expect(button, label).toBeTruthy()
  act(() => button.click())
  return button
}
function mount(element) {
  const node = document.createElement('div')
  document.body.append(node)
  const root = createRoot(node)
  roots.push([root, node])
  act(() => root.render(element))
  return node
}
function render(extra = {}) {
  const S = { ...structuredClone(DEF), customEx: structuredClone(catalog), routines: [], workouts: [], ...extra }
  S.active = { id: 'suggestion-session', start: NOW - 10 * 60000, cur: 0, entries: [], ...extra.active }
  registerCustom(S.customEx)
  useStore.setState({ S, user: null })
  host = mount(<WorkoutExerciseSuggestion {...{ onPick, close, onBrowse }} />)
}
const name = () => host.querySelector('.suggestion-name h2')?.textContent
beforeEach(() => {
  roots = []
  onPick = vi.fn()
  close = vi.fn()
  onBrowse = vi.fn()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  localStorage.clear()
  useUI.setState({ sheets: [], timer: null, work: null })
})
afterEach(() => {
  for (const [root, node] of roots.reverse()) {
    act(() => root.unmount())
    node.remove()
  }
  registerCustom([])
  vi.clearAllTimers()
  vi.useRealTimers()
})
describe('live exercise suggestion', () => {
  it('starts without filters, shows a dose, does not mutate training and never repeats an alternative', () => {
    render()
    const before = JSON.stringify(useStore.getState().S)
    expect(host.textContent).toContain('Any muscle')
    expect(host.querySelector('.suggestion-dose').textContent).toContain('2 × 10')
    const seen = new Set([name()])
    for (let i = 0; i < 2; i++) {
      click('Another')
      expect(seen.has(name())).toBe(false)
      seen.add(name())
    }
    click('Another')
    expect(host.textContent).toContain('All options seen')
    expect(click('Add').disabled).toBe(true)
    click('Start over')
    expect(seen.has(name())).toBe(true)
    expect(JSON.stringify(useStore.getState().S)).toBe(before)
  })
  it('uses the shared optional muscle selector and does not broaden an empty result', () => {
    render()
    const selectMuscle = (label) => {
      act(() => host.querySelector('.lrow').click())
      const sheet = useUI.getState().sheets.at(-1)
      const selector = mount(sheet.render(() => useUI.getState().closeSheet(sheet.id)))
      click(label, selector)
    }
    selectMuscle('Quads')
    expect(name()).toBe('Bodyweight squat')
    click('Another')
    expect(host.textContent).toContain('All options seen')
    selectMuscle('Any muscle')
    expect(name()).not.toBe('Bodyweight squat')
    selectMuscle('Quads')
    expect(host.textContent).toContain('All options seen')
    click('Start over')
    expect(name()).toBe('Bodyweight squat')
  })
  it('previews personalized load and rest; Add commits the exact visible configuration', () => {
    render({
      customEx: [catalog[2]],
      routines: [{ id: 'r', ex: [{ id: catalog[2].id, sets: 4, reps: 8, weight: 15, restSec: 180 }] }],
      dumbbells: { kg: { weights: [10, 15, 20] } }
    })
    expect(host.querySelector('.suggestion-dose').textContent).toContain('2 × 8')
    expect(host.querySelector('.suggestion-prescription').textContent).toContain('15 kg')
    expect(host.querySelector('.suggestion-prescription').textContent).toContain('3:00')
    click('Add')
    expect(close).toHaveBeenCalledOnce()
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ id: catalog[2].id }),
      true,
      expect.objectContaining({ sets: 2, reps: 8, weight: 15, restSec: 180 })
    )
  })
  it('asks for an unknown weight, exposes details on demand, and keeps Browse available', () => {
    render({ customEx: [catalog[2]] })
    expect(host.textContent).toContain('Choose weight')
    click('Add')
    expect(onPick.mock.calls[0][1]).toBe(false)
    act(() => host.querySelector('[aria-label="Why this exercise?"]').click())
    expect(host.textContent).toContain('Estimates from logged training')
    click('Details')
    expect(onPick.mock.calls[1][1]).toBe(false)
    click('Browse exercises')
    expect(onBrowse).toHaveBeenCalledOnce()
  })
  it('reacts to equipment changes and closes a stale session without adding to the new one', () => {
    render({ customEx: [catalog[2]] })
    act(() =>
      useStore.setState(({ S }) => ({
        S: {
          ...S,
          equipFilterOn: true,
          activeEquipId: 'home',
          equipProfiles: [{ id: 'home', name: 'Home', accV: 1, equipment: [] }]
        }
      }))
    )
    expect(host.textContent).toContain('Home')
    expect(host.textContent).toContain('No suitable suggestion')
    act(() => useStore.setState(({ S }) => ({ S: { ...S, active: { ...S.active, id: 'new-session' } } })))
    expect(close).toHaveBeenCalledOnce()
    expect(host.textContent).toBe('')
    expect(onPick).not.toHaveBeenCalled()
  })
})

it('pre-fills a recent imported exercise so Add does not open an empty setup form', () => {
  render({
    customEx: [catalog[2]],
    unit: 'lb',
    workouts: [
      {
        start: NOW - 86400000,
        source: 'StrongLifts',
        entries: [
          {
            id: catalog[2].id,
            sets: [
              { w: 15, r: 12, done: true, u: 'lb' },
              { w: 15, r: 12, done: true, u: 'lb' }
            ]
          }
        ]
      }
    ]
  })
  expect(host.querySelector('.suggestion-dose').textContent).toContain('2 × 12')
  expect(host.querySelector('.suggestion-prescription').textContent).toContain('15 lb')
  click('Add')
  expect(onPick).toHaveBeenCalledWith(
    expect.objectContaining({ id: catalog[2].id }),
    true,
    expect.objectContaining({ sets: 2, reps: 12, weight: 15 })
  )
})
