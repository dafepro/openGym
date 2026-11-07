import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'

const preferenceKey = 'quicktrack.coach-alerts.v1'

function readPreference() {
  try {
    return localStorage.getItem(preferenceKey) === 'on'
  } catch {
    return false
  }
}

export default function CoachReadyAlerts({ jobs }) {
  const [enabled, setEnabled] = useState(readPreference)
  const [permission, setPermission] = useState(
    () => globalThis.Notification?.permission,
  )
  const [message, setMessage] = useState('')
  const [readyNotice, setReadyNotice] = useState('')
  const previous = useRef(null)

  const updatePreference = (value) => {
    setEnabled(value)
    try {
      localStorage.setItem(preferenceKey, value ? 'on' : 'off')
    } catch {
      // The preference still applies to this tab.
    }
  }

  useEffect(() => {
    const last = previous.current
    previous.current = new Map(jobs.map((job) => [job.id, !!job.practiceUrl]))
    const published = jobs.filter(
      (job) => job.practiceUrl && last?.get(job.id) === false,
    )
    if (!published.length) return
    const title =
      published.length === 1
        ? 'Practice ready'
        : `${published.length} practices ready`
    setReadyNotice(`${title}. Share the link from the request card.`)
    if (!enabled || globalThis.Notification?.permission !== 'granted') return
    try {
      const alert = new Notification(title, {
        body: 'Open Coach’s desk to share the practice link.',
        tag: `quicktrack-ready-${published[0].id}`,
      })
      alert.onclick = () => {
        window.focus()
        document
          .getElementById(`coach-request-${published[0].id}`)
          ?.scrollIntoView({ block: 'center' })
        alert.close()
      }
    } catch {
      updatePreference(false)
      setMessage('This browser shows ready updates here in Coach’s desk.')
    }
  }, [jobs, enabled])

  const toggle = async () => {
    setMessage('')
    if (enabled && permission === 'granted') {
      updatePreference(false)
      return
    }
    try {
      const granted = await Notification.requestPermission()
      setPermission(granted)
      updatePreference(granted === 'granted')
      if (granted === 'denied')
        setMessage(
          'Allow notifications in your browser settings to enable alerts.',
        )
    } catch {
      setMessage('This browser shows ready updates here in Coach’s desk.')
    }
  }

  const on = enabled && permission === 'granted'
  return (
    <div className="pb-coach-alerts">
      {globalThis.Notification?.requestPermission && (
        <div className="pb-coach-alert-controls">
          <button type="button" aria-pressed={on} onClick={toggle}>
            <Icon name="bell" size={16} /> Browser alerts
          </button>
          <small>{on ? 'On while this page is open' : 'Off'}</small>
        </div>
      )}
      <p className="qt-fine-print" role="status">
        {message}
      </p>
      <p className="pb-coach-ready-notice" role="status">
        {readyNotice}
      </p>
    </div>
  )
}
