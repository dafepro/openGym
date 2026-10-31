import { useMemo, useState } from 'react'
import { standardWorkouts, workoutSummary } from '../domain/standard-workouts.js'
import { Badge, Button, EmptyState, prescriptionLabel } from './ui.jsx'
import Dialog from './Dialog.jsx'
import Icon from './Icon.jsx'
import '../styles/starter-practices.css'

export default function StarterPractices({ onStart, onCustomize, disabled }) {
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const categories = [...new Set(standardWorkouts.map(item => item.category))]
  const visible = useMemo(() => standardWorkouts.filter(item => (!category || item.category === category) && `${item.assignment.title} ${item.description} ${item.category} ${item.assignment.drills.flatMap(drill => drill.metadata?.tags || []).join(' ')}`.toLowerCase().includes(search.toLowerCase().trim())), [category, search])
  return <section className="qt-starters" aria-label="Ready-made soccer practices">
    <div className="qt-starter-heading"><div><p className="qt-eyebrow">Pick a focus. Get moving.</p><h2>Ready-made practices</h2></div><Badge>{standardWorkouts.length}</Badge></div>
    <p className="qt-fine-print">Suggested starter sessions. Adjust the work to your level and take extra rest when needed.</p>
    <div className="qt-starter-filters"><label className="qt-field">Find a practice<input type="search" placeholder="Passing, agility, endurance…" value={search} onChange={event => setSearch(event.target.value)} /></label><label className="qt-field">Category<select value={category} onChange={event => setCategory(event.target.value)}><option value="">All focuses</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label></div>
    <div className="qt-starter-grid">{visible.map(item => {
      const info = workoutSummary(item.assignment)
      return <button type="button" className="qt-starter-card" key={item.assignment.id} onClick={() => setSelected(item)}>
        <span className="qt-starter-category"><Icon name="ball" size={18} />{item.category}</span><strong>{item.assignment.title}</strong><span className="qt-starter-description">{item.description}</span><span className="qt-starter-facts">{item.assignment.drills.length} drills · {info.people === 1 ? 'Solo' : `${info.people} players`}{info.seconds > 0 && <> · {Math.ceil(info.seconds / 60)} min{info.hasReps ? ' + reps' : ' work/rest'}</>}</span><span className="qt-starter-open">View practice <Icon name="arrow" size={15} /></span>
      </button>
    })}</div>
    {!visible.length && <EmptyState title="No matching practices">Try a different focus or clear your search.</EmptyState>}
    {selected && <Dialog className="qt-starter-dialog" title={selected.assignment.title} onClose={() => setSelected(null)} actions={<><Button icon="play" disabled={disabled} onClick={() => { setSelected(null); onStart(selected.assignment) }}>Start practice</Button><Button variant="secondary" disabled={disabled} onClick={() => { setSelected(null); onCustomize(selected.assignment) }}>Make it mine</Button></>}>
      <Badge>{selected.category} · Starter practice</Badge><p>{selected.description}</p><p className="qt-fine-print">Suggested amounts, not a trainer assignment. Read the setup, use a clear space, and slow down or rest whenever needed. These practices include written instructions.</p>
      <ol className="qt-starter-drills">{selected.assignment.drills.map(drill => <li key={drill.id}><strong>{drill.title}</strong><span>{prescriptionLabel(drill)}{drill.restSec > 0 ? ` · ${drill.restSec}s rest` : ''}</span><p>{drill.instructions}</p></li>)}</ol>
      <details className="qt-starter-sources"><summary>Coaching references</summary><p>Original practice adaptations; sets and timing are suggested starting points.</p>{selected.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>)}</details>
    </Dialog>}
  </section>
}
