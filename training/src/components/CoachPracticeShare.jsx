import { useState } from 'react'
import Icon from './Icon.jsx'
import { displayContact } from '../domain/coach-request.js'
import { Button } from './ui.jsx'

export default function CoachPracticeShare({ url, recipients = [] }) {
  const [fallback, setFallback] = useState(false)
  const [selectLink, setSelectLink] = useState(false)
  const [message, setMessage] = useState('')
  const [sharing, setSharing] = useState(false)
  const phones = recipients.filter(
    ({ channel, address }) =>
      channel === 'sms' && /^\+[1-9]\d{7,14}$/.test(address),
  )

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setSelectLink(false)
      setMessage('Link copied.')
    } catch {
      setSelectLink(true)
      setMessage('Select and copy the practice link below.')
    }
  }

  const share = async () => {
    if (sharing) return
    const draft = { text: 'Your soccer practice is ready.', url }
    setMessage('')
    if (navigator.share && (!navigator.canShare || navigator.canShare(draft))) {
      setSharing(true)
      try {
        await navigator.share(draft)
        return
      } catch (error) {
        if (error.name === 'AbortError') return
      } finally {
        setSharing(false)
      }
    }
    setFallback(true)
    await copy()
  }

  return (
    <div className="pb-coach-share">
      <div className="pb-coach-share-actions">
        <Button icon="message" onClick={share} disabled={sharing}>
          Text practice
        </Button>
        <Button variant="secondary" icon="share" onClick={copy}>
          Copy link
        </Button>
      </div>
      <p className="qt-fine-print" role="status">
        {message}
      </p>
      {selectLink && (
        <label className="qt-field">
          Practice link
          <input
            readOnly
            value={url}
            onFocus={(event) => event.target.select()}
          />
        </label>
      )}
      {fallback && (
        <div className="pb-coach-request-links">
          {phones.length ? (
            phones.map((person) => (
              <a href={`sms:${person.address}`} key={person.address}>
                <Icon name="message" size={14} /> Open Messages for{' '}
                {person.name || displayContact(person)}
              </a>
            ))
          ) : (
            <a href="sms:">
              <Icon name="message" size={14} /> Open Messages
            </a>
          )}
          <span className="qt-fine-print">
            Paste the link into your message and send it.
          </span>
        </div>
      )}
    </div>
  )
}
