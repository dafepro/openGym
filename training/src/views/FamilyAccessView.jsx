import { useState } from 'react'
import { APP_CONFIG } from '../config.js'
import TrainingShell from '../components/TrainingShell.jsx'
import { Button, EmptyState, Notice, PageHeading } from '../components/ui.jsx'
import { ROUTES } from '../lib/routes.js'

export default function FamilyAccessView({ route, access, returning = false }) {
  const [key, setKey] = useState('')
  const busy = access.pending || access.status === 'checking' || access.status === 'signing-in' || access.status === 'signing-out'
  const submit = event => { event.preventDefault(); if (key && !busy) { const value = key; setKey(''); void access.login(value) } }
  return <TrainingShell page={route} sourceUrl={APP_CONFIG.sourceUrl} onNavigate={page => { window.location.hash = ROUTES[page] }}>
    <PageHeading eyebrow="Family practice" title={returning ? 'Welcome back' : 'Ready when you are.'} />
    {access.status === 'checking' || access.status === 'unavailable' ? <><EmptyState title="Training is not connected yet">Family access and your trainer’s assignments will appear here when setup is complete. There are no assignments available in this build.</EmptyState>{access.status === 'checking' ? <p className="qt-access-status" role="status">Checking family access…</p> : <Notice title="Family access unavailable" tone="warning" action="Try again" onAction={() => access.check()}>{access.error}</Notice>}</> : <section className="qt-access-card"><h2>{returning ? 'Renew family access' : 'Open your practice'}</h2><p>{returning ? 'Your local practice is preserved. Enter the family access key to continue.' : 'Ask a parent for your family’s access key.'}</p>{access.error && <Notice title="Could not open practice" tone="error">{access.error}</Notice>}<form onSubmit={submit}><label htmlFor="family-access-key">Family access key</label><input id="family-access-key" type="password" autoComplete="off" autoCapitalize="none" spellCheck="false" value={key} onChange={event => setKey(event.target.value)} disabled={busy} required /><Button type="submit" icon="play" disabled={!key || busy}>{busy ? 'Opening practice…' : 'Open practice'}</Button></form><p className="qt-fine-print">The key is sent securely to this site. It is not stored in your browser by this application.</p></section>}
  </TrainingShell>
}
