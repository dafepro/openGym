import { describe, it, expect } from 'vitest'
import { isAssignedSession, localDay, newestSessions, playerHistory, sessionPracticeTime } from './player-history.js'
const now = new Date(2026, 9, 30, 12).getTime()
const row = values => ({ drillId: 'control', mode: 'practice', status: 'done', ...values })
const session = values => ({ id: 'session', status: 'completed', startedAt: now - 3600000, endedAt: now, rows: [], assignment: { drills: [{ id: 'control', metadata: { version: 1, registryVersion: 1, tags: ['futbol:control', 'futbol:ball-control', 'futbol:weak-foot'] } }] }, ...values })
describe('player history evidence', () => {
  it('totals measured work without wall time, rep counts, reviews or old unmeasured practice', () => {
    const record = session({ startedAt: 0, rows: [row({ practiceSeconds: 72.5 }), row({ mode: 'time', actual: 30, status: 'stopped' }), row({}), row({ mode: 'reps', actual: 20 }), row({ mode: 'watch', actual: 100 }), row({ practiceSeconds: 500, status: 'pending' })] })
    expect(sessionPracticeTime(record)).toEqual({ seconds: 102.5, measuredRows: 2, unmeasuredRows: 2 })
    expect(sessionPracticeTime(session({ rows: [row({})] }))).toEqual({ seconds: 0, measuredRows: 0, unmeasuredRows: 1 })
  })
  it('distinguishes measured zero from unknown and rejects malformed measurements', () => {
    expect(sessionPracticeTime(session({ rows: [row({ practiceSeconds: 0 })] }))).toEqual({ seconds: 0, measuredRows: 1, unmeasuredRows: 0 })
    expect(sessionPracticeTime(session({ rows: [row({ practiceSeconds: '60' }), row({ practiceSeconds: -1 }), row({ practiceSeconds: NaN })] }))).toEqual({ seconds: 0, measuredRows: 0, unmeasuredRows: 3 })
  })
  it('counts canonical skill exposure once per completed drill per saved session', () => {
    const records = [session({ rows: [row({ practiceSeconds: 60 }), row({ side: 'left' }), row({ side: 'right' }), row({ drillId: 'other', status: 'stopped' }), row({ drillId: 'review', mode: 'watch' })] }), session({ id: 'active', status: 'active', rows: [row({ practiceSeconds: 400 })] })]
    const stats = playerHistory(records, now)
    expect(stats.activeDays).toBe(1)
    expect(stats.periodSessions).toBe(1)
    expect(stats.completedDrills).toBe(1)
    expect(stats.skills).toEqual([{ tag: 'futbol:ball-control', label: 'ball control', count: 1 }, { tag: 'futbol:weak-foot', label: 'weak foot', count: 1 }])
    expect(stats.recentDays.at(-1).seconds).toBe(60)
  })
  it('does not count recorded zero work as skill exposure', () => {
    const stats = playerHistory([session({ rows: [row({ practiceSeconds: 0 }), row({ mode: 'time', actual: 0 }), row({ mode: 'reps', actual: 0 })] })], now)
    expect(stats.completedDrills).toBe(0)
    expect(stats.skills).toEqual([])
  })
  it('keeps absent skill labels unknown instead of guessing from drill names', () => {
    const stats = playerHistory([session({ rows: [row({})], assignment: { drills: [{ id: 'control', title: 'Shooting workout' }] } })], now)
    expect(stats.unlabelledDrills).toBe(1)
    expect(stats.skills).toEqual([])
  })
  it('uses local calendar boundaries and excludes outside, future and invalid dates', () => {
    const earliest = new Date(2026, 9, 3, 0).getTime()
    const stats = playerHistory([session({ endedAt: earliest }), session({ endedAt: earliest - 1 }), session({ endedAt: new Date(2026, 9, 31).getTime() }), session({ endedAt: 'bad' }), session({ endedAt: now })], now)
    expect(stats.days).toHaveLength(28)
    expect(stats.days[0].day).toBe('2026-10-03')
    expect(stats.days.at(-1).day).toBe('2026-10-30')
    expect(stats.periodSessions).toBe(2)
    expect(stats.recentDays).toHaveLength(7)
    expect(localDay(null)).toBeNull()
  })
  it('matches exact assignment identities and sorts active history first without mutating', () => {
    const assignments = [{ id: 'same', revision: '2' }]
    expect(isAssignedSession({ assignmentId: 'same', assignmentRevision: '1' }, assignments)).toBe(false)
    expect(isAssignedSession({ assignmentId: 'same', assignmentRevision: '2' }, assignments)).toBe(true)
    expect(isAssignedSession({}, [{}])).toBe(false)
    const records = [session({ id: 'old', endedAt: 10 }), session({ id: 'new', endedAt: 30 }), session({ id: 'active', status: 'active', startedAt: 1, endedAt: null })]
    expect(newestSessions(records).map(item => item.id)).toEqual(['active', 'new', 'old'])
    expect(records[0].id).toBe('old')
  })
})
