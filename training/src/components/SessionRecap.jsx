import { sessionPracticeTime } from '../domain/player-history.js'
import { formatClock } from './ui.jsx'

export function RecordedWork({ session }) {
  const time = sessionPracticeTime(session)
  const repRows = (session.rows || []).filter(row => ['done', 'stopped'].includes(row.status) && row.mode === 'reps' && Number.isFinite(row.actual) && row.actual >= 0)
  const reps = repRows.reduce((sum, row) => sum + row.actual, 0)
  if (!(session.rows || []).some(row => row.mode !== 'watch')) return null
  return <div className="qt-recorded-work" aria-label="Recorded work">
    <div><strong>{time.measuredRows ? formatClock(Math.floor(time.seconds)) : '—'}</strong><span>{time.measuredRows ? 'Work time' : 'No time recorded'}</span></div>
    {repRows.length > 0 && <div><strong>{reps}</strong><span>Reps recorded</span></div>}
    {time.measuredRows > 0 && time.unmeasuredRows > 0 && <small>Some work was untimed.</small>}
  </div>
}

export default function SessionRecap({ session, completed, total, label }) {
  const ratio = total ? Math.min(1, Math.max(0, completed / total)) : 0
  return <div className="qt-recap">
    <div className="qt-recap-progress"><svg viewBox="0 0 100 100" aria-hidden="true"><circle className="qt-recap-track" cx="50" cy="50" r="42" /><circle className="qt-recap-fill" opacity={ratio > 0 ? 1 : 0} cx="50" cy="50" r="42" pathLength="100" strokeDasharray={`${ratio * 100} 100`} /></svg><div><strong>{completed}<span> / {total}</span></strong><span>{label}</span></div></div>
    {session && <RecordedWork session={session} />}
    {session?.assignment?.drills?.length > 0 && <ol className="qt-recap-drills" aria-label="Drill summary">{session.assignment.drills.map(drill => {
      const rows = session.rows.filter(row => row.drillId === drill.id)
      const done = rows.filter(row => row.status === 'done').length
      return <li key={drill.id}><div><span>{drill.title}</span><small>{done} / {rows.length}</small></div><div className="qt-recap-track-line" aria-hidden="true"><i style={{ transform: `scaleX(${rows.length ? done / rows.length : 0})` }} /></div></li>
    })}</ol>}
  </div>
}
