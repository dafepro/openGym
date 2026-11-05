// @vitest-environment happy-dom
import { StrictMode, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Dialog from './Dialog.jsx'

// Virtual-DOM integration covers our lock/focus lifecycle. Actual native modal
// hit testing and animation remain part of the separately run browser suite.
function Harness() {
  const [parent, setParent] = useState(false)
  const [child, setChild] = useState(false)
  return <><button onClick={() => setParent(true)}>Open practice</button>{parent && <Dialog title="Practice plan" onClose={() => setParent(false)}><button onClick={() => setChild(true)}>Open filters</button>{child && <Dialog title="Filters" onClose={() => setChild(false)}><button onClick={() => { setParent(false); setChild(false) }}>Leave both sheets</button></Dialog>}</Dialog>}</>
}

beforeEach(() => {
  document.body.style.overflow = 'clip'
  vi.spyOn(window, 'matchMedia').mockImplementation(() => ({ matches: true }))
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); document.body.style.overflow = '' })

describe('modal lifecycle and focus recovery', () => {
  it('restores the original scroll lock and page focus when nested sheets unmount parent-first', async () => {
    const user = userEvent.setup()
    render(<StrictMode><Harness/></StrictMode>)
    const opener = screen.getByRole('button', { name: 'Open practice' })
    await user.click(opener)
    expect(document.body.style.overflow).toBe('hidden')
    await user.click(screen.getByRole('button', { name: 'Open filters' }))
    expect(document.querySelectorAll('dialog[open]')).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Leave both sheets' }))
    expect(document.querySelectorAll('dialog')).toHaveLength(0)
    expect(document.body.style.overflow).toBe('clip')
    expect(document.activeElement).toBe(opener)
    // A second cycle catches a leaked shared lock from StrictMode or nesting.
    await user.click(opener)
    await user.click(screen.getByRole('button', { name: 'Close dialog' }))
    expect(document.body.style.overflow).toBe('clip')
    expect(document.activeElement).toBe(opener)
  })
  it('keeps the page locked when only the inner sheet closes and returns focus inside its parent', async () => {
    const user = userEvent.setup()
    render(<Harness/>)
    await user.click(screen.getByRole('button', { name: 'Open practice' }))
    const trigger = screen.getByRole('button', { name: 'Open filters' })
    await user.click(trigger)
    const child = screen.getByRole('dialog', { name: 'Filters' })
    await user.click(within(child).getByRole('button', { name: 'Close dialog' }))
    expect(document.querySelectorAll('dialog[open]')).toHaveLength(1)
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.activeElement).toBe(trigger)
  })
  it('does not drop the lock early or schedule multiple closes during its exit animation', () => {
    vi.useFakeTimers()
    window.matchMedia.mockReturnValue({ matches: false })
    render(<Harness/>)
    fireEvent.click(screen.getByRole('button', { name: 'Open practice' }))
    const close = screen.getByRole('button', { name: 'Close dialog' })
    fireEvent.click(close); fireEvent.click(close)
    expect(screen.getByRole('dialog').getAttribute('aria-busy')).toBe('true')
    expect(document.body.style.overflow).toBe('hidden')
    act(() => vi.advanceTimersByTime(179))
    expect(document.querySelectorAll('dialog[open]')).toHaveLength(1)
    act(() => vi.advanceTimersByTime(1))
    expect(document.querySelectorAll('dialog')).toHaveLength(0)
    expect(document.body.style.overflow).toBe('clip')
  })
})
