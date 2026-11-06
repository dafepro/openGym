import { useEffect, useRef, useState } from 'react'
import { Button, Notice } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import Disclosure from '../components/Disclosure.jsx'
import {
  COACH_BRIEF_LIMIT,
  validateCoachRequest,
} from '../domain/coach-request.js'

const draftKey = 'quicktrack.coach-draft.v1'
function readDraft() {
  try {
    const value = JSON.parse(sessionStorage.getItem(draftKey))
    return value &&
      typeof value.brief === 'string' &&
      value.brief.length <= COACH_BRIEF_LIMIT &&
      typeof value.recipients === 'string' &&
      value.recipients.length <= 3000 &&
      /^[a-f0-9-]{36}$/.test(value.id)
      ? value
      : null
  } catch {
    return null
  }
}
const busy = new Set([
  'queued',
  'processing',
  'creating_issue',
  'ready',
  'notifying',
])
const statusLabel = {
  queued: 'Queued',
  processing: 'Finding drills',
  creating_issue: 'Preparing proposal',
  submitted: 'Ready for coach review',
  rejected: 'Needs a clearer brief',
  failed: 'Could not finish',
  attention: 'Needs attention',
  ready: 'Practice published',
  notifying: 'Sending notifications',
  notified: 'Practice ready',
  notification_attention: 'Practice ready · check notifications',
}
async function api(path, options) {
  let response
  try {
    response = await fetch(`/api/coach/${path}`, {
      credentials: 'same-origin',
      redirect: 'error',
      ...options,
    })
  } catch {
    throw Object.assign(
      new Error(
        'Could not reach the coaching service. Your draft is preserved. If your coach session expired, sign in again.',
      ),
      { signIn: path !== 'config' },
    )
  }
  if (response.status === 401)
    throw Object.assign(new Error('Sign in to see your coaching requests.'), {
      signIn: true,
    })
  if (!response.headers.get('content-type')?.includes('application/json'))
    throw new Error(
      'The coaching service is temporarily unavailable. Your draft is still here.',
    )
  const data = await response.json()
  if (!response.ok)
    throw new Error(data.error || 'The coaching service is unavailable.')
  return data
}
function RequestCard({ job, onRevise }) {
  const step = job.practiceUrl
    ? 3
    : job.status === 'submitted'
      ? 2
      : job.status === 'queued'
        ? 0
        : 1
  return (
    <article
      className="pb-coach-request"
      aria-label={job.plan?.title || 'Practice request'}
    >
      <div className="pb-coach-request-meta">
        <span className="qt-eyebrow">
          {statusLabel[job.status] || 'Request received'}
        </span>
        <time dateTime={new Date(job.createdAt).toISOString()}>
          {new Date(job.createdAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}
        </time>
      </div>
      <h3>{job.plan?.title || 'Your next practice'}</h3>
      <p>{job.plan?.goal || job.brief}</p>
      {!['failed', 'rejected', 'attention'].includes(job.status) && (
        <ol
          className="pb-coach-progress"
          aria-label="Practice request progress"
        >
          {['Brief', 'Research', 'Coach review', 'Ready'].map(
            (label, index) => (
              <li
                key={label}
                data-state={
                  index < step ? 'done' : index === step ? 'current' : 'waiting'
                }
                aria-current={index === step ? 'step' : undefined}
              >
                <span>
                  {index < step ? <Icon name="check" size={12} /> : index + 1}
                </span>
                {label}
              </li>
            ),
          )}
        </ol>
      )}
      {job.reason && (
        <p className="pb-coach-reason" role="status">
          {job.reason}
        </p>
      )}
      {job.plan && (
        <Disclosure
          summary={`${job.plan.drills.length} proposed ${job.plan.drills.length === 1 ? 'drill' : 'drills'}`}
        >
          <ol className="pb-coach-drills">
            {job.plan.drills.map((drill, index) => (
              <li key={index}>
                <strong>{drill.title}</strong>
                <span>
                  {drill.sets} ×{' '}
                  {drill.mode === 'time'
                    ? `${drill.durationSec}s`
                    : `${drill.reps} reps`}
                  {drill.side === 'each' ? ' each side' : ''}
                </span>
                <p>{drill.focus}</p>
                <div>
                  {drill.sources.map((source) => (
                    <a
                      key={source.url}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {source.title}
                      <Icon name="arrow" size={12} />
                    </a>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </Disclosure>
      )}
      <div className="pb-coach-request-links">
        {['failed', 'rejected'].includes(job.status) && (
          <button type="button" onClick={() => onRevise(job)}>
            <Icon name="pencil" size={14} />
            Revise brief
          </button>
        )}
        {job.issueUrl && (
          <a href={job.issueUrl} target="_blank" rel="noreferrer">
            Review proposal <Icon name="arrow" size={14} />
          </a>
        )}
        {job.practiceUrl && (
          <a href={job.practiceUrl}>
            Open practice <Icon name="forward" size={14} />
          </a>
        )}
      </div>
      {job.recipientCount > 0 && (
        <small>
          {['failed', 'rejected', 'attention'].includes(job.status)
            ? 'Notifications have not been confirmed. Check the request before trying again.'
            : job.practiceUrl
              ? job.notifications?.some(
                  (item) => item.status === 'needs_review',
                )
                ? 'Some notifications need attention.'
                : job.status === 'notified'
                  ? 'Notifications accepted for sending.'
                  : 'Notifications are being prepared.'
              : `${job.recipientCount} recipient${job.recipientCount === 1 ? '' : 's'} · notified after publication`}
        </small>
      )}
    </article>
  )
}
export default function CoachView() {
  const [draft] = useState(readDraft)
  const [config, setConfig] = useState(null),
    [jobs, setJobs] = useState([]),
    [brief, setBrief] = useState(draft?.brief || ''),
    [recipients, setRecipients] = useState(draft?.recipients || ''),
    [consent, setConsent] = useState(draft?.consent === true),
    [error, setError] = useState(''),
    [signIn, setSignIn] = useState(false),
    [sending, setSending] = useState(false),
    [accepted, setAccepted] = useState(false)
  const requestId = useRef(draft?.id || crypto.randomUUID()),
    live = useRef(true),
    heading = useRef(null),
    briefField = useRef(null)
  useEffect(() => {
    live.current = true
    let timer,
      cancelled = false
    const refresh = async () => {
      try {
        const settings = await api('config')
        if (cancelled) return
        setConfig(settings)
        if (settings.configured) {
          const data = await api('requests')
          if (cancelled) return
          setJobs(data.requests)
          setSignIn(false)
          setError('')
          timer = setTimeout(
            refresh,
            data.requests.some((job) => busy.has(job.status)) ? 5000 : 30000,
          )
        }
      } catch (failure) {
        if (!cancelled) {
          setSignIn(!!failure.signIn)
          setError(failure.message)
          if (!failure.signIn) timer = setTimeout(refresh, 30000)
        }
      }
    }
    void refresh()
    return () => {
      cancelled = true
      live.current = false
      clearTimeout(timer)
    }
  }, [accepted])
  useEffect(() => {
    try {
      if (brief || recipients)
        sessionStorage.setItem(
          draftKey,
          JSON.stringify({ id: requestId.current, brief, recipients, consent }),
        )
      else sessionStorage.removeItem(draftKey)
    } catch {
      /* Drafting still works when browser storage is unavailable. */
    }
  }, [brief, recipients, consent])
  const submit = async (event) => {
    event.preventDefault()
    if (sending) return
    setError('')
    try {
      const payload = { id: requestId.current, brief, recipients, consent }
      validateCoachRequest(payload)
      setSending(true)
      const job = await api('requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!live.current) return
      setJobs((current) => [
        job,
        ...current.filter((item) => item.id !== job.id),
      ])
      setBrief('')
      setRecipients('')
      setConsent(false)
      requestId.current = crypto.randomUUID()
      setAccepted((value) => !value)
      requestAnimationFrame(() => heading.current?.focus())
    } catch (failure) {
      if (live.current) {
        setError(failure.message)
        if (failure.signIn) setSignIn(true)
      }
    } finally {
      if (live.current) setSending(false)
    }
  }
  const revise = (job) => {
    requestId.current = crypto.randomUUID()
    setBrief(job.brief)
    setRecipients('')
    setConsent(false)
    setError('')
    requestAnimationFrame(() => briefField.current?.focus())
  }
  const editBrief = (value) => {
    setBrief(value)
    requestId.current = crypto.randomUUID()
  }
  return (
    <div className="qt-view pb-coach">
      <header className="pb-view-heading">
        <div>
          <p className="qt-eyebrow">Coach’s desk</p>
          <h1>Give practice a purpose.</h1>
        </div>
        <Icon name="pencil" size={26} />
      </header>
      <p className="pb-coach-intro">
        Tell us what the player needs. Get a researched practice to review and
        assign.
      </p>
      {config && !config.configured && (
        <Notice title="Assistant setup is pending">
          You can draft a request here. Sending will be available once the
          server’s API key and coach access are configured.
        </Notice>
      )}
      {signIn && (
        <a className="pb-coach-signin" href="/api/coach/login">
          Sign in as coach <Icon name="arrow" size={16} />
        </a>
      )}
      <form onSubmit={submit} className="pb-coach-form">
        <label className="qt-field">
          <span>What should the player work on?</span>
          <textarea
            ref={briefField}
            required
            minLength={20}
            maxLength={COACH_BRIEF_LIMIT}
            rows={6}
            value={brief}
            disabled={sending}
            onChange={(event) => editBrief(event.target.value)}
            placeholder="20 minutes of close control for a 12-year-old. Small outdoor space, one ball and four cones. Both feet. Focus on quick, accurate touches, keeping the ball close."
          />
        </label>
        <div className="pb-coach-hints">
          <span>Goal · time · equipment · player level</span>
          <span aria-live="off">
            {brief.length} / {COACH_BRIEF_LIMIT}
          </span>
        </div>
        <Disclosure summary="Notify players when it’s ready">
          <label className="qt-field">
            <span>Emails or phone numbers</span>
            <textarea
              rows={3}
              value={recipients}
              maxLength={3000}
              disabled={sending}
              onChange={(event) => {
                setRecipients(event.target.value)
                requestId.current = crypto.randomUUID()
              }}
              placeholder={'parent@example.com\n+1 555 123 4567'}
            />
          </label>
          <p className="qt-fine-print">
            One per line, or separated by commas. Include a country code for
            phone numbers. Add yourself if you’d like a copy.
          </p>
          {config && (
            <p className="qt-fine-print">
              Email {config.channels.email ? 'available' : 'setup pending'} ·
              Text {config.channels.sms ? 'available' : 'setup pending'}
            </p>
          )}
          <label className="pb-coach-consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              disabled={sending}
            />
            <span>
              These players or guardians expect this practice notification.
            </span>
          </label>
        </Disclosure>
        {error && (
          <Notice
            title={signIn ? 'Coach sign-in needed' : 'Request needs attention'}
            tone="error"
          >
            {error}
          </Notice>
        )}
        <Button
          type="submit"
          icon="arrow"
          disabled={sending || !config?.configured || signIn}
        >
          {sending ? 'Sending request…' : 'Request a practice'}
        </Button>
        <p className="qt-fine-print">
          You review the proposal before it becomes an assigned practice.
        </p>
        {(brief || recipients) && (
          <button
            type="button"
            className="pb-coach-clear"
            disabled={sending}
            onClick={() => {
              setBrief('')
              setRecipients('')
              setConsent(false)
              setError('')
              requestId.current = crypto.randomUUID()
            }}
          >
            Clear draft
          </button>
        )}
      </form>
      {jobs.length > 0 && (
        <section
          className="pb-coach-requests"
          aria-label="Your coaching requests"
        >
          <h2 ref={heading} tabIndex={-1}>
            Your requests
          </h2>
          {jobs.map((job) => (
            <RequestCard key={job.id} job={job} onRevise={revise} />
          ))}
        </section>
      )}
    </div>
  )
}
