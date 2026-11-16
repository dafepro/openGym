// @vitest-environment happy-dom
import React from 'react'
import { afterEach, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import AssignmentsView from './AssignmentsView.jsx'
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
const record = {
  id: 'assignment',
  revision: 0,
  status: 'pending',
  coachEmail: 'coach@example.com',
  practice: { id: 'p', revision: 'v1', title: 'Close control', drills: [] }
}
it('requires explicit acceptance before offering start or submission', async () => {
  const fetcher = vi.fn(async (url, options) =>
    Response.json(options?.method === 'POST' ? { ok: true } : { records: [record] })
  )
  vi.stubGlobal('fetch', fetcher)
  render(<AssignmentsView coach={false} practices={[]} sessions={[]} onStart={() => {}} />)
  await screen.findByText('Close control')
  expect(screen.queryByText('Start practice')).toBeNull()
  fireEvent.click(screen.getByText('Accept assignment'))
  await waitFor(() => expect(fetcher.mock.calls.some(([, o]) => o?.method === 'POST')).toBe(true))
  const request = fetcher.mock.calls.find(([, o]) => o?.method === 'POST')[1]
  expect(JSON.parse(request.body)).toEqual({ id: 'assignment', revision: 0, action: 'accept' })
})
it('keeps sign-in failures recoverable without exposing records', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ error: 'Sign in required' }, { status: 401 }))
  )
  render(<AssignmentsView coach={false} practices={[]} sessions={[]} onStart={() => {}} />)
  await screen.findByText('Continue with Google')
  expect(screen.getByText('Continue with Google').getAttribute('href')).toBe('/api/player/login')
  expect(screen.queryByText('Close control')).toBeNull()
})

it('removes loaded records when the account expires', async () => {
  let expired = false
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      expired ? Response.json({ error: 'Sign in required' }, { status: 401 }) : Response.json({ records: [record] })
    )
  )
  render(<AssignmentsView sessions={[]} />)
  await screen.findByText('Close control')
  expired = true
  fireEvent.click(screen.getByRole('button', { name: 'Refresh assignments' }))
  await screen.findByText('Continue with Google')
  expect(screen.queryByText('Close control')).toBeNull()
})
