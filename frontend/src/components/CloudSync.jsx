import { useEffect, useState } from 'react'
import { useCloudSync } from '../store/useCloudSync.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { fmtAgo } from '../lib/format.js'
import { DEMO } from '../lib/demo.js'
import { MOBILE } from '../lib/mobile.js'
import { loadGoogleIdentity, validClientId } from '../lib/google-drive.js'
import { confirmSheet } from '../sheets.jsx'
import { Section, Row, Button, TextField } from './ui.jsx'

const toast = message => useUI.getState().toast(message)
export function cloudStatusLine(cloud) {
  switch (cloud.status) {
    case 'ok': return t('All synced')
    case 'pending': return t('Waiting to sync')
    case 'syncing': case 'connecting': return t('Syncing…')
    case 'auth': return t('Reconnect Google Drive')
    case 'offline': return t('Offline. Your changes are saved on this device.')
    case 'paused': return t('Drive sync is paused for this profile.')
    case 'error': return cloud.error === 'google-data' ? t('Drive data could not be read. Nothing was replaced.') : t('Drive sync failed. Your changes are saved on this device.')
    default: return t('Connect Google Drive')
  }
}
export function driveErrorText(code) {
  if (code === 'client-id') return t('Enter a valid Google OAuth client ID.')
  if (code === 'google-account') return t('Choose the linked Google account, or disconnect Drive first.')
  if (code === 'google-popup' || code === 'google-denied') return t('Google connection cancelled. Allow the popup and try again.')
  if (code === 'google-load') return t('Google could not load. Check your connection and try again.')
  if (code === 'google-paused') return t('Drive sync is paused for this profile.')
  return t('Drive sync failed. Your changes are saved on this device.')
}
export function cloudConnectionView(cloud) {
  if (!cloud.connection || cloud.status === 'ok' || cloud.status === 'off') return null
  const pending = ['pending', 'syncing', 'connecting'].includes(cloud.status)
  return { tone: pending ? 'wait' : cloud.status === 'offline' ? 'off' : 'bad', icon: pending ? 'reset' : 'cloudSlash',
    line: cloudStatusLine(cloud), banner: 'Google Drive · ' + cloudStatusLine(cloud), action: 'drive', label: t('Google Drive') }
}
const askSync = account => new Promise(resolve => confirmSheet({
  title: t('Sync with Google Drive?'),
  message: account.label + '\n' + t('Merge history, plans and settings in both directions. Photos, videos and the current workout stay on this device.'),
  confirmText: t('Connect'), onConfirm: () => resolve(true), onCancel: () => resolve(false), locked: true,
}))

export function DriveSetupSheet({ close }) {
  const cloud = useCloudSync()
  const [value, setValue] = useState(cloud.clientId || '')
  const [error, setError] = useState(null)
  const save = () => {
    try { cloud.setClientId(value.trim()); close() }
    catch (e) { setError(driveErrorText(e.code)) }
  }
  return <>
    <h3>{t('Set up Google Drive')}</h3>
    <p className="muted small">{t('Use the same OAuth client ID on every device. No client secret is needed.')}</p>
    <label className="small" htmlFor="drive-client-id">{t('Google OAuth client ID')}</label>
    <TextField id="drive-client-id" value={value} onChange={e => setValue(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
    {error && <p role="alert" className="small" style={{ color: 'var(--red)' }}>{error}</p>}
    <p><a href="https://github.com/dafepro/openGym/blob/codex/focused-workout-overlay/docs/GOOGLE_DRIVE.md" target="_blank" rel="noopener noreferrer">{t('Setup guide')}</a></p>
    <Button variant="primary" disabled={!validClientId(value.trim())} onClick={save}>{t('Save')}</Button>
    <Button variant="ghost" onClick={close}>{t('Cancel')}</Button>
  </>
}

export default function CloudSyncSection() {
  const cloud = useCloudSync()
  const [ready, setReady] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [loading, setLoading] = useState(false)
  const busy = ['connecting', 'syncing'].includes(cloud.status)
  const load = () => {
    setLoading(true); setLoadFailed(false)
    return loadGoogleIdentity().then(() => setReady(true)).catch(() => setLoadFailed(true)).finally(() => setLoading(false))
  }
  useEffect(() => {
    if (!DEMO && !MOBILE && validClientId(cloud.clientId)) load()
  }, [cloud.clientId])
  if (DEMO) return null
  const setup = () => useUI.getState().openSheet(close => <DriveSetupSheet close={close} />)
  const connect = () => { cloud.connect(askSync).catch(e => { if (e.code !== 'cancelled') toast(driveErrorText(e.code)) }) }
  const disconnect = () => confirmSheet({
    title: t('Disconnect Google Drive?'),
    message: t('Local data and the copy in Drive are kept. Changes stop syncing.'),
    confirmText: t('Disconnect'), onConfirm: () => { try { cloud.disconnect() } catch { toast(t('Drive sync failed. Your changes are saved on this device.')) } },
  })
  return <Section title={t('Cloud sync')} footer={t('History, plans and settings. Photos and videos stay local.')}>
    <Row icon="cloud" iconTint="var(--blue)" title={t('Google Drive')}
      subtitle={MOBILE ? t('Use Google Drive in the browser or installed PWA.') : cloud.connection?.account.label || t('Optional. Your data saves locally first.')} />
    {!MOBILE && <>
      {cloud.connection && <Row icon={cloud.status === 'ok' ? 'check' : 'cloudSlash'} iconTint={cloud.status === 'ok' ? 'var(--green)' : 'var(--orange)'}
        title={cloudStatusLine(cloud)} subtitle={cloud.lastSynced ? t('Last synced: {0}', fmtAgo(cloud.lastSynced)) : undefined} />}
      {!cloud.clientId && <Row icon="wrench" title={t('Set up Google Drive')} accessory="chevron" onClick={setup} />}
      {cloud.clientId && (!cloud.connection || cloud.status === 'auth') && <Row icon="cloud" title={loading ? t('Loading…') : cloud.connection ? t('Reconnect Google Drive') : t('Connect Google Drive')}
        subtitle={loadFailed ? t('Google could not load. Check your connection and try again.') : undefined}
        accessory="chevron" onClick={busy || loading ? undefined : loadFailed ? load : ready ? connect : load} />}
      {cloud.connection && !['auth', 'paused'].includes(cloud.status) && <Row icon="reset" title={busy ? t('Syncing…') : t('Sync now')}
        onClick={busy ? undefined : async () => { const result = await cloud.syncNow(); toast(cloudStatusLine(result)) }} />}
      {!cloud.connection && !!cloud.clientId && <Row icon="wrench" title={t('Set up Google Drive')} accessory="chevron" onClick={busy ? undefined : setup} />}
      {cloud.connection && <Row icon="signOut" iconTint="var(--red)" title={t('Disconnect')} accessory="chevron" onClick={disconnect} />}
    </>}
  </Section>
}
