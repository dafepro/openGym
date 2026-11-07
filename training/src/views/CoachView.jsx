import { useEffect, useRef, useState } from 'react'
import { Button, Notice } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import Disclosure from '../components/Disclosure.jsx'
import Reveal from '../components/Reveal.jsx'
import { youtubeId } from '../domain/demonstration.js'
import CoachRecipients, {
  emptyRecipient,
} from '../components/CoachRecipients.jsx'
import {
  COACH_BRIEF_LIMIT,
  validateCoachRequest,
  parseRecipients,
  collectRecipients,
  displayContact,
} from '../domain/coach-request.js'

const draftKey = 'quicktrack.coach-draft.v1'
function readDraft() {
  try {
    const value = JSON.parse(sessionStorage.getItem(draftKey))
    if (
      !value ||
      typeof value.brief !== 'string' ||
      value.brief.length > COACH_BRIEF_LIMIT ||
      !/^[a-f0-9-]{36}$/.test(value.id)
    )
      return null
    const contact = value.recipientDraft
    const recipientDraft =
      contact &&
      ['email', 'sms'].includes(contact.channel) &&
      typeof contact.name === 'string' &&
      contact.name.length <= 60 &&
      typeof contact.address === 'string' &&
      contact.address.length <= 254
        ? contact
        : emptyRecipient()
    return {
      ...value,
      recipients: parseRecipients(value.recipients),
      recipientDraft,
    }
  } catch {
    return null
  }
}
const busy = new Set([
  'queued',
  'processing',
  'creating_pr',
  'revising',
  'publishing',
  'ready',
  'submitted',
  'notifying',
])
const statusLabel = {
  queued: 'Queued',
  processing: 'Finding drills',
  creating_pr: 'Preparing pull request',
  revising: 'Updating practice',
  submitted: 'Awaiting approval',
  publishing: 'Publishing practice',
  closed: 'Request closed',
  notification_setup: 'Practice ready · share the link',
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
    : job.status === 'publishing'
      ? 2
      : ['submitted', 'creating_pr', 'revising'].includes(job.status)
        ? 1
        : 0
  return (
    <article
      className="pb-coach-request"
      aria-label={job.publishedTitle || job.plan?.title || 'Practice request'}
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
      <h3>{job.publishedTitle || job.plan?.title || 'Your next practice'}</h3>
      {job.plan ? (
        <div className="pb-coach-goal">
          <span>Focus</span>
          <p>{job.plan.goal}</p>
        </div>
      ) : (
        <p>{job.brief}</p>
      )}
      {!['failed', 'rejected', 'attention', 'closed'].includes(job.status) && (
        <ol
          className="pb-coach-progress"
          aria-label="Practice request progress"
        >
          {['Research', 'PR', 'Publish', 'Ready'].map((label, index) => (
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
          ))}
        </ol>
      )}
      {job.reason && (
        <p className="pb-coach-reason" role="status">
          {job.reason}
        </p>
      )}
      {job.plan && (
        <Disclosure
          summary={`${job.plan.drills.length} ${job.plan.drills.length === 1 ? 'drill' : 'drills'}`}
        >
          <ol className="pb-coach-drills">
            {job.plan.drills.map((drill, index) => (
              <li key={index}>
                {youtubeId(drill.demonstrationUrl) && (
                  <a
                    className="pb-coach-video-preview"
                    href={drill.demonstrationUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Watch demonstration: ${drill.title}`}
                  >
                    <img
                      src={`https://i.ytimg.com/vi/${youtubeId(drill.demonstrationUrl)}/mqdefault.jpg`}
                      alt=""
                      loading="lazy"
                    />
                    <span>
                      <Icon name="play" size={16} />
                    </span>
                  </a>
                )}
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
        {(job.prUrl || job.issueUrl) && (
          <a href={job.prUrl || job.issueUrl} target="_blank" rel="noreferrer">
            Open pull request <Icon name="arrow" size={14} />
          </a>
        )}
        {job.practiceUrl && (
          <a href={job.practiceUrl}>
            Open practice <Icon name="forward" size={14} />
          </a>
        )}
      </div>
      {job.submitterEmail && (
        <p className="pb-coach-submitter">Requested by {job.submitterEmail}</p>
      )}
      {job.recipients?.length > 0 && (
        <Disclosure
          summary={`${job.recipients.length} ${job.recipients.length === 1 ? 'recipient' : 'recipients'} · private`}
        >
          <ul className="pb-coach-private-contacts">
            {job.recipients.map((item) => (
              <li key={item.address}>
                <strong>
                  {item.name || (item.channel === 'email' ? 'Email' : 'Text')}
                </strong>
                <span>{displayContact(item)}</span>
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
      {job.recipientCount > 0 && job.practiceUrl && (
        <small>
          {['failed', 'rejected', 'attention'].includes(job.status)
            ? 'Notifications have not been confirmed. Check the request before trying again.'
            : job.status === 'notification_setup'
              ? 'Delivery is not connected. Share the practice link above.'
              : job.practiceUrl
                ? job.notifications?.some(
                    (item) => item.status === 'needs_review',
                  )
                  ? 'Some notifications need attention.'
                  : job.status === 'notified'
                    ? 'Notifications accepted for sending.'
                    : 'Notifications are being prepared.'
                : `${job.recipientCount} recipient${job.recipientCount === 1 ? '' : 's'} · link available after publication`}
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
    [recipients, setRecipients] = useState(draft?.recipients || []),
    [recipientDraft, setRecipientDraft] = useState(
      draft?.recipientDraft || emptyRecipient(),
    ),
    [authenticated, setAuthenticated] = useState(false),
    [checkingAccess, setCheckingAccess] = useState(true),
    [composerOpen, setComposerOpen] = useState(true),
    [coach, setCoach] = useState(null),
    [error, setError] = useState(''),
    [signIn, setSignIn] = useState(false),
    [sending, setSending] = useState(false),
    [accepted, setAccepted] = useState(false)
  const requestId = useRef(draft?.id || crypto.randomUUID()),
    live = useRef(true),
    initialized = useRef(false),
    focusComposer = useRef(false),
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
        if (!settings.configured) setCheckingAccess(false)
        if (settings.configured) {
          const data = await api('requests')
          if (cancelled) return
          setJobs(data.requests)
          if (!initialized.current) {
            initialized.current = true
            setComposerOpen(
              !data.requests.length ||
                !!(
                  draft?.brief ||
                  draft?.recipients?.length ||
                  draft?.recipientDraft?.address
                ),
            )
          }
          setCheckingAccess(false)
          setCoach(data.coach || null)
          setAuthenticated(true)
          setSignIn(false)
          setError('')
          timer = setTimeout(
            refresh,
            data.requests.some((job) => busy.has(job.status)) ? 5000 : 30000,
          )
        }
      } catch (failure) {
        if (!cancelled) {
          setCheckingAccess(false)
          if (failure.signIn) setAuthenticated(false)
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
      if (
        brief ||
        recipients.length ||
        recipientDraft.address ||
        recipientDraft.name
      )
        sessionStorage.setItem(
          draftKey,
          JSON.stringify({
            id: requestId.current,
            brief,
            recipients,
            recipientDraft,
          }),
        )
      else sessionStorage.removeItem(draftKey)
    } catch {
      /* Drafting still works when browser storage is unavailable. */
    }
  }, [brief, recipients, recipientDraft])
  useEffect(() => {
    if (!composerOpen || !focusComposer.current) return
    let cancelled = false
    const frame = requestAnimationFrame(async () => {
      const reveal = briefField.current?.closest('.qt-reveal')
      await Promise.allSettled(
        (reveal?.getAnimations() || []).map((animation) => animation.finished),
      )
      if (!cancelled && live.current) {
        briefField.current?.focus()
        focusComposer.current = false
      }
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [composerOpen, brief])
  const submit = async (event) => {
    event.preventDefault()
    if (sending) return
    setError('')
    try {
      const payload = {
        id: requestId.current,
        brief,
        recipients: collectRecipients(recipients, recipientDraft),
      }
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
      setRecipients([])
      setRecipientDraft(emptyRecipient())
      requestId.current = crypto.randomUUID()
      setComposerOpen(false)
      setAccepted((value) => !value)
      requestAnimationFrame(async () => {
        const reveal = document.getElementById('coach-composer')
        await Promise.allSettled((reveal?.getAnimations() || []).map(animation => animation.finished))
        if (!live.current) return
        heading.current?.focus({ preventScroll: true })
        heading.current?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
      })
    } catch (failure) {
      if (live.current) {
        setError(failure.message)
        if (failure.signIn) {
          setSignIn(true)
          setAuthenticated(false)
        }
      }
    } finally {
      if (live.current) setSending(false)
    }
  }
  const revise = (job) => {
    focusComposer.current = true
    setComposerOpen(true)
    requestId.current = crypto.randomUUID()
    setBrief(job.brief)
    setRecipients([])
    setRecipientDraft(emptyRecipient())
    setError('')
    if (composerOpen) requestAnimationFrame(() => briefField.current?.focus())
  }
  const editBrief = (value) => {
    setBrief(value)
    requestId.current = crypto.randomUUID()
  }
  if (!authenticated)
    return (
      <div className="qt-view pb-coach pb-coach-gate">
        <p className="qt-eyebrow">QuickTrack coaching</p>
        <h1>Coach’s desk</h1>
        <div className="pb-coach-gate-card">
          <Icon name="pencil" size={26} />
          <h2>
            {config && !config.configured
              ? 'Assistant setup is pending'
              : 'A little direction. A better practice.'}
          </h2>
          {checkingAccess && !error ? (
            <p role="status">Checking coach access…</p>
          ) : config?.configured || signIn ? (
            <a className="pb-coach-signin" href="/api/coach/login">
              Continue with Google <Icon name="arrow" size={16} />
            </a>
          ) : (
            <p>The coaching service isn’t available yet.</p>
          )}
          {error && !signIn && <p role="alert">{error}</p>}
          <a className="pb-coach-back" href="#/">
            Back to practice
          </a>
        </div>
      </div>
    )
  return (
    <div className="qt-view pb-coach">
      <header className="pb-view-heading">
        <div>
          <p className="qt-eyebrow">Purposeful soccer training</p>
          <h1>Coach’s desk</h1>
        </div>
        <Icon name="pencil" size={26} />
      </header>
      {config?.paused && (
        <Notice title="Coach requests are paused">
          You can keep drafting and review past requests. New requests will be
          available when the assistant resumes.
        </Notice>
      )}
      {jobs.length > 0 && (
        <button
          className="pb-coach-compose-toggle"
          type="button"
          aria-expanded={composerOpen}
          aria-controls="coach-composer"
          onClick={() => {
            focusComposer.current = !composerOpen
            setComposerOpen((value) => !value)
          }}
        >
          <Icon name="plus" size={18} />
          <span>{composerOpen ? 'Close draft' : 'New practice'}</span>
          {!composerOpen && brief && <small>Draft saved</small>}
        </button>
      )}
      <Reveal
        open={composerOpen}
        id="coach-composer"
        className="pb-coach-composer"
      >
        <form onSubmit={submit} className="pb-coach-form">
          <label className="qt-field">
            <span>What should the player work on?</span>
            <textarea
              ref={briefField}
              required
              minLength={20}
              maxLength={COACH_BRIEF_LIMIT}
              rows={4}
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
          <CoachRecipients
            recipients={recipients}
            onChange={(value) => {
              setRecipients(value)
              requestId.current = crypto.randomUUID()
            }}
            draft={recipientDraft}
            onDraft={(value) => {
              setRecipientDraft(value)
              requestId.current = crypto.randomUUID()
            }}
            channels={config?.channels}
            email={coach?.email}
            disabled={sending}
          />
          {error && (
            <Notice
              title={
                signIn ? 'Coach sign-in needed' : 'Request needs attention'
              }
              tone="error"
            >
              {error}
            </Notice>
          )}
          <Button
            type="submit"
            icon="arrow"
            disabled={
              sending || !config?.configured || config?.paused || signIn
            }
          >
            {sending ? 'Creating practice…' : 'Create practice'}
          </Button>
          {(brief ||
            recipients.length ||
            recipientDraft.address ||
            recipientDraft.name) && (
            <button
              type="button"
              className="pb-coach-clear"
              disabled={sending}
              onClick={() => {
                setBrief('')
                setRecipients([])
                setRecipientDraft(emptyRecipient())
                setError('')
                requestId.current = crypto.randomUUID()
              }}
            >
              Clear draft
            </button>
          )}
        </form>
      </Reveal>
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
