import { useEffect, useMemo, useRef, useState } from 'react'
import { rankTrainingDrills } from '../domain/recommendations.js'
import { SKILL_REGISTRY } from '../domain/metadata.js'
import { Button, EmptyState, countLabel } from '../components/ui.jsx'
import Dialog from '../components/Dialog.jsx'
import Icon from '../components/Icon.jsx'
import { hasDemonstration, orderDrillsByVideo } from '../domain/drill-library.js'
import { isDrillSelected, drillSelectionKey, toggleDrillSelection, drillSetup, drillMatchesSearch } from '../domain/drill-selection.js'

const label = tag => tag.replace(/^futbol:/, '').replaceAll('-', ' ')
const quickSkills = ['futbol:ball-control', 'futbol:passing', 'futbol:agility']
const initialBrowse = { limit: 12, search: '', focus: '', setting: '', strategy: 'balanced', videoOnly: false, videoOrder: 'first' }

// This catalog is deliberately scoped to an open practice editor. It is never
// presented as the whole-practice chooser or a sibling of saved practices.
export default function BuildPracticeView({ draft, onChange, library, history = [], activeSession, browseState, onBrowseChange, onPreview, onSelect, onCustom, disabled = false }) {
  const [localBrowse, setLocalBrowse] = useState(initialBrowse)
  const browse = { ...initialBrowse, ...(browseState || localBrowse) }
  const setBrowse = onBrowseChange || setLocalBrowse
  const { limit, search, focus, setting, strategy, videoOnly, videoOrder } = browse
  const rankingDraft = useRef(draft.drills)
  const field = name => value => {
    if (['focus', 'setting', 'strategy', 'videoOrder'].includes(name)) rankingDraft.current = draft.drills
    setBrowse(current => ({ ...current, [name]: typeof value === 'function' ? value(current[name]) : value }))
  }
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const searchInput = useRef(null)
  const suggestions = useMemo(() => orderDrillsByVideo(rankTrainingDrills(library.map((drill, index) => ({ candidateId: `library-${index}`, drill })), {
    now: Date.now(), history, activeSession, strategy, plannedDrills: rankingDraft.current,
    requiredTags: focus ? [focus] : [], context: setting ? { setting } : {}
  }).filter(({ drill }) => drillMatchesSearch(drill, search)), videoOnly ? 'only' : videoOrder), [videoOrder, videoOnly, library, history, activeSession, strategy, focus, setting, search])
  useEffect(() => field('limit')(12), [search, focus, setting, strategy, videoOrder, videoOnly])
  const reset = () => setBrowse(current => ({ ...current, search: '', focus: '', setting: '', videoOnly: false, strategy: 'balanced', limit: 12 }))
  const choose = drill => {
    if (onSelect) { onSelect(drill); return }
    const selected = isDrillSelected(draft, drill)
    const next = toggleDrillSelection(draft, drill)
    onChange(next)
    setAnnouncement(`${drill.title} ${selected ? 'removed' : 'added'}. ${countLabel(next.drills.length, 'drill')} in your practice.`)
  }
  const filterCount = Number(!!focus) + Number(!!setting) + Number(videoOnly)
  return <div className="qt-view qt-builder qt-selection pb-drill-picker">
    <div className="pb-picker-context"><span>{onSelect ? 'Choose a replacement drill' : `Adding to ${draft.title || 'your practice'}`}</span>{onCustom && <Button variant="text" icon="plus" disabled={disabled} onClick={onCustom}>My own drill</Button>}</div>
    <section className="qt-selection-library" aria-label="Drill library">
      <div className="qt-search-row"><label className="qt-practice-search"><Icon name="search" size={18}/><input type="search" ref={searchInput} aria-label="Search drills" placeholder="Search drills…" value={search} onChange={event => field('search')(event.target.value)}/></label><button type="button" className="qt-filter-button" aria-label={`Filters${filterCount ? `, ${filterCount} active` : ''}`} onClick={() => setFiltersOpen(true)}><Icon name="filter" size={20}/>{filterCount > 0 && <b>{filterCount}</b>}</button></div>
      <div className="qt-quick-filters" aria-label="Quick filters"><button type="button" aria-pressed={!focus && !setting && !videoOnly} onClick={reset}>All drills</button><button type="button" aria-pressed={videoOnly} onClick={() => field('videoOnly')(!videoOnly)}><Icon name="video" size={14}/>With video</button>{quickSkills.map(tag => <button type="button" key={tag} aria-pressed={focus === tag} onClick={() => field('focus')(focus === tag ? '' : tag)}>{label(tag)}</button>)}</div>
      <div className="pb-picker-summary"><span role="status">{countLabel(suggestions.length, 'drill')}</span><label className="qt-inline-sort"><span className="qt-live-status">Sort drills</span><select value={videoOrder} onChange={event => field('videoOrder')(event.target.value)}><option value="first">Video first</option><option value="all">Suggested</option></select></label></div>
      {(setting || (focus && !quickSkills.includes(focus))) && <p className="qt-filter-summary">{[focus && !quickSkills.includes(focus) ? label(focus) : '', setting].filter(Boolean).join(' · ')}</p>}
      <div className="qt-selection-rows">{suggestions.slice(0, limit).map(({ candidateId, drill }, index) => {
        const selectedDrill = draft.drills.find(item => drillSelectionKey(item) === drillSelectionKey(drill))
        const selected = !!selectedDrill, video = hasDemonstration(drill), shown = selectedDrill || drill
        return <article className="qt-selection-row" data-selected={!onSelect && selected} key={candidateId}><button className="qt-selection-preview" type="button" aria-label={`Preview ${drill.title}`} onClick={() => onPreview?.(shown, index)}><span className={`qt-selection-glyph${video ? ' has-video' : ''}`}><Icon name={video ? 'video' : 'ball'} size={20}/></span><span className="qt-selection-copy"><strong>{drill.title}</strong><small>{drillSetup(shown)}</small>{video && <em>Video demonstration</em>}</span></button><button type="button" className="qt-select-drill" disabled={disabled || (!onSelect && !selected && draft.drills.length >= 100)} aria-pressed={onSelect ? undefined : selected} onClick={() => choose(drill)} aria-label={`${onSelect ? 'Choose' : selected ? 'Remove' : 'Add'} ${drill.title}`}><span className="qt-select-plus"><Icon name={onSelect ? 'arrow' : 'plus'} size={20}/></span><span className="qt-select-check"><Icon name="check" size={20}/></span></button></article>
      })}</div>
      {suggestions.length > limit && <Button variant="secondary" className="qt-more-drills" onClick={() => field('limit')(limit + 12)}>Show more · {suggestions.length - limit} remaining</Button>}
      {!suggestions.length && <EmptyState title="No matching drills" action="Clear filters" onAction={() => { reset(); searchInput.current?.focus({ preventScroll: true }) }}>Try a different skill or search.</EmptyState>}
    </section>
    <p className="qt-live-status" role="status">{announcement}</p>
    {filtersOpen && <Dialog className="qt-selection-dialog qt-filter-dialog" title="Find your drills" onClose={() => setFiltersOpen(false)} actions={close => <Button onClick={close}>Show {countLabel(suggestions.length, 'drill')}</Button>}><div className="qt-selection-filter-fields"><label className="qt-field">Skill<select value={focus} onChange={event => field('focus')(event.target.value)}><option value="">All skills</option>{Object.keys(SKILL_REGISTRY).map(tag => <option key={tag} value={tag}>{label(tag)}</option>)}</select></label><label className="qt-field">Setting<select value={setting} onChange={event => field('setting')(event.target.value)}><option value="">Any setting</option><option value="outdoor">Outdoor</option><option value="indoor">Indoor</option></select></label><label className="qt-video-filter"><span><Icon name="video" size={18}/>Only drills with video</span><input type="checkbox" checked={videoOnly} onChange={event => field('videoOnly')(event.target.checked)}/></label><label className="qt-field">Suggested order<select value={strategy} onChange={event => field('strategy')(event.target.value)}><option value="balanced">Balance my skills</option><option value="reinforce">Reinforce recent skills</option><option value="diversify">Try something different</option></select></label><Button variant="text" onClick={reset}>Reset filters</Button></div></Dialog>}
  </div>
}
