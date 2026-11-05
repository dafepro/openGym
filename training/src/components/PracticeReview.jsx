import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { changePrescription } from '../domain/practice-builder.js'
import { compactTarget, practiceFocus } from '../domain/drill-selection.js'
import { Button, EmptyState, countLabel } from './ui.jsx'
import Icon from './Icon.jsx'
import Reveal from './Reveal.jsx'
import Disclosure from './Disclosure.jsx'
import { hasDemonstration } from '../domain/drill-library.js'
import { DrillThumbnail } from './PracticeSequence.jsx'

const number = (value) => (value === '' ? '' : Number(value))
export default function PracticeReview({ draft, onChange, onPreview, onNew, onAdd, onSwap, onWatchDrill, disabled, saved }) {
  const focus = practiceFocus(draft.drills)
  const colors = ['var(--qt-lime)', 'var(--qt-mint)', '#527587', '#988a72']
  const [expanded, setExpanded] = useState(null)
  const [removed, setRemoved] = useState(null)
  const list = useRef(null)
  const positions = useRef(null)
  const movedId = useRef(null)
  const removedIndex = useRef(null)
  const order = draft.drills.map(drill => drill.id).join('|')
  useEffect(() => { if (removed && order !== removed.after) setRemoved(null) }, [order, removed])
  useLayoutEffect(() => {
    if (removedIndex.current === null) return
    const rows = [...list.current.children]
    const target =
      rows[Math.min(removedIndex.current, rows.length - 1)]?.querySelector('.qt-builder-edit') ||
      list.current.closest('.qt-practice-review')?.querySelector('.pb-add-drill')
    removedIndex.current = null
    target?.focus({ preventScroll: true })
  }, [draft.drills])
  const remove = (drill, index) => {
    removedIndex.current = index
    if (expanded === drill.id) setExpanded(null)
    const drills = draft.drills.filter((item) => item.id !== drill.id)
    positions.current = new Map([...list.current.children].map(row => [row.dataset.drill, row.getBoundingClientRect().top]))
    setRemoved({ drill: structuredClone(drill), index, after: drills.map(item => item.id).join('|') })
    onChange({ ...draft, drills })
  }
  const undoRemove = () => {
    if (!removed || disabled) return
    const drills = draft.drills.slice()
    drills.splice(Math.min(removed.index, drills.length), 0, removed.drill)
    positions.current = new Map([...list.current.children].map(row => [row.dataset.drill, row.getBoundingClientRect().top]))
    movedId.current = removed.drill.id
    setRemoved(null)
    onChange({ ...draft, drills })
  }
  useLayoutEffect(() => {
    if (!positions.current) return
    const previous = positions.current
    positions.current = null
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const rows = [...list.current.children]
    rows
      .find((row) => row.dataset.drill === movedId.current)
      ?.querySelector('.qt-builder-edit')
      ?.focus({ preventScroll: true })
    movedId.current = null
    if (reducedMotion) return
    rows.forEach((row) => {
      const delta =
        (previous.get(row.dataset.drill) ?? row.getBoundingClientRect().top) - row.getBoundingClientRect().top
      row.style.transition = 'none'
      row.style.transform = `translateY(${delta}px)`
    })
    list.current.getBoundingClientRect()
    const frame = requestAnimationFrame(() =>
      rows.forEach((row) => {
        row.style.transition = 'transform 260ms cubic-bezier(.22,1,.36,1)'
        row.style.transform = ''
      })
    )
    const timer = setTimeout(
      () =>
        rows.forEach((row) => {
          row.style.transition = ''
          row.style.transform = ''
        }),
      300
    )
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
      rows.forEach((row) => {
        row.style.transition = ''
        row.style.transform = ''
      })
    }
  }, [draft.drills])
  const update = (id, fields) =>
    onChange({
      ...draft,
      drills: draft.drills.map((drill) => (drill.id === id ? changePrescription(drill, fields) : drill))
    })
  const move = (index, direction) => {
    const drills = draft.drills.slice(),
      target = index + direction
    if (target < 0 || target >= drills.length) return
    movedId.current = drills[index].id
    positions.current = new Map(
      [...list.current.children].map((row) => [row.dataset.drill, row.getBoundingClientRect().top])
    )
    ;[drills[index], drills[target]] = [drills[target], drills[index]]
    onChange({ ...draft, drills })
  }
  return (
    <div className="qt-practice-review">
      <label className="qt-field">
        Practice name
        <input
          maxLength={240}
          value={draft.title}
          placeholder="My soccer practice"
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
          disabled={disabled}
        />
      </label>
      <label className="qt-field pb-parent-note-field">
        Note for the player <span className="pb-optional">optional</span>
        <input maxLength={500} value={draft.note || ''} placeholder="A focus or reminder for this practice" onChange={event => onChange({ ...draft, note: event.target.value })} disabled={disabled}/>
      </label>
      <div className="qt-review-caption">
        <span>{countLabel(draft.drills.length, 'drill')} · tap to edit targets</span>
        <Button variant="text" onClick={onNew} disabled={disabled}>
          Clear
        </Button>
      </div>
      {!draft.drills.length && <EmptyState title="Start with one drill">Add a drill, then arrange your practice here.</EmptyState>}
      <ol ref={list} className="qt-builder-selected qt-review-list">
        {draft.drills.map((drill, index) => (
          <li key={drill.id} data-drill={drill.id}>
            <div className="qt-builder-selected-heading">
              <span className="qt-drill-number">{String(index + 1).padStart(2, '0')}</span>
              <button
                type="button"
                className="qt-builder-edit"
                aria-label={`Edit ${drill.title}`}
                aria-expanded={expanded === drill.id}
                aria-controls={`edit-${drill.id}`}
                onClick={() => setExpanded(expanded === drill.id ? null : drill.id)}
              >
                <strong>{drill.title}</strong>
                <small>{compactTarget(drill)}</small>
              </button>
              <DrillThumbnail drill={drill} onClick={() => (hasDemonstration(drill) ? onWatchDrill || onPreview : onPreview)?.(drill, index)} disabled={disabled}/>
            </div>
            <Reveal open={expanded === drill.id} id={`edit-${drill.id}`}>
              <div className="qt-builder-prescription">
                <label className="qt-field">
                  Track this drill
                  <select
                    value={drill.mode}
                    disabled={disabled}
                    onChange={(event) =>
                      update(drill.id, {
                        mode: event.target.value,
                        ...(event.target.value === 'reps'
                          ? { reps: drill.reps || 10 }
                          : event.target.value === 'time'
                          ? { durationSec: drill.durationSec || 45 }
                          : {})
                      })
                    }
                  >
                    <option value="practice">Self-paced</option>
                    <option value="reps">Count repetitions</option>
                    <option value="time">Timed sets</option>
                    {drill.mode === 'watch' && <option value="watch">Watch / review</option>}
                  </select>
                </label>
                {['reps', 'time'].includes(drill.mode) && (
                  <>
                    <div className="qt-field-grid">
                      <label className="qt-field">
                        Sets
                        <input
                          type="number"
                          min="1"
                          max="100"
                          step="1"
                          value={drill.sets}
                          disabled={disabled}
                          onChange={(event) => update(drill.id, { sets: number(event.target.value) })}
                        />
                      </label>
                      <label className="qt-field">
                        {drill.mode === 'reps' ? 'Reps per set' : 'Seconds per set'}
                        <input
                          type="number"
                          min="1"
                          max={drill.mode === 'reps' ? 10000 : 86400}
                          step="1"
                          value={drill.mode === 'reps' ? drill.reps : drill.durationSec}
                          disabled={disabled}
                          onChange={(event) =>
                            update(drill.id, {
                              [drill.mode === 'reps' ? 'reps' : 'durationSec']: number(event.target.value)
                            })
                          }
                        />
                      </label>
                    </div>
                    <div className="qt-target-presets" aria-label="Quick targets">
                      {(drill.mode === 'time' ? [30, 45, 60] : [5, 10, 20]).map((value) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={(drill.mode === 'time' ? drill.durationSec : drill.reps) === value}
                          disabled={disabled}
                          onClick={() => update(drill.id, { [drill.mode === 'time' ? 'durationSec' : 'reps']: value })}
                        >
                          {value} {drill.mode === 'time' ? 'sec' : 'reps'}
                        </button>
                      ))}
                    </div>
                    <div className="qt-field-grid">
                      <label className="qt-field">
                        Feet
                        <select
                          value={drill.side}
                          disabled={disabled}
                          onChange={(event) => update(drill.id, { side: event.target.value })}
                        >
                          <option value="both">Either foot</option>
                          <option value="each">Each foot</option>
                        </select>
                      </label>
                      <label className="qt-field">
                        Rest (seconds)
                        <input
                          type="number"
                          min="0"
                          max="3600"
                          step="1"
                          placeholder="As needed"
                          value={drill.restSec ?? ''}
                          disabled={disabled}
                          onChange={(event) =>
                            update(drill.id, { restSec: event.target.value === '' ? null : Number(event.target.value) })
                          }
                        />
                      </label>
                    </div>
                  </>
                )}
                <div className="qt-review-row-tools">
                  <button
                    type="button"
                    aria-label={`Move ${drill.title} up`}
                    disabled={disabled || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <Icon name="up" size={18} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${drill.title} down`}
                    disabled={disabled || index === draft.drills.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <Icon name="down" size={18} />
                  </button>
                  {onSwap && <Button variant="text" disabled={disabled} onClick={() => onSwap(drill)}>Swap</Button>}
                  <Button variant="text" disabled={disabled} onClick={() => remove(drill, index)} aria-label={`Remove ${drill.title}`}>Remove</Button>
                  <Button variant="text" onClick={() => onPreview(drill, index)}>
                    Instructions <Icon name="arrow" size={14} />
                  </Button>
                </div>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
      {removed && <div className="pb-removal-notice" role="status"><span>{removed.drill.title} removed.</span><Button variant="text" onClick={undoRemove} disabled={disabled}>Undo</Button></div>}
      {onAdd && <Button variant="secondary" className="pb-add-drill" icon="plus" onClick={onAdd} disabled={disabled || draft.drills.length >= 100}>Add drill</Button>}
      {focus.length > 0 && (
        <Disclosure className="qt-review-focus pb-focus-details" summary="Drill focus">
          <div className="qt-review-focus-bar" aria-hidden="true">
            {focus.slice(0, 3).map((item, index) => (
              <i key={item.tag} style={{ flex: item.count, background: colors[index] }} />
            ))}
            {focus.length > 3 && (
              <i style={{ flex: focus.slice(3).reduce((sum, item) => sum + item.count, 0), background: colors[3] }} />
            )}
          </div>
          <ul>
            {focus.slice(0, 3).map((item, index) => (
              <li key={item.tag}>
                <i style={{ background: colors[index] }} />
                {item.label} <b>{item.count}</b>
              </li>
            ))}
            {focus.length > 3 && <li>+{focus.length - 3} labels</li>}
          </ul>
        </Disclosure>
      )}
      <p className="qt-fine-print" role="status">
        {saved ? 'Saved on this device.' : draft.id ? 'Unsaved changes.' : 'Save to use this practice again.'}
      </p>
    </div>
  )
}
