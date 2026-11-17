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
  click('Original unit'); expect(host.querySelectorAll('input:checked')).toHaveLength(0)
  click('Review imported stretch'); expect(host.querySelectorAll('input:checked')).toHaveLength(1)
  click('Preview conversion'); expect(host.textContent).toContain('201.94 lb'); expect(mock.S.bodyweight[0].w).toBe(91.6)
  click('Back'); expect(mock.S.bodyweight[0].w).toBe(91.6)
  click('Preview conversion'); click('Confirm conversion'); render()
  expect(mock.S.bodyweight.map(d => d.w)).toEqual([201.94, 197.5]); expect(host.textContent).not.toContain('Confirm conversion')
  click('Undo'); render(); expect(mock.S.bodyweight.map(d => d.w)).toEqual([91.6, 197.5])
  click('Close'); expect(close).toHaveBeenCalledOnce()
})
it('rejects data changed after preview and closing does not convert', () => {
  click('Original unit'); click('Review imported stretch'); click('Preview conversion')
  mock.S.bodyweight[0].w = 92; render(); click('Confirm conversion')
  expect(mock.S.bodyweight[0].w).toBe(92); expect(host.querySelector('[role=alert]')).not.toBeNull()
  click('Close'); expect(mock.S.bodyweight[0].w).toBe(92)
})
