import { useEffect, useId, useMemo, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import PracticeSequence from '../components/PracticeSequence.jsx'
import Reveal from '../components/Reveal.jsx'
import { practiceKey } from '../domain/practice-favorites.js'
import { Button, EmptyState, countLabel } from '../components/ui.jsx'

export function recentPractices(history = []) {
  const found = new Set()
  return history.slice().reverse().filter(session => {
    const assignment = session.assignment
    if (!assignment?.drills?.length || found.has(practiceKey(assignment))) return false
    found.add(practiceKey(assignment))
    return true
  }).map(session => session.assignment)
}

// Keep a closing plan mounted for its height transition, then release its videos.
function PracticeCard({ practice, chosen, starred, onSelect, onStart, onAdapt, onShare, onStar, onOpenDrill, onWatchDrill, disabled }) {
  const [retained, setRetained] = useState(chosen)
  const panelId = useId()
  useEffect(() => {
    if (chosen) { setRetained(true); return }
    const timer = window.setTimeout(() => setRetained(false), 260)
    return () => window.clearTimeout(timer)
  }, [chosen])
  return <article className="pb-library-card" data-selected={chosen}>
    <button type="button" className="pb-practice-choice" aria-expanded={chosen} aria-controls={panelId} onClick={onSelect}>
      <span><strong>{practice.title}</strong><small>{countLabel(practice.drills.length, 'drill')}{starred && <><span aria-hidden="true"> · </span><Icon name="star" size={12}/> Starred</>}</small></span>
      <Icon name="down" size={18}/>
    </button>
    <Reveal id={panelId} open={chosen}>
      {(chosen || retained) && <section className="pb-practice-sheet pb-selected-practice" aria-label="Selected whole practice">
        <div className="pb-selected-start">
          <Button icon="forward" disabled={disabled} onClick={() => onStart(practice)}>Start this practice</Button>
          {onStar && <button type="button" className="pb-star-button" aria-label={starred ? 'Unstar practice' : 'Star practice'} aria-pressed={starred} disabled={disabled} onClick={() => onStar(practice)}><Icon name="star" size={21}/></button>}
        </div>
        <PracticeSequence drills={practice.drills} onOpenDrill={onOpenDrill} onWatchDrill={onWatchDrill}/>
        <div className="pb-practice-secondary">
          <Button variant="text" icon="pencil" disabled={disabled} onClick={() => onAdapt(practice)}>Make it fit today</Button>
          {onShare && <Button variant="text" icon="share" onClick={() => onShare(practice)}>Share</Button>}
        </div>
      </section>}
    </Reveal>
  </article>
}

export default function MyPracticesView({ value, onChange, saved = [], history = [], favorites = [], featured, onStart, onAdapt, onNew, onImport, onShare, onStar, onRandom, onOwnDrill, onOpenDrill, onWatchDrill, disabled = false }) {
  const tabs = useRef(null)
  const search = useRef(null)
  const [localView, setLocalView] = useState({ tab: null, selected: null, query: '' })
  const { tab: chosenTab, selected, query } = value || localView
  const update = fields => (onChange || setLocalView)(current => ({ ...current, ...fields }))
  const setSelected = selected => update({ selected })
  const setQuery = query => update({ query, selected: null })
  const recent = useMemo(() => recentPractices(history), [history])
  const tab = chosenTab || (saved.length || !recent.length ? 'saved' : 'recent')
  const starred = saved.filter(item => favorites.includes(practiceKey(item)))
  const collection = tab === 'saved' ? saved : tab === 'starred' ? starred : recent
  const list = collection.filter(item => !query.trim() || `${item.title} ${item.drills.map(drill => drill.title).join(' ')}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const chosen = selected === '' ? null : list.find(item => practiceKey(item) === selected) || list[0]
  const changeTab = tab => update({ tab, selected: null, query: '' })
  return <div className="qt-view pb-library pb-home">
    <header className="pb-view-heading pb-home-heading"><div><h1>My practices</h1></div><span className="pb-home-mark" aria-hidden="true"><Icon name="ball" size={28}/></span></header>
    {featured}
    <section className="pb-home-tools" aria-label="Make practice yours">
      <div className="pb-home-create"><Button variant="secondary" icon="plus" onClick={onNew} disabled={disabled}>New practice</Button>{onImport && <Button variant="secondary" icon="qr" onClick={onImport} disabled={disabled}>Add a practice</Button>}</div>
      <div className="pb-quick-actions"><button type="button" disabled={disabled} onClick={onRandom}><Icon name="shuffle"/><span><strong>Surprise me</strong></span><Icon name="arrow" size={16}/></button><button type="button" disabled={disabled} onClick={onOwnDrill}><Icon name="pencil"/><span><strong>My own drill</strong></span><Icon name="arrow" size={16}/></button></div>
    </section>
    <section className="pb-home-collection" aria-label="Your practice collection">
      <div className="pb-section-heading"><h2>Your playbook</h2><Icon name="bookmark" size={18}/></div>
      <div ref={tabs} className="pb-tabs" role="group" aria-label="Your practices">{[['saved', 'Saved', saved.length], ['starred', 'Starred', starred.length], ['recent', 'Recent', recent.length]].map(([key, label, count]) => <button key={key} type="button" aria-pressed={tab === key} onClick={() => changeTab(key)}>{key === 'starred' && <Icon name="star" size={14}/>} {label}{count > 0 && <span>{count}</span>}</button>)}</div>
      {collection.length > 4 && <label className="qt-practice-search pb-library-search"><Icon name="search" size={18}/><input ref={search} type="search" aria-label="Find a practice" placeholder="Find a practice or drill…" value={query} onChange={event => { setQuery(event.target.value) }}/></label>}
      {list.length ? <div className="pb-practice-choices" aria-label={`${tab === 'saved' ? 'Saved' : tab === 'starred' ? 'Starred' : 'Recent'} practices`}>
        {list.map(practice => <PracticeCard key={practiceKey(practice)} practice={practice} chosen={practice === chosen} starred={favorites.includes(practiceKey(practice))} onSelect={() => setSelected(practice === chosen ? '' : practiceKey(practice))} onStart={onStart} onAdapt={onAdapt} onShare={onShare} onStar={onStar ? practice => { onStar(practice); if (tab === 'starred') requestAnimationFrame(() => tabs.current?.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true })) } : undefined} onOpenDrill={onOpenDrill} onWatchDrill={onWatchDrill} disabled={disabled}/>)}
      </div> : <EmptyState title={query ? 'No matching practice' : tab === 'starred' ? 'Your go-to practices' : tab === 'saved' ? 'Make yourself at home' : 'A practice worth repeating'} icon={tab === 'starred' ? 'star' : 'clipboard'} action={query ? 'Clear search' : undefined} onAction={() => { setQuery(''); search.current?.focus() }}>{query ? 'Try a practice name or a drill inside it.' : tab === 'starred' ? 'Star a practice to keep your favorites together.' : tab === 'saved' ? 'Add a coach’s practice or save one you make. It’ll be here next time.' : 'Your past sessions appear here, ready to go again.'}</EmptyState>}
    </section>
  </div>
}
