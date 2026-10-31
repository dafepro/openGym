import { useState } from 'react'
import Reveal from '../components/Reveal.jsx'
import Icon from '../components/Icon.jsx'
import { RecordedWork } from '../components/SessionRecap.jsx'
import { Badge, Button, formatClock, prescriptionLabel, isVideoReview } from '../components/ui.jsx'

export function AssignmentDetail({ assignment, current }) {
  return <><div className="qt-detail-meta"><Badge tone={current ? 'active' : 'neutral'}>{current ? 'Current assignment' : 'Previous assignment'}</Badge><Badge>{assignment.assignedOn}</Badge></div><p>This edition is preserved as assigned. {isVideoReview(assignment) ? 'Starting a review creates a separate video-review record.' : 'Starting a practice creates a new session.'}</p><ol className="qt-detail-list">{assignment.drills.map((drill, index) => <li key={drill.id}><strong>{index + 1}. {drill.title}</strong><p>{prescriptionLabel(drill)}</p>{drill.restSec != null && <p>{drill.restSec === 0 ? 'No rest prescribed' : `${drill.restSec} seconds rest`}</p>}</li>)}</ol></>
}

export function SessionDetail({ session, onDelete }) {
  const [expanded, setExpanded] = useState(null)
  const review = isVideoReview(session.assignment)
  return <div className="qt-session-review"><div className="qt-detail-meta"><Badge tone={session.status === 'completed' ? 'complete' : 'neutral'}>{session.status === 'completed' ? review ? 'Videos reviewed' : 'Complete' : session.status === 'active' ? 'In progress' : 'Partial'}</Badge>{onDelete && session.status !== 'active' && <Button variant="text" className="qt-delete-shortcut" onClick={() => onDelete(session)}>Delete session</Button>}</div>
    <RecordedWork session={session} />
    <ol className="qt-session-drills">{session.assignment.drills.map(drill => {
      const rows = session.rows.filter(row => row.drillId === drill.id)
      const done = rows.filter(row => row.status === 'done').length
      return <li key={drill.id}><button type="button" className="qt-session-drill-heading" aria-expanded={expanded === drill.id} aria-controls={`session-${session.id}-${drill.id}`} onClick={() => setExpanded(expanded === drill.id ? null : drill.id)}><span className={done === rows.length ? 'qt-session-marker is-done' : 'qt-session-marker'}><Icon name={done === rows.length ? 'check' : 'clock'} size={16}/></span><span><strong>{drill.title}</strong><small>{drill.mode === 'practice' ? done ? 'Practiced' : 'Unfinished' : drill.mode === 'watch' ? done ? 'Reviewed' : 'Not reviewed' : `${done}/${rows.length} sets recorded`}</small></span><Icon name="arrow" size={14}/></button><Reveal open={expanded === drill.id} id={`session-${session.id}-${drill.id}`}><div className="qt-session-drill-body"><p>{prescriptionLabel(drill)}</p><ul className="qt-detail-rows">{rows.map(row => <li key={row.id}><strong>{row.mode === 'watch' ? 'Video' : row.mode === 'practice' ? 'Practice' : `Set ${row.setNumber}`}{row.side ? ` · ${row.side} foot` : ''}</strong><span>{row.status === 'done' ? row.prescriptionMet ? 'Done' : 'Ended early' : row.status === 'stopped' ? 'Unfinished' : 'Not recorded'}</span><small>{row.mode === 'practice' ? row.practiceSeconds != null ? `${formatClock(Math.floor(row.practiceSeconds))} time practiced` : 'Time not tracked' : row.mode === 'watch' ? row.status === 'done' ? 'Demonstration acknowledged' : 'Video review only' : `Planned: ${row.target} ${row.mode === 'time' ? 'seconds' : 'reps'} · Actual: ${row.actual == null ? 'not recorded' : `${row.mode === 'time' ? Math.floor(row.actual) : row.actual} ${row.mode === 'time' ? 'seconds' : 'reps'}`}`}</small></li>)}</ul><p className="qt-session-instructions">{drill.instructions}</p></div></Reveal></li>
    })}</ol>
  </div>
}
