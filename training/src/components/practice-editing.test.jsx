// @vitest-environment happy-dom
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PracticeReview from './PracticeReview.jsx'

const drill = (id, title, durationSec) => ({ id, title, instructions: 'Keep the ball close.', mode: 'time', sets: 2, durationSec, side: 'both', restSec: 10, media: { id, status: 'unavailable' } })
const initial = { id: null, title: 'My touch practice', note: 'Keep it close.', drills: [drill('one', 'Close touches', 30), drill('two', 'Turns', 45)] }
function Editor() {
  const [draft, setDraft] = useState(initial)
  return <PracticeReview draft={draft} onChange={setDraft} onNew={() => setDraft({ ...draft, title: '', drills: [] })} onAdd={() => setDraft({ ...draft, drills: [...draft.drills, drill('three', 'New drill', 20)] })} onPreview={() => {}}/>
}
beforeEach(() => { vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true }) })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('organizer correction without losing edited targets', () => {
  it('restores the exact removed target and order after an edited drill is moved', async () => {
    const user = userEvent.setup()
    render(<Editor/>)
    await user.click(screen.getByRole('button', { name: 'Edit Close touches', exact: true }))
    const seconds = screen.getByRole('spinbutton', { name: 'Seconds per set', exact: true })
    await user.clear(seconds); await user.type(seconds, '75')
    await user.click(screen.getByRole('button', { name: 'Move Close touches down', exact: true }))
    await user.click(screen.getByRole('button', { name: 'Remove Close touches', exact: true }))
    expect(screen.queryByRole('button', { name: 'Edit Close touches', exact: true })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Undo', exact: true }))
    const rows = [...document.querySelectorAll('[data-drill]')]
    expect(rows.map(row => row.dataset.drill)).toEqual(['two', 'one'])
    expect(within(rows[1]).getByText('2 × 1 min 15 sec', { exact: true })).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Edit Close touches', exact: true }))
    expect(screen.getByRole('textbox', { name: /Note for the player/ }).value).toBe('Keep it close.')
  })
  it('drops stale removal recovery once a different sequence is chosen', async () => {
    const user = userEvent.setup()
    render(<Editor/>)
    await user.click(screen.getByRole('button', { name: 'Edit Turns', exact: true }))
    await user.click(screen.getByRole('button', { name: 'Remove Turns', exact: true }))
    expect(screen.getByRole('button', { name: 'Undo', exact: true })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Add drill', exact: true }))
    expect(screen.queryByRole('button', { name: 'Undo', exact: true })).toBeNull()
    expect(screen.getByRole('button', { name: 'Edit New drill', exact: true })).toBeTruthy()
  })
})
