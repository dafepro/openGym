import { useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import PracticeSequence from '../components/PracticeSequence.jsx'
import { Button, EmptyState, countLabel } from '../components/ui.jsx'

export function recentPractices(history = []) {
  const found = new Set()
  return history.slice().reverse().filter(session => {
    const assignment = session.assignment
    if (!assignment?.drills?.length || found.has(`${assignment.id}:${assignment.revision}`)) return false
    found.add(`${assignment.id}:${assignment.revision}`)
    return true
  }).map(session => session.assignment)
}

export default function MyPracticesView({ saved = [], history = [], onStart, onAdapt, onNew, onRandom, onOwnDrill, onOpenDrill, onWatchDrill, disabled = false }) {
  const [tab, setTab] = useState(() => saved.length || !history.some(session => session.assignment?.drills?.length) ? 'saved' : 'recent')
  const [selected, setSelected] = useState(null)
  const recent = useMemo(() => recentPractices(history), [history])
  const list = tab === 'saved' ? saved : recent
  const chosen = list.find(item => `${item.id}:${item.revision}` === selected) || list[0]
  return <div className="qt-view pb-library">
    <header className="pb-view-heading"><div><p className="qt-eyebrow">Whole sessions</p><h1>My practices</h1></div><Button variant="text" icon="plus" onClick={onNew} disabled={disabled}>New practice</Button></header>
    <div className="pb-tabs" role="group" aria-label="Your practices"><button type="button" aria-pressed={tab === 'saved'} onClick={() => setTab('saved')}>Saved {saved.length > 0 && <span>{saved.length}</span>}</button><button type="button" aria-pressed={tab === 'recent'} onClick={() => setTab('recent')}>Recent {recent.length > 0 && <span>{recent.length}</span>}</button></div>
    {list.length ? <>
      <div className="pb-practice-choices" aria-label={tab === 'saved' ? 'Saved practices' : 'Recent practices'}>{list.map(practice => <button key={`${practice.id}:${practice.revision}`} type="button" className="pb-practice-choice" aria-pressed={practice === chosen} onClick={() => setSelected(`${practice.id}:${practice.revision}`)}><span><strong>{practice.title}</strong><small>{countLabel(practice.drills.length, 'drill')} · {tab === 'saved' ? 'Saved by you' : 'Your previous practice'}</small></span><Icon name={practice === chosen ? 'check' : 'arrow'} size={18}/></button>)}</div>
      <section className="pb-practice-sheet pb-selected-practice" aria-label="Selected whole practice"><div className="pb-section-heading"><h2>Inside this practice</h2><span>{countLabel(chosen.drills.length, 'drill')}</span></div><div className="pb-editor-actions"><Button icon="forward" disabled={disabled} onClick={() => onStart(chosen)}>Start this practice</Button><Button variant="secondary" icon="pencil" disabled={disabled} onClick={() => onAdapt(chosen)}>Make it fit today</Button></div><PracticeSequence drills={chosen.drills} onOpenDrill={onOpenDrill} onWatchDrill={onWatchDrill}/></section>
    </> : <EmptyState title={tab === 'saved' ? 'Your playbook starts here' : 'Your next practice starts the story'} icon="clipboard">{tab === 'saved' ? 'Save a practice you like, or make something for today.' : 'Completed and saved sessions appear here, ready to try again.'}</EmptyState>}
    <div className="pb-quick-actions"><button type="button" disabled={disabled} onClick={onRandom}><Icon name="shuffle"/><span><strong>Surprise me</strong><small>Choose a fresh mix</small></span><Icon name="arrow" size={16}/></button><button type="button" disabled={disabled} onClick={onOwnDrill}><Icon name="pencil"/><span><strong>My own drill</strong><small>Track something you know</small></span><Icon name="arrow" size={16}/></button></div>
  </div>
}
