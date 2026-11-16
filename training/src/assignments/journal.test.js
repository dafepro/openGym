import { it, expect } from 'vitest'
import { journalGroups, matchingSessions } from './journal.js'
it('keeps coaching relationships and immutable versions separate, including repeats with the same title', () => {
  const first = {
    id: 'first',
    coachEmail: 'coach@example.com',
    email: 'player@example.com',
    createdAt: 1,
    practice: { id: 'plan', revision: 'v1', title: 'Touches' }
  }
  const repeat = { ...first, id: 'repeat', createdAt: 2 }
  expect(
    journalGroups([
      first,
      repeat,
      { ...first, id: 'other-coach', coachEmail: 'other@example.com' },
      { ...first, id: 'other-player', email: 'other@example.com' },
      { ...first, id: 'new-version', practice: { ...first.practice, revision: 'v2' } }
    ]).map((group) => group.map((record) => record.id))
  ).toEqual([['repeat', 'first'], ['other-coach'], ['other-player'], ['new-version']])
  const oldSession = { id: 'session', status: 'partial', coachAssignmentId: first.id, assignment: first.practice }
  expect(matchingSessions(repeat, [oldSession])).toEqual([])
  expect(matchingSessions(first, [oldSession])).toEqual([oldSession])
})
