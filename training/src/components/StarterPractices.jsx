import { useMemo, useState } from 'react'
import { standardWorkouts, workoutSummary } from '../domain/standard-workouts.js'
import { Badge, Button, EmptyState, prescriptionLabel } from './ui.jsx'
import Dialog from './Dialog.jsx'
import Icon from './Icon.jsx'
import Reveal from './Reveal.jsx'
import PracticeGlyph from './PracticeGlyph.jsx'
import '../styles/starter-practices.css'

const groups = ['All', 'Skills', 'Movement', 'Partner']
const movement = item => item.assignment.id.startsWith('std-move-')
export default function StarterPractices({ onStart, onCustomize, disabled }) {
  const [group, setGroup] = useState('All')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const visible = useMemo(() => standardWorkouts.filter(item => (group === 'All' || group === 'Movement' && movement(item) || group === 'Skills' && !movement(item) || group === 'Partner' && workoutSummary(item.assignment).people > 1) && `${item.assignment.title} ${item.description} ${item.category} ${item.assignment.drills.flatMap(drill => drill.metadata?.tags || []).join(' ')}`.toLowerCase().includes(search.toLowerCase().trim())), [group, search])
  const info = selected && workoutSummary(selected.assignment)
  return <section className="qt-starters" aria-label="Ready-made soccer practices">
    <label className="qt-practice-search"><Icon name="search" size={18}/><span className="qt-visually-hidden">Find a practice</span><input type="search" placeholder="Search practices" value={search} onChange={event => setSearch(event.target.value)} /></label>
    <div className="qt-focus-switch" role="group" aria-label="Practice focus" style={{'--focus-index': groups.indexOf(group)}}><i aria-hidden="true"/>{groups.map(value => <button key={value} type="button" aria-pressed={group === value} onClick={() => setGroup(value)}>{value}</button>)}</div>
    <div className="qt-library-count"><span>{visible.length} practices</span><span>Suggested · make them yours</span></div>
    <div className="qt-starter-grid" key={group}>{visible.map((item, index) => {
      const summary = workoutSummary(item.assignment)
      return <button type="button" className="qt-starter-card" style={{'--row-index': Math.min(index, 5)}} key={item.assignment.id} onClick={() => { setSelected(item); setExpanded(item.assignment.drills[0].id) }}>
        <PracticeGlyph movement={movement(item)} partner={summary.people > 1}/><span className="qt-starter-copy"><span className="qt-starter-category">{item.category}</span><strong>{item.assignment.title.replace(/^[^:]+: /, '')}</strong><span className="qt-starter-facts">{item.assignment.drills.length} drills · {Math.ceil(summary.seconds / 60)} min{summary.hasReps ? ' + reps' : ''} · {summary.people === 1 ? 'Solo' : `${summary.people} players`}</span></span><Icon name="arrow" size={16}/>
      </button>
    })}</div>
    {!visible.length && <EmptyState title="No matching practices" action="Clear search" onAction={() => {setSearch(''); setGroup('All')}}>Try a different focus.</EmptyState>}
    {selected && <Dialog className="qt-starter-dialog" title={selected.assignment.title} onClose={() => setSelected(null)} actions={<><Button icon="play" disabled={disabled} onClick={() => { setSelected(null); onStart(selected.assignment) }}>Start practice</Button><Button variant="secondary" disabled={disabled} onClick={() => { setSelected(null); onCustomize(selected.assignment) }}>Customize</Button></>}>
      <div className="qt-preview-facts"><Badge>{info.people === 1 ? 'Solo' : `${info.people} players`}</Badge><span>{Math.ceil(info.seconds / 60)} min work/rest{info.hasReps ? ' + reps' : ''}</span><span>{info.equipment.join(' · ')}</span></div>
      <p className="qt-preview-note">Suggested sets and timing. Adjust to your level.</p>
      <ol className="qt-starter-drills">{selected.assignment.drills.map((drill, index) => <li key={drill.id}><button type="button" className="qt-preview-drill" aria-expanded={expanded === drill.id} aria-controls={`preview-${drill.id}`} onClick={() => setExpanded(expanded === drill.id ? null : drill.id)}><span className="qt-preview-number">{index + 1}</span><span><strong>{drill.title}</strong><small>{prescriptionLabel(drill)}{drill.restSec > 0 ? ` · ${drill.restSec}s rest` : ''}</small></span><Icon name="arrow" size={16}/></button><Reveal open={expanded === drill.id} id={`preview-${drill.id}`}><p className="qt-preview-instructions">{drill.instructions}</p></Reveal></li>)}</ol>
      <details className="qt-starter-sources"><summary>Written instructions · coaching sources</summary><p>Original adaptations. Suggested doses are not trainer assignments.</p>{selected.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>)}</details>
    </Dialog>}
  </section>
}
