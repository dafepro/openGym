import { useEffect, useState } from 'react'

export default function TextAlertsView() {
  const [config, setConfig] = useState(null)
  useEffect(() => {
    const abort = new AbortController()
    fetch('/api/coach/config', { signal: abort.signal })
      .then((response) => (response.ok ? response.json() : {}))
      .then(setConfig)
      .catch(() => {
        if (!abort.signal.aborted) setConfig({})
      })
    return () => abort.abort()
  }, [])

  const sender = /^\+1\d{10}$/.test(config?.smsSender) ? config.smsSender : null
  const displayNumber = sender?.replace(
    /^\+1(\d{3})(\d{3})(\d{4})$/,
    '+1 ($1) $2-$3',
  )

  return (
    <article className="qt-view pb-text-alerts">
      <h1>Practice texts</h1>
      <p>Get a QuickTrack link when your coach publishes a practice for you.</p>
      <section aria-labelledby="text-alerts-signup">
        <h2 id="text-alerts-signup">Sign up</h2>
        {sender && (
          <p>
            Text <strong>START</strong> to{' '}
            <a href={`sms:${sender}`}>{displayNumber}</a>. Give your coach the
            number you texted from.
          </p>
        )}
        {config && !config.channels?.sms && (
          <p>Text alerts are pending carrier setup.</p>
        )}
        <p>
          One alert per practice. Message frequency varies. Message and data
          rates may apply. Texts are optional.
        </p>
      </section>
      <section aria-labelledby="text-alerts-terms">
        <h2 id="text-alerts-terms">Text terms</h2>
        <p>
          Reply <strong>STOP</strong> to opt out or <strong>HELP</strong> for
          help. You can also ask the coach who shared this page. Carriers are
          not liable for delayed or undelivered messages.
        </p>
      </section>
      <section aria-labelledby="text-alerts-privacy">
        <h2 id="text-alerts-privacy">Text privacy</h2>
        <p>
          QuickTrack uses your phone number and subscription status to verify
          your opt-in and send practice alerts. Your number is visible to your
          coach and processed by Twilio and mobile carriers for messaging. We
          don’t sell or share mobile numbers or SMS opt-in information for
          marketing or promotional purposes.
        </p>
      </section>
    </article>
  )
}
