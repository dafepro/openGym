// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { stampChange } from '../lib/sync-merge.js'
import { ConvertWeighIns } from './ConvertWeighIns.jsx'
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const mock = vi.hoisted(() => ({ S: null }))
vi.mock('../store/useStore.js', () => {
  const state = () => ({ S: mock.S, update: fn => { const next = structuredClone(mock.S); fn(next); next._ts = stampChange(mock.S, next, Date.now()); mock.S = next } })
  const useStore = select => select(state())
  useStore.getState = state
  return { useStore }
})
let host, root, close, backup
const render = () => act(() => root.render(<ConvertWeighIns close={close} onBackup={backup} />))
const click = text => act(() => [...host.querySelectorAll('button')].find(b => text === 'Back' ? b.textContent === text : b.textContent.includes(text)).click())
beforeEach(() => {
  mock.S = { unit: 'lb', bodyweight: [{ d: '2026-09-15', w: 91.6, t: 1, src: 'import' }, { d: '2026-11-16', w: 197.5, t: 2 }] }
  close = vi.fn(); backup = vi.fn(); host = document.createElement('div'); document.body.append(host); root = createRoot(host); render()
})
afterEach(() => { act(() => root.unmount()); host.remove() })
it('requires selection, reviews imported stretch, backs out, confirms once and undoes exact values', () => {
  expect([...host.querySelectorAll('button')].find(b => b.textContent === 'Preview conversion').disabled).toBe(true)
  click('Back up first'); expect(backup).toHaveBeenCalledOnce()
  click('kg → lb'); expect(host.querySelectorAll('[role=checkbox][aria-checked=true]')).toHaveLength(0)
  click('Review imported stretch'); expect(host.querySelectorAll('[role=checkbox][aria-checked=true]')).toHaveLength(1)
  click('Preview conversion'); expect(host.textContent).toContain('201.94 lb'); expect(mock.S.bodyweight[0].w).toBe(91.6)
  click('Back'); expect(mock.S.bodyweight[0].w).toBe(91.6)
  click('Preview conversion'); click('Confirm conversion'); render()
  expect(mock.S.bodyweight.map(d => d.w)).toEqual([201.94, 197.5]); expect(host.textContent).not.toContain('Confirm conversion')
  click('Undo'); render(); expect(mock.S.bodyweight.map(d => d.w)).toEqual([91.6, 197.5])
  click('Close'); expect(close).toHaveBeenCalledOnce()
})
it('rejects data changed after preview and closing does not convert', () => {
  click('kg → lb'); click('Review imported stretch'); click('Preview conversion')
  mock.S.bodyweight[0].w = 92; render(); click('Confirm conversion')
  expect(mock.S.bodyweight[0].w).toBe(92); expect(host.querySelector('[role=alert]')).not.toBeNull()
  click('Close'); expect(mock.S.bodyweight[0].w).toBe(92)
})
it('clears selection on category change and converts one imported load without touching another', () => {
  mock.S.workouts = [{ id: 'iw123', d: '2026-09-10', name: 'Strength A', entries: [{ id: 'bench', sets: [{ w: 60, r: 5 }, { w: 135, r: 5 }] }] }, { id: 'manual-1', d: '2026-09-12', name: 'Manual', entries: [{ id: 'bench', sets: [{ w: 140, r: 5 }] }] }]
  render(); click('kg → lb'); click('Review imported stretch'); click('Workout loads')
  expect(host.querySelectorAll('[role=checkbox][aria-checked=true]')).toHaveLength(0)
  click('kg → lb'); expect(host.querySelectorAll('[role=checkbox]')).toHaveLength(2)
  act(() => host.querySelector('[role=checkbox]').click())
  click('Preview conversion'); expect(host.querySelectorAll('.unit-repair-record')).toHaveLength(1)
  expect(document.activeElement.textContent).toBe('Review your changes')
  click('Confirm conversion'); render()
  expect(mock.S.workouts[0].entries[0].sets[0].w).toBeCloseTo(132.277, 2)
  expect(mock.S.workouts[0].entries[0].sets[1].w).toBe(135)
  expect(mock.S.workouts[1].entries[0].sets[0].w).toBe(140)
  click('Undo'); render(); expect(mock.S.workouts[0].entries[0].sets.map(s => s.w)).toEqual([60, 135])
})
it('suggested workout groups remain editable and do not select manual sessions', () => {
  mock.S.workouts = [{ id: 'iw123', d: '2026-09-10', name: 'Strength A', entries: [{ id: 'bench', sets: [{ w: 60, r: 5 }, { w: 135, r: 5 }] }] }]
  render(); click('Workout loads'); click('kg → lb'); click('Strength A')
  expect(host.querySelectorAll('[role=checkbox][aria-checked=true]')).toHaveLength(2)
  act(() => host.querySelector('[role=checkbox]').click())
  expect(host.querySelectorAll('[role=checkbox][aria-checked=true]')).toHaveLength(1)
  click('Clear selection'); expect(host.querySelectorAll('[role=checkbox][aria-checked=true]')).toHaveLength(0)
})
it('protects newer edits when Undo cannot safely restore the snapshot', () => {
  click('kg → lb'); click('Review imported stretch'); click('Preview conversion'); click('Confirm conversion'); render()
  mock.S.bodyweight[0].w = 203; click('Undo'); render()
  expect(mock.S.bodyweight[0].w).toBe(203)
  expect([...host.querySelectorAll('button')].find(b => b.textContent === 'Undo').disabled).toBe(true)
  expect(host.querySelector('[role=alert]').textContent).toContain('newer edits')
})
it('shows honest empty states and only functional categories', () => {
  mock.S.workouts = []; render(); click('Workout loads'); click('kg → lb')
  expect(host.textContent).toContain('No eligible values found')
  expect([...host.querySelectorAll('button')].find(b => b.textContent === 'Preview conversion').disabled).toBe(true)
  expect(host.querySelectorAll('.seg button')).toHaveLength(2)
  expect(host.textContent).toContain('Measurements, distances, durations and routine targets')
})
it('blocks same-time readings from suggestion and selection', () => {
  mock.S.bodyweight = [{ d:'2026-09-15', w:91, ins:[{id:'a',at:100,w:91,t:1,src:'import'},{id:'b',at:100,w:92,t:2,src:'import'}]}]
  render(); click('kg → lb')
  expect(host.querySelectorAll('[role=checkbox]')).toHaveLength(0)
  expect(host.textContent).toContain('Same-time readings need individual review.')
  expect([...host.querySelectorAll('button')].find(b => b.textContent === 'Preview conversion').disabled).toBe(true)
})
it('cannot confirm a preview created under another profile unit', () => {
  click('kg → lb'); click('Review imported stretch'); click('Preview conversion')
  mock.S.unit = 'kg'; render(); click('Confirm conversion')
  expect(mock.S.bodyweight[0].w).toBe(91.6)
  expect(host.querySelector('[role=alert]')).not.toBeNull()
})
