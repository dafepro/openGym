import React, { useEffect, useState } from 'react'
import { hostedCoach, invitedSession } from '../lib/invited-coach.js'
import { CoachNotes } from './CoachNotes.jsx'
import { t } from '../lib/i18n.js'
import { Button } from './ui.jsx'

export default function InvitedCoachGate({ children }) {
  const hosted = hostedCoach()
  const [state, setState] = useState('checking')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!hosted) return
    let live = true
    const signedOut = () => {
      if (live) setState('login')
    }
    window.addEventListener('uplift-coach-sign-in', signedOut)
    invitedSession().then(
      (ok) => {
        if (live) setState(ok ? 'ready' : 'login')
      },
      () => {
        if (live) setState('offline')
      }
    )
    return () => {
      live = false
      window.removeEventListener('uplift-coach-sign-in', signedOut)
    }
  }, [hosted, retry])
  if (!hosted || state === 'ready') return children
  return (
    <div className="narrow">
      <div className="hdr">
        <h1>{t('Coach')}</h1>
        <CoachNotes />
      </div>
      <section className="card" style={{ padding: 16 }}>
        {state === 'checking' ? (
          t('Loading…')
        ) : state === 'login' ? (
          <>
            <p>Sign in with your invited Google account to use Uplift Coach.</p>
            <a className="btn primary" href="/api/invited-coach/login">
              {t('Sign in')}
            </a>
          </>
        ) : (
          <>
            <p>{t('Something went wrong')}</p>
            <Button onClick={() => setRetry((n) => n + 1)}>{t('Try again')}</Button>
          </>
        )}
      </section>
      <a className="btn" href="#/plan">
        {t('Back')}
      </a>
    </div>
  )
}
