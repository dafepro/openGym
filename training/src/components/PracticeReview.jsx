import { useLayoutEffect, useRef, useState } from 'react'
import { changePrescription } from '../domain/practice-builder.js'
import { compactTarget, practiceFocus } from '../domain/drill-selection.js'
import { Button, EmptyState, countLabel } from './ui.jsx'
import Icon from './Icon.jsx'
import Reveal from './Reveal.jsx'

const number = (value) => (value === '' ? '' : Number(value))
export default function PracticeReview({ draft, onChange, onPreview, onNew, disabled, saved }) {
  const focus = practiceFocus(draft.drills)
  const colors = ['var(--qt-lime)', 'var(--qt-mint)', '#a8c6e8', '#84908b']
  const [expanded, setExpanded] = useState(null)
  const list = useRef(null)
  const positions = useRef(null)
  const movedId = useRef(null)
  const removedIndex = useRef(null)
  useLayoutEffect(() => {
    if (removedIndex.current === null) return
    const rows = [...list.current.children]
    const target =
      rows[Math.min(removedIndex.current, rows.length - 1)]?.querySelector('.qt-builder-edit') ||
      list.current.closest('dialog')?.querySelector('[aria-label="Close dialog"]')
    removedIndex.current = null
    target?.focus({ preventScroll: true })
  }, [draft.drills])
  const remove = (drill, index) => {
    removedIndex.current = index
    if (expanded === drill.id) setExpanded(null)
    onChange({ ...draft, drills: draft.drills.filter((item) => item.id !== drill.id) })
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
      <div className="qt-review-caption">
        <span>{countLabel(draft.drills.length, 'drill')} · tap to edit targets</span>
        <Button variant="text" onClick={onNew} disabled={disabled}>
          Clear
        </Button>
      </div>
      {!draft.drills.length && <EmptyState title="Choose a drill first">Close this sheet to keep browsing.</EmptyState>}
      <ol ref={list} className="qt-builder-selected qt-review-list">
        {draft.drills.map((drill, index) => (
          <li key={drill.id} data-drill={drill.id}>
            <div className="qt-builder-selected-heading">
              <span className="qt-drill-number">{index + 1}</span>
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
              <Icon
                name="arrow"
                size={16}
                className={expanded === drill.id ? 'qt-review-chevron is-open' : 'qt-review-chevron'}
              />
              <button
                type="button"
                className="qt-icon-button"
                aria-label={`Remove ${drill.title}`}
                disabled={disabled}
                onClick={() => remove(drill, index)}
              >
                <Icon name="close" size={17} />
              </button>
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
                    <option value="watch">Watch / review</option>
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
                  <Button variant="text" onClick={() => onPreview(drill, index)}>
                    Instructions <Icon name="arrow" size={14} />
                  </Button>
                </div>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
      {focus.length > 0 && (
        <section className="qt-review-focus" aria-label="Selected drill labels">
          <span>Drill focus</span>
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
        </section>
      )}
      <p className="qt-fine-print" role="status">
        {saved ? 'Saved on this device.' : draft.id ? 'Unsaved changes.' : 'Save to use this practice again.'}
      </p>
    </div>
  )
}
