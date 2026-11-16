import { useEffect, useState } from 'react'
import { consent } from './model.js'
import { Button, Notice } from '../components/ui.jsx'
export default function AssignmentsView({ coach, practices, sessions, onStart }) {
  const [records, setRecords] = useState([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [signedIn, setSignedIn] = useState(false)
  const [email, setEmail] = useState(''),
    [due, setDue] = useState(''),
    [selected, setSelected] = useState('')
  const endpoint = `/api/${coach ? 'coach' : 'player'}/assignments`
  async function refresh() {
    const response = await fetch(endpoint, { redirect: 'error' })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Assignments unavailable')
    setRecords(data.records)
    setSignedIn(true)
  }
  useEffect(() => {
    setSignedIn(false)
    refresh().catch((e) => setError(e.message))
  }, [endpoint])
  async function mutate(input) {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        redirect: 'error'
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not save')
      await refresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="qt-view">
      <h1>{coach ? 'Player assignments' : 'My assignments'}</h1>
      <p>
        <a href={coach ? '#/coach' : '#/today'}>Back to {coach ? 'coach’s desk' : 'practice'}</a>
      </p>
      {error && (
        <Notice title="Assignments need attention" tone="warning">
          {error}
        </Notice>
      )}
      {signedIn && (
        <Button variant="secondary" disabled={busy} onClick={() => refresh().catch((e) => setError(e.message))}>
          Refresh assignments
        </Button>
      )}
      {!signedIn ? (
        <a href={coach ? '/api/coach/assignment-login' : '/api/player/login'}>Continue with Google</a>
      ) : (
        <>
          {coach && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const practice = practices.find((p) => `${p.id}:${p.revision}` === selected)
                if (practice) void mutate({ action: 'create', email, due, practice })
              }}
            >
              <label className="qt-field">
                Player email
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="qt-field">
                Practice version
                <select required value={selected} onChange={(e) => setSelected(e.target.value)}>
                  <option value="">Choose a practice</option>
                  {practices.map((p) => (
                    <option key={`${p.id}:${p.revision}`} value={`${p.id}:${p.revision}`}>
                      {p.title} · {p.revision}
                    </option>
                  ))}
                </select>
              </label>
              <label className="qt-field">
                Due date (optional)
                <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
              </label>
              <Button type="submit" disabled={busy}>
                Assign practice
              </Button>
              <p>
                Ask the player to open My assignments and sign in with the email above. Creating an assignment does not
                send a message.
              </p>
            </form>
          )}
          {!records.length && <p>No assignments yet.</p>}
          {records.map((record) => (
            <Assignment
              key={record.id}
              record={record}
              coach={coach}
              sessions={sessions}
              busy={busy}
              onStart={onStart}
              mutate={mutate}
              onRepeat={() => {
                setEmail(record.email)
                setSelected(`${record.practice.id}:${record.practice.revision}`)
                setDue('')
                window.scrollTo({ top: 0 })
              }}
            />
          ))}
        </>
      )}
    </section>
  )
}
function Assignment({ record, coach, sessions, busy, mutate, onStart, onRepeat }) {
  const [note, setNote] = useState(''),
    [sessionId, setSessionId] = useState('')
  const matches = sessions.filter(
    (s) =>
      s.status !== 'active' &&
      s.coachAssignmentId === record.id &&
      JSON.stringify(s.assignment) === JSON.stringify(record.practice)
  )
  const action = (type, extra = {}) => mutate({ id: record.id, revision: record.revision, action: type, ...extra })
  return (
    <article className="qt-assignment-card" style={{ padding: 20, marginTop: 20 }}>
      <h2>{record.practice.title}</h2>
      {!coach && <p>From {record.coachEmail}</p>}
      <details>
        <summary>Practice preview · {record.practice.drills.length} drills</summary>
        <ol>
          {record.practice.drills.map((d) => (
            <li key={d.id}>
              <strong>{d.title}</strong>
              <p>{d.instructions}</p>
              <p>
                {d.sets} sets · {d.reps ?? d.durationSec ?? 'Self-paced'} {d.mode} · {d.restSec ?? 0}s rest
              </p>
            </li>
          ))}
        </ol>
      </details>
      <p>
        {record.status}
        {record.due ? ` · Due ${record.due}` : ''}
        {coach ? ` · ${record.email}` : ''}
      </p>
      {!coach && record.status === 'pending' && (
        <>
          <p>{consent}</p>
          <Button disabled={busy} onClick={() => action('accept')}>
            Accept assignment
          </Button>
        </>
      )}
      {!coach && record.status === 'accepted' && (
        <>
          <Button disabled={busy} onClick={() => onStart(record.practice, record.id)}>
            Start assigned practice
          </Button>
          <p>Finish a session locally, then choose it here to send to your coach.</p>
          <label className="qt-field">
            Completed session
            <select value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
              <option value="">Choose a session</option>
              {matches.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.status} · {new Date(s.endedAt || s.startedAt).toLocaleString()}
                </option>
              ))}
            </select>
          </label>
          <label className="qt-field">
            Note to coach (optional)
            <textarea maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <Button
            disabled={busy || !sessionId}
            onClick={() => action('submit', { session: matches.find((s) => s.id === sessionId), note })}
          >
            Send to coach
          </Button>
        </>
      )}
      {record.result && (
        <>
          <p>
            {record.result.status} · {record.result.rows.filter((r) => r.status === 'done').length} sets recorded
          </p>
          <p>{record.result.note}</p>
          <details>
            <summary>Recorded work</summary>
            <ul>
              {record.result.rows.map((r) => (
                <li key={r.id}>
                  {record.practice.drills.find((d) => d.id === r.drillId)?.title} · {r.side || 'both'} · {r.status} ·{' '}
                  {r.actual ?? 'unrecorded'} {r.mode === 'time' ? 'seconds' : r.mode === 'reps' ? 'reps' : ''}
                  {r.practiceSeconds != null ? ` · ${Math.floor(r.practiceSeconds)} seconds practiced` : ''}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
      {coach && record.status === 'submitted' && (
        <>
          <label className="qt-field">
            Feedback (optional)
            <textarea maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <Button disabled={busy} onClick={() => action('review', { comment: note })}>
            Mark reviewed and send feedback
          </Button>
        </>
      )}
      {record.reviewedAt && <p>Coach reviewed{record.comment ? `: ${record.comment}` : '.'}</p>}
      {coach && (
        <Button variant="secondary" disabled={busy} onClick={onRepeat}>
          Assign again or choose another practice
        </Button>
      )}
    </article>
  )
}
