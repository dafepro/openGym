import { useEffect, useMemo, useRef, useState } from 'react'
import { rankTrainingDrills } from '../domain/recommendations.js'
import { normalizeTrainingTags, SKILL_REGISTRY } from '../domain/metadata.js'
import { Button, EmptyState, countLabel } from '../components/ui.jsx'
import Dialog from '../components/Dialog.jsx'
import Icon from '../components/Icon.jsx'
import { hasDemonstration, orderDrillsByVideo } from '../domain/drill-library.js'
import {
  isDrillSelected,
  drillSelectionKey,
  toggleDrillSelection,
  drillSetup,
  practiceSummary,
  drillMatchesSearch
} from '../domain/drill-selection.js'

const label = (tag) => tag.replace(/^futbol:/, '').replaceAll('-', ' ')
const quickSkills = ['futbol:ball-control', 'futbol:passing', 'futbol:agility']
export default function BuildPracticeView({
  draft,
  onChange,
  library,
  saved,
  history,
  activeSession,
  browseState,
  onBrowseChange,
  onLoad,
  onPreview,
  assignment,
  onOpenAssignment,
  disabled = false
}) {
  const [localBrowse, setLocalBrowse] = useState({
    section: 'drills',
    limit: 12,
    search: '',
    focus: '',
    setting: '',
    strategy: 'balanced',
    videoOnly: false,
    videoOrder: 'first'
  })
  const browse = browseState || localBrowse
  const setBrowse = onBrowseChange || setLocalBrowse
  const { section, limit, search, focus, setting, strategy, videoOnly, videoOrder } = browse
  const field = (name) => (value) => {
    if (['focus', 'setting', 'strategy', 'videoOrder'].includes(name)) rankingDraft.current = draft.drills
    setBrowse((current) => ({ ...current, [name]: typeof value === 'function' ? value(current[name]) : value }))
  }
  const setSection = field('section'),
    setLimit = field('limit'),
    setSearch = field('search'),
    setFocus = field('focus'),
    setSetting = field('setting'),
    setStrategy = field('strategy'),
    setVideoOnly = field('videoOnly'),
    setVideoOrder = field('videoOrder')
  const searchInput = useRef(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [custom, setCustom] = useState(null)
  const [customError, setCustomError] = useState('')
  const [announcement, setAnnouncement] = useState('')
  // Refresh coverage on an explicit filter/order change; selection alone must not move a row under a finger.
  const rankingDraft = useRef(draft.drills)
  const suggestions = useMemo(
    () =>
      orderDrillsByVideo(
        rankTrainingDrills(
          library.map((drill, index) => ({ candidateId: `library-${index}`, drill })),
          {
            now: Date.now(),
            history,
            activeSession,
            strategy,
            plannedDrills: rankingDraft.current,
            requiredTags: focus ? [focus] : [],
            context: setting ? { setting } : {}
          }
        ).filter(({ drill }) => drillMatchesSearch(drill, search)),
        videoOnly ? 'only' : videoOrder
      ),
    [videoOrder, videoOnly, library, history, activeSession, strategy, focus, setting, search]
  )
  useEffect(() => setLimit(12), [search, focus, setting, strategy, videoOrder, videoOnly])
  const resetFilters = () => {
    setSearch('')
    setFocus('')
    setSetting('')
    setVideoOnly(false)
    setStrategy('balanced')
  }
  const toggle = (drill) => {
    const selected = isDrillSelected(draft, drill)
    const next = toggleDrillSelection(draft, drill)
    onChange(next)
    setAnnouncement(
      `${drill.title} ${selected ? 'removed' : 'added'}. ${countLabel(next.drills.length, 'drill')} selected.`
    )
  }
  const createCustom = () => {
    try {
      if (!custom.title.trim() || !custom.instructions.trim()) throw new Error('Add a drill name and instructions.')
      const tags = normalizeTrainingTags(
        [
          custom.skill,
          ...custom.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean)
        ].filter(Boolean)
      )
      toggle({
        title: custom.title.trim(),
        instructions: custom.instructions.trim(),
        mode: 'practice',
        sets: 1,
        side: 'both',
        restSec: null,
        media: { id: `custom-${crypto.randomUUID()}`, status: 'unavailable' },
        metadata: { version: 1, registryVersion: 1, tags }
      })
      setCustom(null)
      setCustomError('')
    } catch (error) {
      setCustomError(error.message)
    }
  }
  const filterCount = Number(!!focus) + Number(!!setting) + Number(videoOnly)
  return (
    <div className={`qt-view qt-builder qt-selection${draft.drills.length ? ' has-selection' : ''}`}>
      <header className="qt-practice-library-heading">
        <h1 id="practice-builder-heading" tabIndex="-1">
          Practice
        </h1>
        <Button
          variant="text"
          icon="plus"
          disabled={disabled || draft.drills.length >= 100}
          onClick={() => {
            setCustom({ title: '', instructions: '', skill: '', tags: '' })
            setCustomError('')
          }}
        >
          Custom drill
        </Button>
      </header>
      {assignment && (
        <button type="button" className="qt-assigned-compact" onClick={onOpenAssignment}>
          <span className="qt-selection-glyph">
            <Icon name="ball" />
          </span>
          <span>
            <small>Assigned</small>
            <strong>{assignment.title}</strong>
            <em>{countLabel(assignment.drills.length, 'drill')} · with video</em>
          </span>
          <Icon name="arrow" size={18} />
        </button>
      )}
      <div className="qt-library-tabs" role="group" aria-label="Practice library">
        <i style={{ '--selection-tab': section === 'drills' ? 0 : 1 }} />
        <button
          type="button"
          aria-label="Drills"
          aria-pressed={section === 'drills'}
          onClick={() => setSection('drills')}
        >
          Drills <span aria-hidden="true">{suggestions.length}</span>
        </button>
        <button type="button" aria-pressed={section === 'saved'} onClick={() => setSection('saved')}>
          Saved{saved.length > 0 && <span>{saved.length}</span>}
        </button>
        {section === 'drills' && (
          <label className="qt-inline-sort">
            <span className="qt-live-status">Sort drills</span>
            <select value={videoOrder} onChange={(event) => setVideoOrder(event.target.value)}>
              <option value="first">Video first</option>
              <option value="all">Suggested</option>
            </select>
          </label>
        )}
      </div>
      {section === 'drills' ? (
        <section className="qt-selection-library" aria-label="Drill library">
          <div className="qt-search-row">
            <label className="qt-practice-search">
              <Icon name="search" size={18} />
              <input
                type="search"
                ref={searchInput}
                aria-label="Search drills"
                placeholder="Search drills…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="qt-filter-button"
              aria-label={`Filters${filterCount ? `, ${filterCount} active` : ''}`}
              onClick={() => setFiltersOpen(true)}
            >
              <Icon name="filter" size={20} />
              {filterCount > 0 && <b>{filterCount}</b>}
            </button>
          </div>
          <div className="qt-quick-filters" aria-label="Quick filters">
            <button type="button" aria-pressed={!focus && !setting && !videoOnly} onClick={resetFilters}>
              All drills
            </button>
            <button type="button" aria-pressed={videoOnly} onClick={() => setVideoOnly((value) => !value)}>
              <Icon name="video" size={14} />
              With video
            </button>
            {quickSkills.map((tag) => (
              <button
                type="button"
                key={tag}
                aria-pressed={focus === tag}
                onClick={() => setFocus(focus === tag ? '' : tag)}
              >
                {label(tag)}
              </button>
            ))}
          </div>
          <span className="qt-live-status" role="status">
            {countLabel(suggestions.length, 'drill')} found
          </span>
          {(setting || (focus && !quickSkills.includes(focus))) && (
            <p className="qt-filter-summary">
              {[focus && !quickSkills.includes(focus) ? label(focus) : '', setting].filter(Boolean).join(' · ')}
            </p>
          )}
          <div className="qt-selection-rows">
            {suggestions.slice(0, limit).map(({ candidateId, drill }, index) => {
              const selectedDrill = draft.drills.find((item) => drillSelectionKey(item) === drillSelectionKey(drill))
              const selected = !!selectedDrill,
                video = hasDemonstration(drill)
              const shownDrill = selectedDrill || drill
              return (
                <article className="qt-selection-row" data-selected={selected} key={candidateId}>
                  <button
                    className="qt-selection-preview"
                    type="button"
                    aria-label={`Preview ${drill.title}`}
                    onClick={() => onPreview(shownDrill, index)}
                  >
                    <span className={`qt-selection-glyph${video ? ' has-video' : ''}`}>
                      <Icon name={video ? 'video' : 'ball'} size={20} />
                    </span>
                    <span className="qt-selection-copy">
                      <strong>{drill.title}</strong>
                      <small>{drillSetup(shownDrill)}</small>
                      {video && <em>Video demonstration</em>}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="qt-select-drill"
                    disabled={disabled || (!selected && draft.drills.length >= 100)}
                    aria-pressed={selected}
                    onClick={() => toggle(drill)}
                    aria-label={`${selected ? 'Remove' : 'Add'} ${drill.title}`}
                  >
                    <span className="qt-select-plus">
                      <Icon name="plus" size={20} />
                    </span>
                    <span className="qt-select-check">
                      <Icon name="check" size={20} />
                    </span>
                  </button>
                </article>
              )
            })}
          </div>
          {suggestions.length > limit && (
            <Button variant="secondary" className="qt-more-drills" onClick={() => setLimit((value) => value + 12)}>
              Show more · {suggestions.length - limit} remaining
            </Button>
          )}
          {!suggestions.length && (
            <EmptyState
              title="No matching drills"
              action="Clear filters"
              onAction={() => {
                resetFilters()
                searchInput.current?.focus({ preventScroll: true })
              }}
            >
              Try a different skill or search.
            </EmptyState>
          )}
        </section>
      ) : (
        <section className="qt-selection-saved" aria-label="Saved practices">
          {saved.length ? (
            saved.map((practice) => (
              <button
                type="button"
                key={practice.id}
                className="qt-assigned-compact"
                disabled={disabled}
                onClick={() => onLoad(practice)}
              >
                <span className="qt-selection-glyph">
                  <Icon name="ball" />
                </span>
                <span>
                  <strong>{practice.title}</strong>
                  <em>
                    {countLabel(practice.drills.length, 'drill')} · {practiceSummary(practice.drills).videoCount} with
                    video
                  </em>
                </span>
                <Icon name="arrow" size={18} />
              </button>
            ))
          ) : (
            <EmptyState title="Your practices live here" action="Choose drills" onAction={() => setSection('drills')}>
              Select drills, then save your practice.
            </EmptyState>
          )}
        </section>
      )}
      <p className="qt-live-status" role="status">
        {announcement}
      </p>

      {filtersOpen && (
        <Dialog
          className="qt-selection-dialog qt-filter-dialog"
          title="Find your drills"
          onClose={() => setFiltersOpen(false)}
          actions={(close) => <Button onClick={close}>Show {countLabel(suggestions.length, 'drill')}</Button>}
        >
          <div className="qt-selection-filter-fields">
            <label className="qt-field">
              Skill
              <select value={focus} onChange={(event) => setFocus(event.target.value)}>
                <option value="">All skills</option>
                {Object.keys(SKILL_REGISTRY).map((tag) => (
                  <option key={tag} value={tag}>
                    {label(tag)}
                  </option>
                ))}
              </select>
            </label>
            <label className="qt-field">
              Setting
              <select value={setting} onChange={(event) => setSetting(event.target.value)}>
                <option value="">Any setting</option>
                <option value="outdoor">Outdoor</option>
                <option value="indoor">Indoor</option>
              </select>
            </label>
            <label className="qt-video-filter">
              <span>
                <Icon name="video" size={18} />
                Only drills with video
              </span>
              <input type="checkbox" checked={videoOnly} onChange={(event) => setVideoOnly(event.target.checked)} />
            </label>
            <label className="qt-field">
              Suggested order
              <select value={strategy} onChange={(event) => setStrategy(event.target.value)}>
                <option value="balanced">Balance my skills</option>
                <option value="reinforce">Reinforce recent skills</option>
                <option value="diversify">Try something different</option>
              </select>
            </label>
            <Button variant="text" onClick={resetFilters}>
              Reset filters
            </Button>
          </div>
        </Dialog>
      )}
      {custom && (
        <Dialog
          className="qt-selection-dialog"
          title="Your own drill"
          onClose={() => setCustom(null)}
          actions={
            <Button disabled={disabled} onClick={createCustom}>
              Add to practice
            </Button>
          }
        >
          <div className="qt-custom-form">
            <label className="qt-field">
              Drill name
              <input
                maxLength={240}
                value={custom.title}
                onChange={(event) => setCustom({ ...custom, title: event.target.value })}
              />
            </label>
            <label className="qt-field">
              Setup &amp; instructions
              <textarea
                maxLength={2000}
                rows={4}
                value={custom.instructions}
                onChange={(event) => setCustom({ ...custom, instructions: event.target.value })}
              />
            </label>
            <label className="qt-field">
              Skill (optional)
              <select value={custom.skill} onChange={(event) => setCustom({ ...custom, skill: event.target.value })}>
                <option value="">No skill label</option>
                {Object.keys(SKILL_REGISTRY).map((tag) => (
                  <option key={tag} value={tag}>
                    {label(tag)}
                  </option>
                ))}
              </select>
            </label>
            <label className="qt-field">
              Extra tags (optional)
              <input
                placeholder="wall, weak foot, backyard"
                value={custom.tags}
                onChange={(event) => setCustom({ ...custom, tags: event.target.value })}
              />
            </label>
            <p className="qt-fine-print">Add sets or a timer when you review your practice.</p>
            {customError && <p role="alert">{customError}</p>}
          </div>
        </Dialog>
      )}
    </div>
  )
}
