import { useAppUpdates, applyAppUpdate } from '../store/useAppUpdates.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import './AppUpdate.css'

export default function AppUpdate() {
  const { waiting, busy, error, dismissed } = useAppUpdates()
  if (!waiting || dismissed) return null
  return <aside className="app-update" aria-label={t('App update')}>
    <Icon name="reset" />
    <div><strong>{t('New Uplift ready')}</strong>{error && <p role="alert">{t(error)}</p>}</div>
    <button className="btn primary" disabled={busy} onClick={() => void applyAppUpdate()}>{t(busy ? 'Updating…' : 'Update')}</button>
    <button className="iconbtn" disabled={busy} aria-label={t('Later')} onClick={() => useAppUpdates.setState({ dismissed: true })}><Icon name="xmark" /></button>
  </aside>
}
