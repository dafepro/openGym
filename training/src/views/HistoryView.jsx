import Icon from '../components/Icon.jsx'
import { Badge, Button, EmptyState, LoadingState, PageHeading, countLabel, formatClock, isVideoReview, isSelfPacedPractice } from '../components/ui.jsx'
import { isAssignedSession, newestSessions, sessionPracticeTime, sessionTimestamp } from '../domain/player-history.js'

export default function HistoryView({ assignments = [], sessions = [], onOpenSession, onResume, onExport, onRestore, loading = false, embedded = false, selectedDay, onClearDay }) {
  return <section className={embedded ? 'qt-me-history' : 'qt-view qt-history'} aria-label="Session history" id={embedded ? 'player-history' : undefined}>
    {embedded ? <div className="qt-me-section-heading"><div><h2>History</h2></div><span className="qt-me-count">{sessions.length}</span></div> : <PageHeading eyebrow="Your practice, kept in one place" title="History">Your saved sessions and practice in progress.</PageHeading>}
    {selectedDay && <div className="qt-history-filter"><span>{new Date(`${selectedDay}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span><Button variant="text" onClick={onClearDay}>Show all</Button></div>}
    {loading ? <LoadingState label="Loading history" /> : <div className="qt-history-list">{sessions.length ? newestSessions(sessions).map(session => {
      const time = sessionPracticeTime(session)
      const review = isVideoReview(session.assignment)
      const timestamp = sessionTimestamp(session)
      const recorded = session.rows?.filter(row => row.status === 'done').length || 0
      return <button type="button" className="qt-history-row" key={session.id} onClick={() => session.status === 'active' && onResume ? onResume(session) : onOpenSession?.(session)}>
        <span className={`qt-history-symbol${session.status === 'completed' ? ' qt-history-symbol--complete' : ''}`}><Icon name={review ? 'video' : session.status === 'completed' ? 'check' : 'clock'} size={23} /></span>
        <span className="qt-history-copy"><span className="qt-history-meta">{session.dateLabel || (Number.isFinite(timestamp) ? new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date not recorded')}{isAssignedSession(session, assignments) && <span className="qt-history-assigned">Assigned</span>}</span>
          <strong>{session.title || session.assignment?.title || 'Practice session'}</strong>
          <span className="qt-history-bottom"><Badge tone={session.status === 'completed' ? 'complete' : session.status === 'active' ? 'active' : 'neutral'}>{session.status === 'completed' ? review ? 'Reviewed' : 'Complete' : session.status === 'active' ? 'Resume' : review ? 'Partly reviewed' : 'Partial'}</Badge><span>{review ? `${countLabel(recorded, 'video')} reviewed` : isSelfPacedPractice(session.assignment) ? `${countLabel(recorded, 'drill')} practiced` : `${countLabel(recorded, 'set')} recorded`}</span></span>
          {!review && (time.measuredRows > 0 || time.unmeasuredRows > 0) && <span className="qt-history-duration">{time.measuredRows ? `${formatClock(Math.floor(time.seconds))} timed practice${time.unmeasuredRows ? ' · some work untimed' : ''}` : 'Practice time not tracked'}</span>}
        </span><Icon name="arrow" size={18} />
      </button>
    }) : <EmptyState title={selectedDay ? 'No saved sessions on this day' : 'Your first session starts here'} icon="history">{selectedDay ? 'Choose another day or show all history.' : 'Finish a practice or video review to build your history.'}</EmptyState>}</div>}
    {!embedded && <HistoryStorage onExport={onExport} onRestore={onRestore} />}
  </section>
}

export function HistoryStorage({ onExport, onRestore }) {
  return <details className="qt-backup-disclosure"><summary><Icon name="download" size={16}/> Backup &amp; device storage</summary><p>History stays in this browser. Export before changing devices or clearing site data. Player details are saved separately.</p><div className="qt-history-backup-actions">{onExport && <Button variant="text" icon="download" onClick={onExport}>Export a backup</Button>}{onRestore && <Button variant="text" onClick={onRestore}>Restore a backup</Button>}</div></details>
}
