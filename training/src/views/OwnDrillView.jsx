import { useEffect, useRef, useState } from 'react'
import { SKILL_REGISTRY } from '../domain/metadata.js'
import { compactTarget } from '../domain/drill-selection.js'
import { Button } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import Disclosure from '../components/Disclosure.jsx'

export const initialOwnDrill = { title: '', setup: '', instructions: '', mode: 'practice', sets: 1, reps: 10, durationSec: 45, side: 'both', restSec: 20, skill: '', extraTags: '' }
const label = value => value.replace(/^futbol:/, '').replaceAll('-', ' ')
export default function OwnDrillView({ savedDrills = [], onSubmit, onStartSaved, onAddSaved, onEditSaved, onCancelEdit, onDelete, editingId, adding = false, disabled = false, storageError, value, onChange }) {
  const [localFields, setLocalFields] = useState(initialOwnDrill)
  const fields = value || localFields
  const setFields = onChange || setLocalFields
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const editor = useRef(null)
  useEffect(() => { if (editingId) { setError(''); editor.current?.querySelector('input')?.focus({ preventScroll: true }); editor.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }) } }, [editingId])
  const update = (key, value) => { setFields(current => ({ ...current, [key]: value })); setError('') }
  const submit = async intent => {
    if (pending || disabled || storageError) return
    setPending(true); setError('')
    try {
      const { skill, extraTags, ...details } = fields
      await onSubmit({ ...details, tags: [skill, ...extraTags.split(',').map(tag => tag.trim())].filter(Boolean) }, intent)
    } catch (failure) { setError(failure.message) }
    finally { setPending(false) }
  }
  return <div className="pb-own-drill">
    {savedDrills.length > 0 && <Disclosure className="pb-saved-drills" summary={<>My saved drills <span className="pb-disclosure-count">{savedDrills.length}</span></>}><div>{savedDrills.map(drill => <article className="pb-own-saved-row" key={drill.id}><span><strong>{drill.title}</strong><small>{compactTarget(drill)}</small></span><div className="pb-own-row-actions">{onEditSaved && <Button variant="text" aria-label={`Edit ${drill.title}`} disabled={disabled || pending} onClick={() => onEditSaved(drill)}>Edit</Button>}<Button variant="secondary" icon={adding ? 'plus' : 'play'} disabled={disabled || pending} onClick={() => adding ? onAddSaved(drill) : onStartSaved(drill)}>{adding ? 'Add' : 'Start'}</Button></div></article>)}</div></Disclosure>}
    <p className="pb-own-intro">Name your drill, jot down how it works, then track your time or sets.</p>
    <form ref={editor} noValidate onSubmit={event => { event.preventDefault(); void submit(editingId ? 'update' : adding ? 'add' : 'start') }}>
      <label className="qt-field">Drill name<input autoComplete="off" maxLength={240} required placeholder="e.g. Backyard close touches" value={fields.title} onChange={event => update('title', event.target.value)}/></label>
      <label className="qt-field">Setup <span className="pb-optional">optional</span><input maxLength={500} placeholder="Ball, two markers, a little space" value={fields.setup} onChange={event => update('setup', event.target.value)}/></label>
      <label className="qt-field">How to do it<textarea required maxLength={1400} rows={3} placeholder="What will you practice? Add a cue to remember." value={fields.instructions} onChange={event => update('instructions', event.target.value)}/></label>
      <fieldset className="pb-tracking-options"><legend>Track my work</legend><div className="pb-tabs">{[['practice','Time spent'],['time','Timed sets'],['reps','Reps & sets']].map(([mode,name]) => <button key={mode} type="button" aria-pressed={fields.mode === mode} onClick={() => update('mode', mode)}>{name}</button>)}</div></fieldset>
      {fields.mode === 'practice' ? <p className="qt-fine-print"><Icon name="clock" size={14}/> Your timer counts up. Finish when you are done.</p> : <div className="pb-own-targets">
        <fieldset className="pb-preset-group"><legend>{fields.mode === 'time' ? 'Seconds per set' : 'Reps per set'}</legend><div className="qt-target-presets">{(fields.mode === 'time' ? [30,45,60,90] : [5,10,15,20]).map(value => <button type="button" key={value} aria-pressed={(fields.mode === 'time' ? fields.durationSec : fields.reps) === value} onClick={() => update(fields.mode === 'time' ? 'durationSec' : 'reps', value)}>{value}{fields.mode === 'time' ? 's' : ''}</button>)}</div></fieldset>
        <fieldset className="pb-preset-group"><legend>Sets</legend><div className="qt-target-presets">{[1,2,3,4].map(value => <button type="button" key={value} aria-pressed={fields.sets === value} onClick={() => update('sets', value)}>{value}</button>)}</div></fieldset>
        <Disclosure className="pb-fine-tune" summary="Fine-tune targets"><div className="qt-field-grid"><label className="qt-field">{fields.mode === 'time' ? 'Seconds per set' : 'Reps per set'}<input type="number" min={1} max={fields.mode === 'time' ? 86400 : 10000} step={1} value={fields.mode === 'time' ? fields.durationSec : fields.reps} onChange={event => update(fields.mode === 'time' ? 'durationSec' : 'reps', event.target.value === '' ? '' : Number(event.target.value))}/></label><label className="qt-field">Sets<input type="number" min={1} max={100} step={1} value={fields.sets} onChange={event => update('sets', event.target.value === '' ? '' : Number(event.target.value))}/></label><label className="qt-field">Feet<select value={fields.side} onChange={event => update('side', event.target.value)}><option value="both">Either foot</option><option value="each">Each foot</option></select></label><label className="qt-field">Rest (seconds)<input type="number" min={0} max={3600} step={1} value={fields.restSec} onChange={event => update('restSec', event.target.value === '' ? '' : Number(event.target.value))}/></label></div></Disclosure>
      </div>}
      <Disclosure className="pb-fine-tune" summary={<>Add skill labels <span className="pb-optional">optional</span></>}><label className="qt-field">Skill<select value={fields.skill} onChange={event => update('skill', event.target.value)}><option value="">Choose a skill</option>{Object.keys(SKILL_REGISTRY).map(tag => <option key={tag} value={tag}>{label(tag)}</option>)}</select></label><label className="qt-field">Your labels<input maxLength={300} placeholder="backyard, weak foot" value={fields.extraTags} onChange={event => update('extraTags', event.target.value)}/></label></Disclosure>
      {(error || storageError) && <p className="pb-form-error" role="alert">{error || storageError}</p>}
      <div className="pb-editor-actions"><button className="qt-button qt-button--primary" type="submit" disabled={disabled || pending || !!storageError}><span>{pending ? 'Saving…' : editingId ? 'Save changes' : adding ? 'Save & add drill' : 'Start my drill'}</span><Icon name="forward"/></button><Button variant="secondary" disabled={disabled || pending || !!storageError} onClick={() => editingId ? onCancelEdit() : submit('save')}>{editingId ? 'Cancel edit' : 'Save for later'}</Button></div>
      {editingId && <Button variant="text" className="pb-delete-drill" disabled={disabled || pending || !!storageError} onClick={onDelete}>Delete drill</Button>}
      <p className="qt-fine-print">Your drill is saved on this device. Your work appears in Me.</p>
    </form>
  </div>
}
