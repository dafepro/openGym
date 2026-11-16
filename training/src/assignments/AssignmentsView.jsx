import { useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import Disclosure from '../components/Disclosure.jsx'
import Reveal from '../components/Reveal.jsx'
import PracticeSketch from '../components/PracticeSketch.jsx'
import PracticePreparation from '../components/PracticePreparation.jsx'
import { SessionDetail } from '../views/HistoryDetails.jsx'
import { Button, Notice, prescriptionLabel, countLabel, isVideoReview, isSelfPacedPractice } from '../components/ui.jsx'
import { consent } from './model.js'
import useAssignments from './useAssignments.js'
import { journalGroups, journalKey, matchingSessions } from './journal.js'
import './assignments.css'

const date = (value) =>
  value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''
const stateLabel = { pending: 'Invitation', accepted: 'Ready', submitted: 'Sent to coach', reviewed: 'Reviewed' }

function ResultEntry({ record, open = false }) {
  const result = record.result
  return (
    <div className="pb-journal-entry">
      <div className="pb-journal-date">
        <Icon name={record.status === 'reviewed' ? 'check' : 'share'} size={16} />
        <span>{date(result?.sentAt || record.createdAt)}</span>
        <span className="pb-state-chip">{stateLabel[record.status]}</span>
      </div>
      {result && (
        <>
          <p className="pb-result-count">
            {result.status === 'completed' ? 'Complete' : 'Partial'} ·{' '}
            {countLabel(
              result.rows.filter((r) => r.status === 'done').length,
              isVideoReview(record.practice) ? 'video' : isSelfPacedPractice(record.practice) ? 'drill' : 'set'
            )}{' '}
            {isVideoReview(record.practice) ? 'reviewed' : 'recorded'}
          </p>
          {result.note && <p className="pb-player-note">{result.note}</p>}
          {record.comment && (
            <div className="pb-feedback">
              <Icon name="message" size={20} />
              <div>
                <strong>Coach feedback</strong>
                <blockquote>{record.comment}</blockquote>
                <time>{date(record.reviewedAt)}</time>
              </div>
            </div>
          )}
          <Disclosure summary="Recorded work" defaultOpen={open}>
            <SessionDetail
              session={{ id: result.sessionId, assignment: record.practice, rows: result.rows, status: result.status }}
            />
          </Disclosure>
        </>
      )}
    </div>
  )
}

function Submission({ record, sessions, busy, mutate }) {
  const matches = matchingSessions(record, sessions)
  const [selected, setSelected] = useState('')
  const [note, setNote] = useState('')
  const sessionId = matches.some((s) => s.id === selected) ? selected : matches.length === 1 ? matches[0].id : ''
  if (!matches.length) return null
  return (
    <div className="pb-send-result">
      <p>
        <Icon name="check" size={16} /> Saved on this device
      </p>
      {matches.length > 1 && (
        <label className="qt-field">
          Finished session
          <select value={sessionId} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Choose a session</option>
            {matches.map((s) => (
              <option key={s.id} value={s.id}>
                {s.status === 'completed' ? 'Complete' : 'Partial'} ·{' '}
                {new Date(s.endedAt || s.startedAt).toLocaleString()}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="qt-field">
        Note to coach (optional)
        <textarea rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <Button
        icon="share"
        disabled={busy || !sessionId}
        onClick={() =>
          mutate({
            id: record.id,
            revision: record.revision,
            action: 'submit',
            session: matches.find((s) => s.id === sessionId),
            note
          })
        }
      >
        Send to coach
      </Button>
    </div>
  )
}

function PracticeAssignment({
  record,
  previous,
  coach,
  sessions,
  busy,
  disabled,
  mutate,
  onStart,
  activeSession,
  onResume,
  onRepeat,
  completion
}) {
  const [feedback, setFeedback] = useState('')
  const matches = matchingSessions(record, sessions)
  const resume = activeSession?.coachAssignmentId === record.id
  return (
    <article
      className={`pb-assignment-card${completion ? ' pb-assignment-card--completion' : ''}`}
      aria-label={record.practice.title}
    >
      {!completion && (
        <>
          <div className="pb-assignment-hero">
            <div>
              <div className="pb-assignment-meta">
                <span className="pb-state-chip" role="status">
                  {stateLabel[record.status]}
                </span>
                {record.due && <time dateTime={record.due}>Due {date(`${record.due}T12:00:00`)}</time>}
              </div>
              <h2>{record.practice.title}</h2>
              <p className="pb-assignment-person">
                <Icon name="user" size={16} />
                {coach ? record.email : record.coachEmail}
              </p>
            </div>
            {!coach && <PracticeSketch />}
          </div>
          <Disclosure summary={`${record.practice.drills.length} drills · Preparation`}>
            <PracticePreparation practice={record.practice} />
            <ol className="pb-assignment-drills">
              {record.practice.drills.map((d) => (
                <li key={d.id}>
                  <strong>{d.title}</strong>
                  <span>
                    {prescriptionLabel(d)}
                    {d.restSec > 0 ? ` · ${d.restSec}s rest` : ''}
                  </span>
                  <p>{d.instructions}</p>
                </li>
              ))}
            </ol>
          </Disclosure>
        </>
      )}
      {!coach && record.status === 'pending' && (
        <div className="pb-assignment-accept">
          <p>{consent}</p>
          <Button
            disabled={busy}
            onClick={() => mutate({ id: record.id, revision: record.revision, action: 'accept' })}
          >
            Accept assignment
          </Button>
        </div>
      )}
      {!coach && record.status === 'accepted' && (
        <>
          {!completion && (
            <Button
              className="pb-assignment-start"
              icon="play"
              variant={matches.length ? 'secondary' : 'primary'}
              disabled={busy || disabled}
              onClick={() => (resume ? onResume?.() : onStart(record.practice, record.id))}
            >
              {resume ? 'Resume practice' : 'Start practice'}
            </Button>
          )}
          <Submission record={record} sessions={sessions} busy={busy} mutate={mutate} />
        </>
      )}
      {record.result && <ResultEntry record={record} />}
      {coach && record.status === 'submitted' && (
        <div className="pb-send-result">
          <label className="qt-field">
            Feedback (optional)
            <textarea rows={3} maxLength={1000} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          </label>
          <Button
            icon="message"
            disabled={busy}
            onClick={() => mutate({ id: record.id, revision: record.revision, action: 'review', comment: feedback })}
          >
            Send feedback
          </Button>
        </div>
      )}
      {previous.length > 0 && (
        <Disclosure className="pb-feedback-history" summary={`Previous sessions · ${previous.length}`}>
          <div className="pb-journal">
            {previous.map((item) => (
              <ResultEntry key={item.id} record={item} />
            ))}
          </div>
        </Disclosure>
      )}
      {coach && (
        <Button variant="text" icon="replay" disabled={busy} onClick={onRepeat}>
          Assign again
        </Button>
      )}
    </article>
  )
}

export default function AssignmentsView({
  coach = false,
  practices = [],
  sessions = [],
  onStart,
  activeSession,
  onResume,
  disabled,
  embedded = false,
  fallback = null,
  focusId = null
}) {
  const { records, loading, signedIn, error, auth, busy, refresh, mutate } = useAssignments(coach)
  const [email, setEmail] = useState(''),
    [due, setDue] = useState(''),
    [selected, setSelected] = useState('')
  const [creating, setCreating] = useState(false)
  const emailInput = useRef(null)
  const groups = journalGroups(records)
  const active = records
    .filter((r) => ['pending', 'accepted'].includes(r.status))
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || b.createdAt - a.createdAt)
  const current = coach
    ? [...records].sort(
        (a, b) => Number(b.status === 'submitted') - Number(a.status === 'submitted') || b.createdAt - a.createdAt
      )
    : active
  const journal = groups.filter((group) => !group.some((r) => ['pending', 'accepted'].includes(r.status)))
  const uniquePractices = [...new Map(practices.map((p) => [`${p.id}:${p.revision}`, p])).values()]
  const repeat = (record) => {
    setEmail(record.email)
    setSelected(`${record.practice.id}:${record.practice.revision}`)
    setDue('')
    setCreating(true)
    requestAnimationFrame(() => emailInput.current?.focus())
  }
  const card = (record, completion = false) => (
    <PracticeAssignment
      key={record.id}
      record={record}
      previous={
        coach || completion
          ? []
          : records
              .filter((r) => r.id !== record.id && r.result && journalKey(r) === journalKey(record))
              .sort((a, b) => b.createdAt - a.createdAt)
      }
      coach={coach}
      sessions={sessions}
      busy={busy}
      disabled={disabled}
      mutate={mutate}
      onStart={onStart}
      activeSession={activeSession}
      onResume={onResume}
      onRepeat={() => repeat(record)}
      completion={completion}
    />
  )
  return (
    <section
      className={`pb-assignments${embedded ? ' pb-assignments--embedded' : ' qt-view'}`}
      aria-label={coach ? 'Player assignments' : 'Coach assignments'}
      aria-busy={loading || busy}
    >
      {!focusId && (
        <header className="pb-assignments-heading">
          {coach ? <h1>Players</h1> : !embedded ? <h1>Practice</h1> : null}
          <div>
            {coach && (
              <Button
                icon="plus"
                variant="secondary"
                onClick={() => setCreating(!creating)}
                aria-expanded={creating}
                aria-controls="new-player-assignment"
              >
                Assign practice
              </Button>
            )}
            {signedIn && (
              <button
                type="button"
                className="pb-icon-button"
                aria-label="Refresh assignments"
                title="Refresh assignments"
                disabled={busy || loading}
                onClick={refresh}
              >
                <Icon name="replay" size={18} />
              </button>
            )}
          </div>
        </header>
      )}
      {loading && (
        <span className="pb-assignment-loading" role="status" aria-label="Loading assignments">
          <Icon name="replay" size={18} />
        </span>
      )}
      {error && (
        <Notice title="Coach connection unavailable" tone="warning" action="Retry" onAction={refresh}>
          {error}
        </Notice>
      )}
      {!loading && !signedIn && (
        <a className="pb-account-link" href={coach ? '/api/coach/assignment-login' : '/api/player/login'}>
          {auth ? 'Continue with Google' : 'Sign in for coach assignments'}
          <Icon name="arrow" size={16} />
        </a>
      )}
      {coach && signedIn && (
        <Reveal open={creating} id="new-player-assignment" className="pb-assignment-form">
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              const practice = uniquePractices.find((p) => `${p.id}:${p.revision}` === selected)
              if (practice && (await mutate({ action: 'create', email, due, practice }))) {
                setCreating(false)
                setEmail('')
                setSelected('')
                setDue('')
              }
            }}
          >
            <label className="qt-field">
              Player email
              <input ref={emailInput} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="qt-field">
              Practice
              <select required value={selected} onChange={(e) => setSelected(e.target.value)}>
                <option value="">Choose a practice</option>
                {uniquePractices.map((p) => (
                  <option key={`${p.id}:${p.revision}`} value={`${p.id}:${p.revision}`}>
                    {p.title} · {p.assignedOn || p.revision}
                  </option>
                ))}
              </select>
            </label>
            <label className="qt-field">
              Due date (optional)
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </label>
            <Button type="submit" disabled={busy}>
              Send assignment
            </Button>
            <p className="qt-fine-print">
              No notification is sent. Share <a href="#/today">Practice</a> with the player.
            </p>
          </form>
        </Reveal>
      )}
      {focusId ? (
        records.filter((r) => r.id === focusId).map((r) => card(r, true))
      ) : (
        <>
          {!coach && !active.length && fallback}
          <div className="pb-assignment-stack">{current.map((r) => card(r))}</div>
          {!coach && journal.length > 0 && (
            <section className="pb-practice-journal" aria-label="Practice journal">
              <h2>Practice journal</h2>
              {journal.map((group) => (
                <Disclosure
                  key={group[0].id}
                  summary={
                    <span>
                      <strong>{group[0].practice.title}</strong>
                      <small>
                        {date(group[0].result?.sentAt || group[0].createdAt)} · {stateLabel[group[0].status]}
                      </small>
                    </span>
                  }
                  defaultOpen={journal.length === 1}
                >
                  <div className="pb-journal">
                    {group.map((r) => (
                      <ResultEntry key={r.id} record={r} />
                    ))}
                  </div>
                </Disclosure>
              ))}
            </section>
          )}
          {coach && signedIn && !records.length && <p className="pb-empty-assignments">No assignments yet.</p>}
        </>
      )}
    </section>
  )
}
