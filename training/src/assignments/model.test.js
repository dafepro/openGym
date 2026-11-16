import { createStartedSession, reduceSession } from '../domain/session.js'
import { describe, it, expect } from 'vitest'
import { createAssignment, changeAssignment } from './model.js'
const practice = {
  id: 'p',
  revision: 'v1',
  title: 'Practice',
  status: 'current',
  drills: [
    {
      id: 'd',
      title: 'Drill',
      instructions: 'Practice',
      mode: 'reps',
      sets: 1,
      reps: 4,
      side: 'both',
      restSec: 0,
      media: { id: 'demo', status: 'unavailable' }
    }
  ]
}
describe('assignment authorization and version lifecycle', () => {
  it('requires acceptance and optimistic concurrency', () => {
    const record = createAssignment({ email: 'Player@example.com', practice }, 'coach')
    expect(record.email).toBe('player@example.com')
    expect(() => changeAssignment(record, { action: 'accept', revision: 0 }, 'coach')).toThrow()
    const accepted = changeAssignment(record, { action: 'accept', revision: 0 }, 'player')
    expect(accepted.status).toBe('accepted')
    expect(record.status).toBe('pending')
    expect(() => changeAssignment(accepted, { action: 'accept', revision: 0 }, 'player')).toThrow(/changed/)
    expect(() => changeAssignment(record, { action: 'submit', revision: 0 }, 'player')).toThrow()
  })
})

it('only sends finished work of the pinned version, and preserves it through review', () => {
  let record = createAssignment({ email: 'player@example.com', practice }, 'coach', 100)
  record = changeAssignment(record, { action: 'accept', revision: 0 }, 'player', 200)
  let session = createStartedSession(practice, { id: 'session', now: 300 })
  expect(() => changeAssignment(record, { action: 'submit', revision: 1, session }, 'player')).toThrow()
  session = reduceSession(session, {
    type: 'DONE',
    id: 'done',
    sessionId: session.id,
    rowId: session.currentRowId,
    actual: 2,
    now: 400
  })
  session = reduceSession(session, { type: 'FINISH', id: 'finish', sessionId: session.id, now: 500 })
  const submitted = changeAssignment(
    record,
    { action: 'submit', revision: 1, session, note: 'Two reps today' },
    'player',
    600
  )
  expect(submitted.result.rows[0].actual).toBe(2)
  expect(() =>
    changeAssignment(
      record,
      {
        action: 'submit',
        revision: 1,
        session: { ...session, assignment: { ...session.assignment, revision: 'v2' }, assignmentRevision: 'v2' }
      },
      'player'
    )
  ).toThrow()
  expect(() => changeAssignment(submitted, { action: 'review', revision: 2 }, 'player')).toThrow()
  const reviewed = changeAssignment(
    submitted,
    { action: 'review', revision: 2, comment: 'Repeat tomorrow' },
    'coach',
    700
  )
  expect(reviewed.result).toEqual(submitted.result)
  expect(reviewed.status).toBe('reviewed')
})
