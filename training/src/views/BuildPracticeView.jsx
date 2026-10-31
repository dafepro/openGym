import { useMemo, useState } from 'react'
import { rankTrainingDrills } from '../domain/recommendations.js'
import { normalizeTrainingTags, SKILL_REGISTRY } from '../domain/metadata.js'
import { changePrescription } from '../domain/practice-builder.js'
import { Badge, Button, EmptyState, PageHeading, prescriptionLabel, countLabel, isVideoReview } from '../components/ui.jsx'
import Dialog from '../components/Dialog.jsx'
import Icon from '../components/Icon.jsx'
import StarterPractices from '../components/StarterPractices.jsx'

const label = tag => tag.replace(/^futbol:/, '').replaceAll('-', ' ')
const number = value => value === '' ? '' : Number(value)

export default function BuildPracticeView({ draft, onChange, library, saved, history, activeSession, onSave, onStart, onShare, onLoad, onNew, onPreview, onStartTemplate, onCustomizeTemplate, disabled = false }) {
  const [search, setSearch] = useState('')
  const [focus, setFocus] = useState('')
  const [setting, setSetting] = useState('')
  const [strategy, setStrategy] = useState('balanced')
  const [custom, setCustom] = useState(null)
  const [added, setAdded] = useState('')
  const [customError, setCustomError] = useState('')
  const [expanded, setExpanded] = useState(null)
  const suggestions = useMemo(() => rankTrainingDrills(library.map((drill, index) => ({ candidateId: `library-${index}`, drill })), {
    now: Date.now(), history, activeSession, strategy, plannedDrills: draft.drills,
    focusSkills: focus ? [focus] : [], context: setting ? { setting } : {},
  }).filter(({ drill }) => `${drill.title} ${drill.instructions} ${(drill.metadata?.tags || []).join(' ')}`.toLowerCase().includes(search.trim().toLowerCase())), [library, history, activeSession, strategy, focus, setting, search, draft.drills])
  const update = (id, fields) => onChange({ ...draft, drills: draft.drills.map(drill => drill.id === id ? changePrescription(drill, fields) : drill) })
  const add = drill => {
    const next = { ...structuredClone(drill), id: `drill-${crypto.randomUUID()}` }
    onChange({ ...draft, drills: [...draft.drills, next] }); setExpanded(next.id); setAdded(drill.title)
  }
  const move = (index, direction) => {
    const drills = draft.drills.slice(); const target = index + direction
    if (target < 0 || target >= drills.length) return
    ;[drills[index], drills[target]] = [drills[target], drills[index]]
    onChange({ ...draft, drills })
  }
  const createCustom = () => {
    try {
      if (!custom.title.trim() || !custom.instructions.trim()) throw new Error('Add a drill name and instructions.')
      const tags = normalizeTrainingTags(custom.tags.split(',').map(tag => tag.trim()).filter(Boolean))
      add({ title: custom.title.trim(), instructions: custom.instructions.trim(), mode: 'practice', sets: 1, side: 'both', restSec: null, media: { id: `custom-${crypto.randomUUID()}`, status: 'unavailable' }, metadata: { version: 1, registryVersion: 1, tags } })
      setCustom(null); setCustomError('')
    } catch (error) { setCustomError(error.message) }
  }
  return <div className="qt-view qt-builder">
    <PageHeading eyebrow="Choose your focus. Make it yours." title="Build practice">Pick your drills, set the work, and take it to the pitch.</PageHeading>
    <details className="qt-build-tools" open={draft.drills.length > 0 || undefined}><summary>Build your own practice{draft.drills.length ? ` · ${draft.drills.length} drills` : ''}</summary>
    <Button variant="text" icon="plus" onClick={onNew} disabled={disabled}>New practice</Button>
    <section id="practice-draft" className="qt-builder-plan" aria-label="Your practice">
      <div className="qt-builder-section-title"><span className="qt-eyebrow">Your practice</span><Badge tone="active">{countLabel(draft.drills.length, 'drill')}</Badge></div>
      <label className="qt-field">Practice name<input maxLength={240} placeholder="A name for today’s session" value={draft.title} onChange={event => onChange({ ...draft, title: event.target.value })} disabled={disabled} /></label>
      {!draft.drills.length ? <div className="qt-builder-empty"><Icon name="ball" size={30} /><p>Start with a drill below.<br /><span>Build a short focus session or a full practice.</span></p></div> : <ol className="qt-builder-selected">{draft.drills.map((drill, index) => <li key={drill.id}>
        <div className="qt-builder-selected-heading"><span className="qt-drill-number">{index + 1}</span><button type="button" className="qt-builder-edit" aria-expanded={expanded === drill.id} onClick={() => setExpanded(expanded === drill.id ? null : drill.id)}><strong>{drill.title}</strong><small>{prescriptionLabel(drill)}</small></button><button type="button" className="qt-icon-button" aria-label={`Remove ${drill.title}`} disabled={disabled} onClick={() => onChange({ ...draft, drills: draft.drills.filter(item => item.id !== drill.id) })}><Icon name="close" size={18} /></button></div>
        {expanded === drill.id && <div className="qt-builder-prescription">
          <label className="qt-field">How to practice<select value={drill.mode} disabled={disabled} onChange={event => update(drill.id, { mode: event.target.value, ...(event.target.value === 'reps' ? { reps: '' } : event.target.value === 'time' ? { durationSec: '' } : {}) })}><option value="practice">Self-paced drill</option><option value="watch">Watch / review</option><option value="reps">Repetitions</option><option value="time">Timed work</option></select></label>
          {['reps', 'time'].includes(drill.mode) && <><div className="qt-field-grid"><label className="qt-field">Sets<input type="number" min="1" max="100" step="1" value={drill.sets} disabled={disabled} onChange={event => update(drill.id, { sets: number(event.target.value) })} /></label><label className="qt-field">{drill.mode === 'reps' ? 'Reps per set' : 'Seconds per set'}<input type="number" min="1" max={drill.mode === 'reps' ? 10000 : 86400} step="1" placeholder="Set a target" value={drill.mode === 'reps' ? drill.reps : drill.durationSec} disabled={disabled} onChange={event => update(drill.id, { [drill.mode === 'reps' ? 'reps' : 'durationSec']: number(event.target.value) })} /></label></div><div className="qt-field-grid"><label className="qt-field">Feet<select value={drill.side} disabled={disabled} onChange={event => update(drill.id, { side: event.target.value })}><option value="both">Either foot</option><option value="each">Each foot separately</option></select></label><label className="qt-field">Rest (seconds)<input type="number" min="0" max="3600" step="1" placeholder="As needed" value={drill.restSec ?? ''} disabled={disabled} onChange={event => update(drill.id, { restSec: event.target.value === '' ? null : Number(event.target.value) })} /></label></div></>}
          <div className="qt-builder-order"><Button variant="text" disabled={disabled || index === 0} onClick={() => move(index, -1)}>Move up</Button><Button variant="text" disabled={disabled || index === draft.drills.length - 1} onClick={() => move(index, 1)}>Move down</Button><Button variant="text" onClick={() => onPreview(drill, index)}>View drill</Button></div>
        </div>}
      </li>)}</ol>}
      {draft.drills.length > 0 && <div className="qt-builder-actions"><Button icon="play" disabled={disabled} onClick={onStart}>{isVideoReview({ drills: draft.drills }) ? 'Start review' : 'Start practice'}</Button><div className="qt-field-grid"><Button variant="secondary" disabled={disabled} onClick={onSave}>Save practice</Button><Button variant="secondary" onClick={onShare}>Share link</Button></div></div>}
      <p className="qt-fine-print">{draft.id ? 'Editing your saved practice. Save to keep changes.' : 'Your draft is unsaved. Save it to keep it on this device.'}</p>
    </section>
    <section className="qt-builder-library" aria-labelledby="drill-library-heading">
      <div className="qt-builder-section-title"><div><p className="qt-eyebrow">Find your next drill</p><h2 id="drill-library-heading">Drill library</h2></div><Button variant="text" disabled={disabled} onClick={() => { setCustom({ title: '', instructions: '', tags: '' }); setCustomError('') }}>+ Custom drill</Button></div>
      <label className="qt-field">Search drills<input type="search" placeholder="First touch, passing, cones…" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <div className="qt-field-grid"><label className="qt-field">Focus<select value={focus} onChange={event => setFocus(event.target.value)}><option value="">All skills</option>{Object.keys(SKILL_REGISTRY).map(tag => <option key={tag} value={tag}>{label(tag)}</option>)}</select></label><label className="qt-field">Where<select value={setting} onChange={event => setSetting(event.target.value)}><option value="">Any setting</option><option value="outdoor">Outdoor</option><option value="indoor">Indoor</option></select></label></div>
      <div className="qt-builder-ranking"><label className="qt-field">Suggestions<select value={strategy} onChange={event => setStrategy(event.target.value)}><option value="balanced">Balance my practice</option><option value="reinforce">Reinforce recent skills</option><option value="diversify">Try something different</option></select></label><p>Balances this draft with skills you’ve practiced on this device.</p></div>
      {added && <div className="qt-builder-added" role="status"><span>Added {added}</span><Button variant="text" onClick={() => document.getElementById('practice-draft')?.scrollIntoView({ block: 'start', behavior: 'instant' })}>Edit practice</Button></div>}
      <div className="qt-library-grid">{suggestions.map(({ candidateId, drill, skills, breakdown }, index) => <article className="qt-library-card" key={candidateId}>
        <div className="qt-library-card-top"><span className="qt-library-symbol"><Icon name="ball" size={24} /></span>{index === 0 && <Badge tone="active">Suggested</Badge>}</div>
        <h3>{drill.title}</h3><p>{skills.slice(0, 3).map(label).join(' · ') || 'Custom focus'}</p>
        <div className="qt-library-tags">{(drill.metadata?.requirements?.equipment || []).map(item => <span key={item}>{item}</span>)}</div>
        <small>{breakdown.focus > 0 ? 'Matches your focus' : breakdown.reinforcement > 0 ? 'Builds on recent practice' : 'Adds skill coverage'}</small>
        <div className="qt-library-card-actions"><Button variant="secondary" disabled={disabled || draft.drills.length >= 100} onClick={() => add(drill)} icon="plus">Add drill</Button><button type="button" className="qt-icon-button" aria-label={`Preview ${drill.title}`} onClick={() => onPreview(drill, index)}><Icon name="video" /></button></div>
      </article>)}</div>
      {!suggestions.length && <EmptyState title="No matching drills">Try another skill or setting, or add a custom drill.</EmptyState>}
    </section>
    {saved.length > 0 && <section className="qt-builder-saved" aria-label="Saved practices"><div className="qt-builder-section-title"><h2>Saved practices</h2><Badge>{saved.length}</Badge></div>{saved.map(practice => <button type="button" key={practice.id} className="qt-drill-row" disabled={disabled} onClick={() => onLoad(practice)}><Icon name="ball" /><span className="qt-drill-copy"><strong>{practice.title}</strong><small>{countLabel(practice.drills.length, 'drill')} · Edit or start</small></span><Icon name="arrow" /></button>)}</section>}
    </details>
    {onStartTemplate && <StarterPractices onStart={onStartTemplate} onCustomize={onCustomizeTemplate} disabled={disabled} />}
    {custom && <Dialog title="Add your own drill" onClose={() => setCustom(null)} actions={<Button onClick={createCustom}>Add to practice</Button>}><div className="qt-custom-form"><label className="qt-field">Drill name<input maxLength={240} value={custom.title} onChange={event => setCustom({ ...custom, title: event.target.value })} /></label><label className="qt-field">Instructions<textarea maxLength={2000} rows={4} value={custom.instructions} onChange={event => setCustom({ ...custom, instructions: event.target.value })} /></label><label className="qt-field">Tags, separated by commas<input placeholder="futbol:passing, wall, weak foot" value={custom.tags} onChange={event => setCustom({ ...custom, tags: event.target.value })} /></label><p className="qt-fine-print">Choose sets or a timer after adding. This custom drill has no video attached.</p>{customError && <p role="alert">{customError}</p>}</div></Dialog>}
  </div>
}
