import { useEffect, useState } from 'react'
import { useGarminSync } from '../store/useGarminSync.js'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { watchSnapshot } from '../lib/garmin.js'
import { t } from '../lib/i18n.js'
import { DEMO } from '../lib/demo.js'
import { MOBILE } from '../lib/mobile.js'
import { Section, Row, Button, TextField, Switch } from './ui.jsx'
import { confirmSheet } from '../sheets.jsx'
import Icon from './Icon.jsx'
import './GarminSync.css'

export function watchStatus(bridge, S, ui, now = Date.now()) {
  const c = bridge.device.connection
  if (!c) return t('Pair watch')
  if (c.owner !== useStore.getState().cloudSyncOwner()) return t('Watch transfer is paused for this profile.')
  if (S._watch?.review.length) return t('Watch entries need review')
  if (bridge.error || bridge.phase === 'expired') return t('Watch transfer needs attention')
  if (bridge.phase !== 'paired') return t('Confirm pairing on watch')
  const snapshot = watchSnapshot(S, bridge.device.preferences, ui)
  if (snapshot.issue) return t('Use phone for this workout')
  if (!navigator.onLine || !bridge.seen || now / 1000 - bridge.seen >= 45 || now / 1000 < bridge.seen) return t('Waiting for watch')
  if (bridge.handoff?.pending) return t('Receiving watch entries')
  if (bridge.handoff?.snapshot !== JSON.stringify(snapshot) || bridge.handoff?.revision === undefined ||
    bridge.handoff?.watchRevision !== bridge.handoff.revision) return t('Sending workout to watch')
  return S.active ? t('Workout ready on watch') : t('Watch up to date')
}
const toastError = e => useUI.getState().toast(t(e.message))
export function PairWatchSheet({ close }) {
  const bridge = useGarminSync()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const pair = async () => { try { await bridge.pair(code); close() } catch (e) { setError(e.message) } }
  return <>
    <h3>{t('Pair watch')}</h3>
    <p className="muted small">{t('Open Uplift on your Garmin. Enter its eight-character code, then confirm the matching four digits on the watch.')}</p>
    <label htmlFor="garmin-code">{t('Watch code')}</label>
    <TextField id="garmin-code" value={code} maxLength={12} autoCapitalize="characters" autoComplete="off" spellCheck={false} onChange={e => setCode(e.target.value.toUpperCase())} />
    {error && <p role="alert">{t(error)}</p>}
    <Button variant="primary" disabled={bridge.busy || !/^[A-HJ-NP-Z2-9]{8}$/.test(code.replace(/[\s-]/g, ''))} onClick={pair}>{t('Pair')}</Button>
    <Button variant="ghost" onClick={close}>{t('Cancel')}</Button>
  </>
}
export function WatchHandoff() {
  const bridge = useGarminSync(), S = useStore(s => s.S), ui = useUI()
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(timer) }, [])
  if (!bridge.device.connection || DEMO || MOBILE) return null
  return <details className="watch-handoff">
    <summary><Icon name="clock" /><span>{watchStatus(bridge, S, ui, now)}</span><Icon name="chevronDown" /></summary>
    <p className="small muted">{t('Keep the phone app open to receive watch entries. Saved on phone is separate from Google Drive sync.')}</p>
    {S.active?.entries.some(e => e.sets.some(s => s.warmup || s.phase === 'warmup')) && <p className="small muted">{t('Follow the phone’s warm-up rest timer. The watch does not time rest between warm-ups.')}</p>}
    <Button size="sm" icon="reset" disabled={bridge.busy} onClick={() => void bridge.transfer()}>{t('Sync now')}</Button>
    <a className="btn ghost" href="#/settings/data">{t('Watch settings')}</a>
  </details>
}
function exportReviews(review) {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ format: 'opengym-watch-review', entries: review }, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a'); a.href = url; a.download = 'uplift-watch-review.json'; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export default function GarminSection() {
  const bridge = useGarminSync(), S = useStore(s => s.S), ui = useUI()
  useEffect(() => { void bridge.checkServer() }, [])
  if (DEMO) return null
  const c = bridge.device.connection, review = S._watch?.review || []
  const pair = () => useUI.getState().openSheet(close => <PairWatchSheet close={close} />)
  const disconnect = () => confirmSheet({ title: t('Disconnect watch?'),
    message: t('Queued entries may still be on the watch. Sync first. Local workouts and review entries are kept.'),
    confirmText: t('Disconnect'), onConfirm: () => bridge.disconnect().catch(toastError) })
  return <Section title={t('Garmin watch')} footer={t('Keep the phone app open to receive watch entries. Saved on phone is separate from Google Drive sync.')}>
    <Row icon="clock" iconTint="var(--blue)" title={t('Uplift watch companion')}
      subtitle={MOBILE ? t('Use the watch companion in the browser or installed PWA.') : t('Forerunner 245 Music · reps, warm-ups and rest')} />
    {c && <Row icon="check" title={watchStatus(bridge, S, ui)} subtitle={bridge.phase === 'confirm' ? c.challenge : undefined} />}
    {bridge.error && <p className="small" role="alert">{t(bridge.error)}</p>}
    {!c && !MOBILE && <Row icon="link" title={t('Pair watch')} accessory="chevron" onClick={bridge.available && !bridge.busy ? pair : undefined}
      subtitle={!bridge.checked ? t('Checking…') : !bridge.available ? t('Watch relay is not available on this host yet.') : undefined} />}
    {!bridge.available && !MOBILE && <Row icon="reset" title={t('Retry')} onClick={() => void bridge.checkServer()} />}
    {c && <>
      <Row icon="reset" title={bridge.busy ? t('Syncing…') : t('Sync now')} onClick={bridge.busy ? undefined : () => void bridge.transfer()} />
      <Row icon="signOut" iconTint="var(--red)" title={t('Disconnect watch')} accessory="chevron" onClick={bridge.busy ? undefined : disconnect} />
      <details className="garmin-guide"><summary><span>{t('Watch preferences')}</span><Icon name="chevronDown" /></summary>
        <Row title={t('Vibration')}><Switch checked={bridge.device.preferences.vibrate} disabled={bridge.busy} onChange={vibrate => bridge.setPreferences({ vibrate })} /></Row>
        <Row title={t('Rest alert')}><Switch checked={bridge.device.preferences.restAlert} disabled={bridge.busy} onChange={restAlert => bridge.setPreferences({ restAlert })} /></Row>
      </details>
    </>}
    <details className="garmin-guide"><summary><span>{t('Watch guide')}</span><Icon name="chevronDown" /></summary><p className="small muted">{t('Use your existing Uplift Garmin app. Disconnect its old phone pairing and generate a new code for openGym.')}</p>
      <p className="small muted">{t('Configure on phone. Unsupported workouts stay on phone. Unreceived entries stay queued on your watch.')}</p>
      <p className="small muted">{t('Follow the phone’s warm-up rest timer. The watch does not time rest between warm-ups.')}</p>
      <a href="https://github.com/dafepro/openGym/blob/codex/focused-workout-overlay/docs/GARMIN.md" target="_blank" rel="noopener noreferrer">{t('Setup guide')}</a>
    </details>
    {!!review.length && <>
      <Row icon="info" iconTint="var(--orange)" title={t('Watch entries need review')} subtitle={t('Your phone results were kept. Export these entries before dismissing them.')} />
      <Button icon="share" onClick={() => exportReviews(review)}>{t('Export watch entries')}</Button>
      {review.map(({ operation: o }) => <Row key={o.id} title={o.exercise || o.kind} subtitle={o.kind ? o.session : `${o.weight} ${o.unit} × ${o.reps}`}
        onClick={() => confirmSheet({ title: t('Dismiss watch entry?'), message: t('This removes the review entry. Workout results stay unchanged.'), confirmText: t('Dismiss'),
          onConfirm: () => { try { useStore.getState().commitWatch(s => { s._watch.review = s._watch.review.filter(r => r.operation.id !== o.id) }) } catch (e) { toastError(e) } } })} accessory="chevron" />)}
    </>}
  </Section>
}
