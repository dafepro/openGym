import { useRef, useState } from 'react'
import Icon from './Icon.jsx'
import {
  collectRecipients,
  displayContact,
  parseRecipients,
} from '../domain/coach-request.js'

export const emptyRecipient = () => ({
  channel: 'email',
  name: '',
  address: '',
})
export default function CoachRecipients({
  recipients,
  onChange,
  draft,
  onDraft,
  channels = {},
  email,
  disabled,
}) {
  const [error, setError] = useState(''),
    [message, setMessage] = useState('')
  const field = useRef(null)
  const add = () => {
    try {
      const next = collectRecipients(recipients, draft)
      setMessage(
        next.length === recipients.length
          ? 'Already added.'
          : 'Recipient added.',
      )
      onChange(next)
      onDraft({ ...emptyRecipient(), channel: draft.channel })
      setError('')
      field.current?.focus()
    } catch (failure) {
      setError(failure.message)
      field.current?.focus()
    }
  }
  const paste = (event) => {
    const text = event.clipboardData.getData('text')
    if (!/[,;\n]/.test(text)) return
    event.preventDefault()
    try {
      const next = parseRecipients([...recipients, ...parseRecipients(text)])
      setMessage(`${next.length - recipients.length} recipients added.`)
      onChange(next)
      onDraft(emptyRecipient())
      setError('')
    } catch (failure) {
      setError(failure.message)
    }
  }
  const changeChannel = (channel) => {
    if (channel === draft.channel) return
    try {
      if (draft.address.trim()) onChange(collectRecipients(recipients, draft))
      onDraft({
        ...emptyRecipient(),
        channel,
        ...(!draft.address.trim() ? { name: draft.name } : {}),
      })
      setError('')
      setMessage(draft.address.trim() ? 'Contact added.' : '')
    } catch (failure) {
      setError(failure.message)
      field.current?.focus()
    }
  }
  const edit = (update) => {
    onDraft({ ...draft, ...update })
    setError('')
    setMessage('')
  }
  return (
    <section className="pb-coach-recipients" aria-label="Players">
      <div className="pb-recipient-heading">
        <h2>
          Players <span>optional</span>
        </h2>
        {email && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              try {
                onChange(parseRecipients([...recipients, email]))
                setMessage('Your email is included.')
                setError('')
              } catch (failure) {
                setError(failure.message)
              }
            }}
          >
            Add me
          </button>
        )}
      </div>
      <div
        className="pb-recipient-channel"
        role="group"
        aria-label="Contact method"
      >
        {[
          ['email', 'Email'],
          ['sms', 'Text'],
        ].map(([channel, label]) => (
          <button
            key={channel}
            type="button"
            aria-pressed={draft.channel === channel}
            disabled={disabled}
            onClick={() => changeChannel(channel)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="pb-recipient-editor">
        <label className="qt-field">
          <span>
            Name <small>optional · private</small>
          </span>
          <input
            value={draft.name}
            maxLength={60}
            disabled={disabled}
            autoComplete="off"
            onChange={(event) => edit({ name: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                field.current?.focus()
              }
            }}
            placeholder="Player or guardian"
          />
        </label>
        <label className="qt-field">
          <span>
            {draft.channel === 'email' ? 'Email address' : 'Phone number'}
          </span>
          <input
            ref={field}
            type={draft.channel === 'email' ? 'email' : 'tel'}
            inputMode={draft.channel === 'email' ? 'email' : 'tel'}
            autoComplete={draft.channel === 'email' ? 'email' : 'tel'}
            value={draft.address}
            maxLength={254}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={error ? 'recipient-error' : 'recipient-help'}
            onPaste={paste}
            onChange={(event) => edit({ address: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                add()
              }
            }}
            placeholder={
              draft.channel === 'email'
                ? 'parent@example.com'
                : '(202) 555-0146'
            }
          />
        </label>
        <button
          className="pb-recipient-add"
          type="button"
          disabled={disabled || !draft.address.trim()}
          onClick={add}
        >
          <Icon name="plus" size={16} />
          Add
        </button>
      </div>
      <p id="recipient-help" className="qt-fine-print">
        {draft.channel === 'email'
          ? 'Paste several contacts at once, separated by commas or new lines.'
          : 'US/Canada numbers work as typed. For other countries, begin with +.'}
      </p>
      {error && (
        <p id="recipient-error" className="pb-recipient-error" role="alert">
          {error}
        </p>
      )}
      <span className="qt-sr-only" role="status">
        {message}
      </span>
      {recipients.length > 0 && (
        <ul className="pb-recipient-list">
          {recipients.map((item, index) => (
            <li key={`${item.channel}:${item.address}`}>
              <span className="pb-recipient-avatar" aria-hidden="true">
                {item.name
                  ? item.name.slice(0, 2).toUpperCase()
                  : String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <strong>{item.name || displayContact(item)}</strong>
                <small>
                  {item.name
                    ? displayContact(item)
                    : item.channel === 'email'
                      ? 'Email'
                      : 'Text message'}
                </small>
              </div>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Remove ${item.name || item.address}`}
                onClick={() => {
                  onChange(recipients.filter((_, i) => i !== index))
                  setMessage('Recipient removed.')
                }}
              >
                <Icon name="close" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="pb-recipient-delivery">
        {channels[draft.channel]
          ? 'Their practice link will be sent when it’s ready.'
          : `${draft.channel === 'email' ? 'Email' : 'Text'} delivery isn’t connected yet. Contacts are saved; you can share the ready link.`}
      </p>
    </section>
  )
}
