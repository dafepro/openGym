import { canonicalSkillTags } from './metadata.js'

// Calendar dates are local dates, matching the day the player sees on this device.
export function localDay(value) {
  if (value == null || value === '') return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function sessionTimestamp(session) {
  const value = session.endedAt ?? session.startedAt
  return value == null ? NaN : new Date(value).getTime()
}

export function newestSessions(sessions = []) {
  return [...sessions].sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active') || (sessionTimestamp(b) || 0) - (sessionTimestamp(a) || 0))
}

export function isAssignedSession(session, assignments = []) {
  return typeof session.assignmentId === 'string' && typeof session.assignmentRevision === 'string' &&
    assignments.some(assignment => assignment.id === session.assignmentId && assignment.revision === session.assignmentRevision)
}

export function sessionPracticeTime(session) {
  let seconds = 0, measuredRows = 0, unmeasuredRows = 0
  for (const row of session.rows || []) {
    if (!['done', 'stopped'].includes(row.status) || row.mode === 'watch') continue
    const actual = row.mode === 'practice' ? row.practiceSeconds : row.mode === 'time' ? row.actual : null
    if (typeof actual === 'number' && Number.isFinite(actual) && actual >= 0) {
      seconds += actual; measuredRows++
    } else if (row.status === 'done' || row.mode === 'practice' || Number(row.actual) > 0) unmeasuredRows++
  }
  return { seconds, measuredRows, unmeasuredRows }
}

export const skillName = tag => tag.replace(/^futbol:/, '').replaceAll('-', ' ')

export function playerHistory(sessions = [], now = Date.now()) {
  const today = new Date(now)
  today.setHours(12, 0, 0, 0)
  const days = Array.from({ length: 28 }, (_, index) => {
    const date = new Date(today)
    date.setDate(date.getDate() - 27 + index)
    return { day: localDay(date), date, sessions: 0, seconds: 0, measuredRows: 0, unmeasuredRows: 0 }
  })
  const byDay = new Map(days.map(day => [day.day, day]))
  const skills = new Map()
  let completedDrills = 0, unlabelledDrills = 0
  const saved = sessions.filter(session => session.status !== 'active')
  for (const session of saved) {
    const day = byDay.get(localDay(sessionTimestamp(session)))
    if (!day) continue
    day.sessions++
    const time = sessionPracticeTime(session)
    day.seconds += time.seconds
    day.measuredRows += time.measuredRows
    day.unmeasuredRows += time.unmeasuredRows
    // A drill performed on both feet or across several sets is one exposure per session.
    const drills = new Set((session.rows || []).filter(row => row.status === 'done' && (row.mode === 'practice' ? row.practiceSeconds == null || row.practiceSeconds > 0 : ['time', 'reps'].includes(row.mode) && row.actual > 0)).map(row => row.drillId))
    for (const id of drills) {
      completedDrills++
      const drill = session.assignment?.drills?.find(item => item.id === id)
      let tags = []
      try { tags = canonicalSkillTags(drill?.metadata) } catch { /* Unknown labels are not inferred. */ }
      if (!tags.length) unlabelledDrills++
      for (const tag of tags) skills.set(tag, (skills.get(tag) || 0) + 1)
    }
  }
  return {
    days, recentDays: days.slice(-7),
    activeDays: days.filter(day => day.sessions > 0).length,
    savedCount: saved.length,
    periodSessions: days.reduce((sum, day) => sum + day.sessions, 0),
    completedDrills, unlabelledDrills,
    skills: [...skills].map(([tag, count]) => ({ tag, label: skillName(tag), count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
  }
}
