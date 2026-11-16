// Repeats share a journal only within the same coach, player and immutable
// practice version. Titles are not identities; local sessions never cross IDs.
export function journalKey(record) {
  return JSON.stringify([record.coachEmail, record.email, record.practice.id, record.practice.revision])
}
export function matchingSessions(record, sessions) {
  return sessions.filter(
    (s) =>
      s.status !== 'active' &&
      s.coachAssignmentId === record.id &&
      JSON.stringify(s.assignment) === JSON.stringify(record.practice)
  )
}
export function journalGroups(records) {
  const groups = new Map()
  for (const record of [...records].sort((a, b) => b.createdAt - a.createdAt)) {
    const key = journalKey(record)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(record)
  }
  return [...groups.values()]
}
