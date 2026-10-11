import { useEffect, useRef, useState } from 'react'
import { Button, TextField } from './ui.jsx'
import { t } from '../lib/i18n.js'
import { driveClientId } from '../lib/drive-config.js'
import { authorizeDrive, loadGoogleIdentity } from '../lib/google-drive.js'
import { driveFileId, readDriveImport, DRIVE_IMPORT_SCOPE } from '../lib/drive-import.js'
import { useUI } from '../store/useUI.js'
import { importDataFile } from '../sheets.jsx'

export const importFromDrive = ({ onBackup } = {}) => useUI.getState().openSheet(close => <DriveImport close={close} onBackup={onBackup} />)
export default function DriveImport({ close, onBackup }) {
  const file = useRef(null), controller = useRef(null)
  const [link, setLink] = useState(''), [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  useEffect(() => { let live = true; loadGoogleIdentity().then(() => { if (live) setReady(true) }).catch(() => {}); return () => { live = false; controller.current?.abort() } }, [])
  const read = async () => {
    if (controller.current && !controller.current.signal.aborted && busy) return
    let id
    try { id = driveFileId(link) } catch (e) { setError(e.message); return }
    setBusy(true); setError(''); controller.current = new AbortController()
    try {
      // Separate consent from app-data sync; neither token is persisted or
      // added to the existing sync provider. Fixed Google origins only.
      const auth = await authorizeDrive(driveClientId, DRIVE_IMPORT_SCOPE)
      if (controller.current.signal.aborted) return
      const selected = await readDriveImport(id, auth, { signal: controller.current.signal })
      if (!controller.current.signal.aborted) importDataFile(selected, close, onBackup)
    } catch (e) { if (!controller.current.signal.aborted) setError(e.message) }
    finally { setBusy(false) }
  }
  return <>
    <h3>{t('Import from Google Drive')}</h3>
    <p className="small muted">{t('Choose Google Drive in your phone’s file picker. Plans, backups (.json) or workout exports (.csv). Review before importing.')}</p>
    <Button variant="primary" icon="folder" disabled={busy} onClick={() => file.current?.click()}>{t('Choose file')}</Button>
    <input ref={file} type="file" accept=".json,.csv,.xml,application/json,text/csv,text/xml" hidden onChange={e => { const selected = e.target.files?.[0]; e.target.value = ''; importDataFile(selected, close, onBackup) }} />
    <details className="garmin-guide"><summary>{t('Use a Drive link')}</summary>
      <label htmlFor="drive-import-link">{t('Google Drive file link')}</label>
      <TextField id="drive-import-link" type="url" value={link} onChange={e => setLink(e.target.value)} />
      <p className="small muted">{t('Google grants read-only Drive access. Uplift downloads only this file. This does not enable sync.')}</p>
      <Button disabled={!ready || !link.trim() || busy} onClick={() => void read()}>{t(busy ? 'Loading…' : 'Read from Drive')}</Button>
    </details>
    {error && <p role="alert">{t(error)}</p>}
    <Button variant="ghost" onClick={close}>{t('Cancel')}</Button>
  </>
}
