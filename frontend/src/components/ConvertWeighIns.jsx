import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { conversionRows, importedStretches, previewConversion, applyConversion, undoConversion } from '../lib/convert-weigh-ins.js'
import { Button } from './ui.jsx'

export function ConvertWeighIns({ close, onBackup }) {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const [from, setFrom] = useState('')
  const [selected, setSelected] = useState([])
  const [preview, setPreview] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const [error, setError] = useState(false)
  const rows = conversionRows(S, from)
  const reset = () => { setPreview(null); setError(false) }
  const apply = () => {
    let result
    update(s => { result = applyConversion(s, preview) })
    if (!result) { setError(true); setPreview(null); return }
    // update stamps edits after the producer returns; Undo must guard the committed version.
    const committed = useStore.getState().S
    result.after = JSON.parse(JSON.stringify(committed.bodyweight.filter(d => result.before.some(b => b.d === d.d))))
    setReceipt(result); setSelected([]); setPreview(null)
  }
  const undo = () => {
    let ok
    update(s => { ok = undoConversion(s, receipt) })
    if (ok) { setReceipt(null); setError(false) } else setError(true)
  }
  return <>
    <h3>{t('Convert weigh-ins')}</h3>
    <p>{t('Select only readings recorded in the wrong unit. Other weights and your unit preference stay unchanged.')}</p>
    <p>{t('Back up first. Changes sync to your other devices. Undo is available here until you close this screen, unless the readings change again.')}</p>
    <Button variant="tinted" onClick={onBackup}>{t('Back up first')}</Button>
    {error && <p role="alert">{t('The readings or settings changed. Review a fresh preview; nothing was overwritten.')}</p>}
    {receipt ? <>
      <p role="status">{t('Selected weigh-ins converted.')}</p>
      <Button onClick={undo}>{t('Undo')}</Button>
    </> : <>
      <Button variant="tinted" disabled={!!preview} onClick={() => { setFrom(S.unit === 'lb' ? 'kg' : 'lb'); setSelected([]); reset() }}>
        {t('Original unit')}: {S.unit === 'lb' ? 'kg → lb' : 'lb → kg'}
      </Button>
      {!preview && importedStretches(rows).map((group, i) => <div key={i}>
        <Button variant="tinted" onClick={() => { setSelected(group.rows.map(r => r.key)); reset() }}>
          {t('Review imported stretch')}: {group.source}, {group.rows[0].d} – {group.rows.at(-1).d} ({group.rows.length})
        </Button>
      </div>)}
      <div style={{ maxHeight: '40vh', overflowY: 'auto', margin: '12px 0' }}>
        {(preview ? preview.rows : rows).map(row => <label key={row.key} style={{ display: 'flex', gap: 8, padding: 8 }}>
          {!preview && <input type="checkbox" disabled={row.ambiguous} checked={selected.includes(row.key)} onChange={e => {
            setSelected(xs => e.target.checked ? [...xs, row.key] : xs.filter(x => x !== row.key)); reset()
          }} />}
          <span>{row.d} {row.at || ''}: {row.before} {from} → {row.after} {preview?.unit || S.unit}{row.ambiguous && <> ({t('Same-time readings need individual review.')})</>}</span>
        </label>)}
      </div>
      {preview ? <>
        <Button onClick={apply}>{t('Confirm conversion')}</Button>
        <Button variant="ghost" onClick={reset}>{t('Back')}</Button>
      </> : <Button disabled={!selected.length} onClick={() => { setPreview(previewConversion(S, from, selected)); setError(false) }}>{t('Preview conversion')}</Button>}
    </>}
    <Button variant="ghost" onClick={close}>{t('Close')}</Button>
  </>
}

export const convertWeighInsSheet = ({ onBackup }) => useUI.getState().openSheet(close => <ConvertWeighIns close={close} onBackup={onBackup} />)
