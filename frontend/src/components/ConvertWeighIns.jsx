import { useId, useRef, useState, useEffect } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t, exerciseNameFor } from '../lib/i18n.js'
import { conversionRows, importedStretches, previewConversion, applyConversion, undoConversion } from '../lib/convert-weigh-ins.js'
import { importedLoadRows, previewImportedLoads, applyImportedLoads, undoImportedLoads } from '../lib/convert-imported-loads.js'
import { exerciseOf } from '../lib/exercises.js'
import { Button, Check, Segmented, Section, Row } from './ui.jsx'
import './import-unit-repair.css'

const adapters = {
  weight: { rows: conversionRows, preview: previewConversion, apply: applyConversion, undo: undoConversion, collection: 'bodyweight', identity: 'd' },
  loads: { rows: importedLoadRows, preview: previewImportedLoads, apply: applyImportedLoads, undo: undoImportedLoads, collection: 'workouts', identity: 'id' },
}
const number = value => new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(value)
const copy = value => JSON.parse(JSON.stringify(value))

// One review boundary for both types. Choosing an import group is a convenience, not
// evidence its units are wrong: nothing is selected or written automatically.
export function ConvertWeighIns({ close, onBackup }) {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const uid = useId()
  const title = useRef(null)
  const [category, setCategory] = useState('weight')
  const [from, setFrom] = useState('')
  const [selected, setSelected] = useState([])
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [preview, setPreview] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const [error, setError] = useState(false)
  const adapter = adapters[category]
  const rows = adapter.rows(S, from)
  const visible = rows.filter(row => (!start || row.d >= start) && (!end || row.d <= end))
  const selectedKeys = new Set(selected)
  const count = rows.filter(row => !row.ambiguous && selectedKeys.has(row.key)).length
  const step = receipt ? 3 : preview ? 2 : from ? 1 : 0
  useEffect(() => { title.current?.focus() }, [step])
  const reset = () => { setPreview(null); setError(false) }
  const chooseCategory = value => {
    setCategory(value); setFrom(''); setSelected([]); setStart(''); setEnd(''); reset()
  }
  const selectGroup = group => { setSelected(group.map(row => row.key)); reset() }
  const groups = category === 'weight' ? importedStretches(visible).map(group => ({
    key: group.rows[0].key, name: t('Review imported stretch'), rows: group.rows,
  })) : Array.from(visible.reduce((map, row) => {
    const group = map.get(row.id) || []; group.push(row); map.set(row.id, group); return map
  }, new Map()).values()).map(group => ({ key: group[0].id, name: group[0].name || t('Possible imported workout'), rows: group }))
  const exerciseLabel = row => {
    const exercise = exerciseOf(row.exercise) || (S.customEx || []).find(ex => ex.id === row.exercise)
    return exercise ? exerciseNameFor(exercise) : (S.workouts || []).find(w => w.id === row.id)?.entries?.find(ex => ex.id === row.exercise)?.n || row.exercise
  }
  const label = row => category === 'loads'
    ? `${row.d} · ${exerciseLabel(row)} · ${t('Set')} ${row.set}${row.detail ? ` · ${row.detail}` : ''}`
    : `${row.d}${row.at ? ` · ${row.at}` : ''}`
  const values = row => <span className="unit-repair-values"><span>{number(row.before)} {from}</span><span aria-hidden="true">→</span><strong>{number(row.after)} {preview?.unit || S.unit}</strong></span>
  const apply = () => {
    let result
    update(s => { result = adapter.apply(s, preview) })
    if (!result) { setError(true); setPreview(null); return }
    // Store stamps edits after the producer. Guard Undo against the committed version.
    const committed = useStore.getState().S
    result.after = copy(committed[adapter.collection].filter(day => result.before.some(before => before[adapter.identity] === day[adapter.identity])))
    setReceipt({ ...result, count: preview.rows.length }); setSelected([]); setPreview(null)
  }
  const undo = () => {
    let ok
    update(s => { ok = adapter.undo(s, receipt) })
    if (ok) { setReceipt(null); setError(false); setFrom(''); setSelected([]) } else setError(true)
  }
  return <div className="unit-repair">
    <header className="unit-repair-header">
      <p className="unit-repair-eyebrow">{t('Import repair')}</p>
      <h3 ref={title} tabIndex={-1}>{receipt ? t('Conversion complete') : preview ? t('Review your changes') : t('Repair imported units')}</h3>
      <p className="unit-repair-muted">{receipt ? t('Only your selected values changed.') : preview ? t('Check the original unit and every new value before confirming.') : t('Fix unit mix-ups without changing your weight preference.')}</p>
    </header>
    {!receipt && <ol className="unit-repair-steps" aria-label={t('Repair progress')}>
      {[t('Choose'), t('Select'), t('Review')].map((name, i) => <li key={name} aria-current={step === i ? 'step' : undefined} className={step >= i ? 'active' : ''}><span aria-hidden="true">{i + 1}</span>{name}</li>)}
    </ol>}
    {error && <div className="unit-repair-notice" role="alert">{receipt ? t('These records changed after conversion. Undo is unavailable to protect newer edits.') : t('The readings or settings changed. Review a fresh preview; nothing was overwritten.')}</div>}
    {receipt ? <>
      <Section title={t('Saved')}><Row title={category === 'weight' ? t('Weigh-ins') : t('Workout loads')} value={String(receipt.count)} /><Row title={t('Conversion')} value={`${from} → ${receipt.unit}`} /></Section>
      <p className="unit-repair-muted">{t('Changes sync to your other devices. Undo is available here until you close this screen, unless these records change again.')}</p>
      <div className="unit-repair-actions"><Button variant="tinted" onClick={undo} disabled={error}>{t('Undo')}</Button><Button variant="primary" onClick={close}>{t('Done')}</Button></div>
    </> : preview ? <>
      <Section title={t('Conversion')} footer={t('Your weight preference, unselected values and other record types stay unchanged.')}>
        <Row title={t('Original unit')} value={from} /><Row title={t('Corrected unit')} value={preview.unit} /><Row title={t('Selected values')} value={String(preview.rows.length)} />
      </Section>
      <div className="unit-repair-records" role="region" aria-label={t('Conversion preview')} tabIndex={0}>
        {preview.rows.map(row => <div className="unit-repair-record" key={row.key}><div className="unit-repair-record-text"><span>{label(row)}</span>{values(row)}</div></div>)}
      </div>
      <p className="unit-repair-muted">{t('This changes saved history and syncs to your other devices. Check your source file if you are unsure.')}</p>
      <div className="unit-repair-actions"><Button variant="tinted" onClick={reset}>{t('Back')}</Button><Button variant="primary" onClick={apply}>{t('Confirm conversion')}</Button></div>
    </> : <>
      <h4 id={`${uid}-category`}>{t('What needs fixing?')}</h4>
      <Segmented ariaLabelledby={`${uid}-category`} options={[{ value: 'weight', label: t('Weigh-ins') }, { value: 'loads', label: t('Workout loads') }]} value={category} onChange={chooseCategory} />
      <details className="unit-repair-help"><summary>{t('Which imported values can I fix?')}</summary><p>{t('Weigh-ins and weights in recognized imported workouts are supported. Select only values you know were imported in the wrong unit. Suggestions identify possible imports, not confirmed errors.')}</p><p>{t('Measurements, distances, durations and routine targets use different units or lack reliable import history. They are not changed here. Active workouts and workouts with saved personal records are excluded.')}</p></details>
      <Section title={t('Original unit')} footer={t('Choose the unit used by the original numbers, not the label currently shown in the app.')}>
        <Row title={`${S.unit === 'lb' ? 'kg' : 'lb'} → ${S.unit}`} subtitle={t('Convert into your current weight unit')} accessory={from ? 'check' : 'chevron'} onClick={() => { setFrom(S.unit === 'lb' ? 'kg' : 'lb'); setSelected([]); reset() }} />
      </Section>
      {from && <>
        {rows.length ? <>
          {!!groups.length && <Section title={t('Suggested groups')} footer={t('Choose a group, then uncheck anything that is already correct. Choosing another group replaces your selection.')}>
            <div className="unit-repair-groups">{groups.map(group => <Row key={group.key} title={group.name} subtitle={`${group.rows[0].d}${group.rows[0].d !== group.rows.at(-1).d ? ` – ${group.rows.at(-1).d}` : ''} · ${group.rows.length}`} accessory="chevron" onClick={() => selectGroup(group.rows)} />)}</div>
          </Section>}
          <details className="unit-repair-help"><summary>{t('Filter by date')}</summary><div className="unit-repair-dates"><label>{t('From date')}<input className="field" type="date" value={start} onChange={event => { setStart(event.target.value); setSelected([]) }} /></label><label>{t('To date')}<input className="field" type="date" value={end} onChange={event => { setEnd(event.target.value); setSelected([]) }} /></label></div></details>
          <div className="unit-repair-records" role="region" aria-label={t('Choose values to convert')} tabIndex={0}>
            {visible.map(row => <div className={`unit-repair-record${selectedKeys.has(row.key) ? ' selected' : ''}`} key={row.key}>
              {!row.ambiguous && <Check checked={selectedKeys.has(row.key)} label={`${label(row)}: ${number(row.before)} ${from} → ${number(row.after)} ${S.unit}`} onChange={checked => { setSelected(keys => checked ? [...keys, row.key] : keys.filter(key => key !== row.key)); reset() }} />}
              <div className="unit-repair-record-text"><span>{label(row)}</span>{values(row)}<small>{row.ambiguous ? t('Same-time readings need individual review.') : category === 'weight' ? row.src === 'import' ? t('Imported') : t('Other source — check before selecting') : row.name || t('Possible imported workout')}</small></div>
            </div>)}
            {!visible.length && <p className="unit-repair-empty">{t('No values in this date range. Try different dates.')}</p>}
          </div>
        </> : <p className="unit-repair-empty">{t('No eligible values found in this category. Nothing will be changed.')}</p>}
      </>}
      <div className="unit-repair-backup"><span className="unit-repair-muted">{t('Keep a backup before changing history.')}</span><Button size="sm" variant="ghost" onClick={onBackup}>{t('Back up first')}</Button></div>
      <div className="unit-repair-footer">{from && <div className="unit-repair-selection"><h4 aria-live="polite">{t('Selected values')}: {count}</h4><Button size="sm" variant="ghost" disabled={!count} onClick={() => setSelected([])}>{t('Clear selection')}</Button></div>}<div className="unit-repair-actions"><Button variant="tinted" onClick={close}>{t('Close')}</Button><Button variant="primary" disabled={!count} onClick={() => { setPreview(adapter.preview(S, from, selected)); setError(false) }}>{t('Preview conversion')}</Button></div></div>
    </>}
  </div>
}

export const convertWeighInsSheet = ({ onBackup }) => useUI.getState().openSheet(close => <ConvertWeighIns close={close} onBackup={onBackup} />)
