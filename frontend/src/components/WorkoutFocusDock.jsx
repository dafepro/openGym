import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { exOr } from '../lib/exercises.js'
import { exerciseNameFor, instrFor, instrTranslated, getLang, useLang, t, tn } from '../lib/i18n.js'
import { fmtNum, fmtPlate } from '../lib/format.js'
import { EFFORT, capEffort, effortOf, stepEffort, modeOf, pinnedNoteFor, setsRepsOf } from '../lib/history.js'
import { isSideSet, isWarmupRow, isFailureSet, toggleFailure, dropsOf, clustersOf, setSideField, setDropAt, setSideDropAt, setClusterAt, setSideClusterAt } from '../lib/workout-model.js'
import { restSecFor } from '../lib/supersetFlow.js'
import { baseWeightFor, inventoryFor, loadKindFor, rowLoad } from '../lib/plates.js'
import { weightIncrement, stepWeight } from '../lib/progression.js'
import { ownedWeightsFor, stepOwned } from '../lib/dumbbells.js'
import { speedUnitOf, toSpeed, fromSpeed } from '../lib/speed.js'
import { clampIncline, hasIncline, inclineFits, INCLINE_MAX, INCLINE_STEP } from '../lib/incline.js'
import { REST_MAX, fmtRest } from '../lib/duration.js'
import { NumberField, Stepper } from './ui.jsx'
import Icon from './Icon.jsx'
import Media from './Media.jsx'
import './WorkoutFocusDock.css'

const clock = sec => {
  const n = Math.abs(Math.round(sec))
  return (sec < 0 ? '+' : '') + Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0')
}

function Ring({ timer }) {
  if (!timer) return null
  const fraction = Math.max(0, Math.min(1, timer.left / timer.total))
  return <svg className="wf-ring" viewBox="0 0 58 58" aria-hidden="true">
    <circle cx="29" cy="29" r="26" />
    <circle cx="29" cy="29" r="26" pathLength="100" strokeDasharray="100" strokeDashoffset={100 * (1 - fraction)} />
  </svg>
}

// A route away from the workout has a way back without mounting a second workout controller.
// Timers continue in useUI; returning mounts the same saved session and opens its controls.
export function WorkoutFocusLauncher({ onOpen }) {
  const active = useStore(s => s.S.active)
  const timer = useUI(s => s.work || s.timer)
  if (!active || active.backfill || active.editingWorkoutId || !active.entries.length) return null
  const entry = active.entries[active.cur] || active.entries[0]
  return <div className="wf-dock is-away" data-phase={timer ? 'rest' : 'set'}>
    <div className="wf-rail">
      <button type="button" className="wf-summary" onClick={onOpen}>
        <strong>{exerciseNameFor(exOr(entry.id))}</strong>
        <span>{timer ? clock(timer.left) : active.name}<Icon name="chevronRight" /></span>
      </button>
      <button type="button" className="wf-toggle" aria-label={t('Focus')} title={t('Focus')} onClick={onOpen}>
        <Ring timer={timer} /><Icon name="target" />
      </button>
    </div>
  </div>
}

export default function WorkoutFocusDock({
  entryIdx, unit, onSelectEntry, onAdvanceUnit, onToggle, onToggleSide,
  onField, onSideField, onMutateSet, onStartTimed, onFinish,
}) {
  const S = useStore(s => s.S)
  useLang()
  const { focusOverlayOpen: open, focusOverlayPrepared: prepared, timer, work, sheets } = useUI()
  const A = S.active
  const entry = A?.entries[entryIdx]
  const [pane, setPane] = useState(null)
  const dockRef = useRef(null)
  const toggleRef = useRef(null)
  const lastRecord = useRef(-Infinity)
  const id = useId()
  const setOpen = value => useUI.setState({ focusOverlayOpen: value })
  const sessionKey = A?.id ?? A?.start
  const prepKey = entryIdx + ':' + entry?.id

  useEffect(() => {
    document.body.classList.add('focus-docked')
    return () => {
      document.body.classList.remove('focus-docked', 'focus-panel-open')
    }
  }, [])
  useEffect(() => { setPane(null) }, [sessionKey, prepKey])
  useEffect(() => { lastRecord.current = -Infinity }, [sessionKey])
  useEffect(() => {
    document.body.classList.toggle('focus-panel-open', !!open)
    const page = document.getElementById('app')
    const wasInert = page?.inert
    if (page && open) page.inert = true
    if (open) dockRef.current?.querySelector('.wf-primary')?.focus({ preventScroll: true })
    return () => {
      document.body.classList.remove('focus-panel-open')
      if (page) page.inert = wasInert
    }
  }, [open])
  useEffect(() => {
    if (!open) return
    const keydown = event => {
      if (useUI.getState().sheets.length) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        if (pane) setPane(null)
        else setOpen(false)
        toggleRef.current?.focus({ preventScroll: true })
      }
      if (event.key !== 'Tab') return
      const buttons = [...dockRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled)')]
        .filter(el => !el.closest('[inert]') && !el.closest('[aria-hidden="true"]'))
      const first = buttons[0], last = buttons.at(-1)
      if (event.shiftKey && (document.activeElement === first || !dockRef.current.contains(document.activeElement))) {
        event.preventDefault(); last?.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !dockRef.current.contains(document.activeElement))) {
        event.preventDefault(); first?.focus()
      }
    }
    document.addEventListener('keydown', keydown, true)
    return () => document.removeEventListener('keydown', keydown, true)
  }, [open, pane])

  if (!entry) return null
  const setIdx = entry.sets.findIndex(row => !row.done)
  const row = entry.sets[setIdx]
  const side = isSideSet(row) ? (!row.sides.L.done ? 'L' : 'R') : null
  const set = side ? row.sides[side] : row
  const ex = exOr(entry.id)
  const mode = modeOf({ ...(entry.target || {}), id: entry.id })
  const allDone = A.entries.every(e => e.sets.every(s => s.done))
  const completedRows = A.entries.reduce((n, e) => n + e.sets.filter(s => s.done).length, 0)
  const totalRows = A.entries.reduce((n, e) => n + e.sets.length, 0)
  const isPrepared = prepared?.sessionId === sessionKey && prepared.entries.includes(prepKey)
  const phase = work ? 'working' : timer ? 'rest' : !row ? 'complete' : !isPrepared ? 'prep' : 'set'
  const ready = () => useUI.setState(current => ({ focusOverlayPrepared: {
    sessionId: sessionKey,
    entries: [...new Set([...(current.focusOverlayPrepared?.sessionId === sessionKey ? current.focusOverlayPrepared.entries : []), prepKey])],
  } }))
  const disclose = next => setPane(current => current === next ? null : next)
  const progress = ({ unitDone }) => { if (unitDone) onAdvanceUnit() }
  // Read the live session, not a captured row. A second/stale press must never uncheck a set
  // or complete the following one, including a superset partner that just became current.
  const actionable = () => {
    if (setIdx < 0) return false
    const fresh = useStore.getState().S.active
    const current = fresh?.entries[entryIdx]
    const freshCur = Number.isInteger(fresh?.cur) ? Math.min(Math.max(fresh.cur, 0), Math.max(0, fresh.entries.length - 1)) : 0
    return fresh?.id === A.id && freshCur === entryIdx && current?.id === entry.id &&
      current.sets.findIndex(s => !s.done) === setIdx && !current.sets[setIdx]?.done &&
      (!side || !current.sets[setIdx]?.sides?.[side]?.done) && !useUI.getState().work && !useUI.getState().timer
  }
  const field = (name, value) => {
    if (!actionable()) return
    if (side) {
      if (onSideField) onSideField(setIdx, side, name, value)
      else onMutateSet(setIdx, current => setSideField(current, side, name, value))
    } else onField(setIdx, name, value)
  }
  const mutate = fn => { if (actionable()) onMutateSet(setIdx, fn) }
  const record = () => {
    if (!actionable() || Date.now() - lastRecord.current < 600) return
    lastRecord.current = Date.now()
    if (side) onToggleSide(setIdx, side, progress)
    else onToggle(setIdx, progress)
  }
  const start = () => {
    if (!actionable()) return
    lastRecord.current = Date.now()
    ready()
    if (mode === 'time') onStartTimed(setIdx, progress)
  }
  const leaveRest = () => {
    lastRecord.current = Date.now()
    useUI.getState().stopRest()
  }
  const finishTimed = () => {
    const current = useUI.getState().work
    if (!current || Date.now() - (current.endsAt - current.total * 1000) < 600) return
    lastRecord.current = Date.now()
    useUI.getState().finishWorkEarly()
  }
  const loadStep = weightIncrement({ ...(entry.target || {}), id: entry.id }, S.unit)
  const owned = mode === 'reps' ? ownedWeightsFor(S, { ...(entry.target || {}), id: entry.id }) : null
  const stepLoad = owned ? (value, _step, dir) => stepOwned(owned, value, dir) : stepWeight
  const load = set && mode === 'reps' ? rowLoad(loadKindFor(S, { ...(entry.target || {}), id: entry.id }), set.w, baseWeightFor(S, entry.id), inventoryFor(S)) : null
  const drops = dropsOf(set)
  const bursts = clustersOf(set)
  const effort = effortOf(S)
  const effortField = EFFORT[effort]?.f
  const notes = [...new Set([S.exNotes?.[entry.id], entry.target?.note, entry.note, pinnedNoteFor(S, entry.id)?.note].filter(Boolean))]
  const instructions = pane === 'info' ? instrFor(ex) : []
  const restSec = restSecFor(A.entries, unit, S.restSec)
  const readonly = !!timer || !!work || !row
  const weightField = <Stepper label={t('Load ({0})', S.unit)} ariaLabel="load" value={set?.w ?? 0} step={loadStep} onStep={stepLoad} disabled={readonly} onChange={value => field('w', value)} />
  const timedFields = mode === 'time' && <Stepper label={t('Time')} ariaLabel="duration" value={set?.planSec ?? set?.sec ?? entry.target?.sec ?? 45} decimal={false} min={1} step={5} disabled={readonly} onChange={value => field('sec', Math.max(1, value))} />
  const speedUnit = speedUnitOf(S)
  const cardioFields = <>
    <Stepper label={t('Duration (min)')} ariaLabel="duration" value={set?.min ?? 0} decimal={false} disabled={readonly} onChange={value => field('min', value)} />
    <Stepper label={speedUnit === 'mph' ? t('Speed (mph)') : t('Speed (km/h)')} ariaLabel="speed" value={toSpeed(set?.speed ?? 0, speedUnit)} step={0.5} disabled={readonly} onChange={value => field('speed', fromSpeed(value, speedUnit))} />
    {(inclineFits(ex) || entry.sets.some(hasIncline)) && <Stepper label={t('Incline (%)')} ariaLabel="incline" value={set?.incline ?? 0} step={INCLINE_STEP} max={INCLINE_MAX} disabled={readonly} onChange={value => field('incline', clampIncline(value))} />}
  </>
  const plateInfo = load && <div className="wf-info-card">
    <strong>{t('Plate loading')}</strong>
    <p>{load.barOnly ? t('Bar only') : load.kind === 'pairs' ? t('{0} per side', load.plates.map(fmtPlate).join(' + ') || '–') : t('Load {0}', load.plates.map(fmtPlate).join(' + ') || '–')}</p>
    {load.missing > 0 && <p className="wf-errors">{t('{0} short', fmtPlate(load.missing) + ' ' + S.unit)}</p>}
  </div>
  const summary = work ? clock(work.left) : timer ? (timer.ready ? t('Ready') : clock(timer.left)) : row ? t('Set {0}', setIdx + 1) + ' / ' + entry.sets.length : t('Completed')
  const kicker = pane === 'info' ? t('Details') : pane === 'stations' ? t('Exercises') : pane === 'load' ? t('Load') : pane === 'more' ? t('More') : pane === 'finish' ? t('Finish workout') :
    phase === 'rest' ? timer.kind === 'switch' ? t('Switch sides') : timer.paused ? t('Paused') : t('Rest') : phase === 'working' ? t('Time') : summary + (side || row?.side ? ' · ' + t((side || row.side) === 'L' ? 'Left' : 'Right') : '') + (isWarmupRow(row) ? ' · ' + t('Warm-up') : '')
  const primary = pane === 'finish' ? { label: t('Finish'), icon: 'flag', run: onFinish } : pane ? { label: t('Back'), icon: 'arrowLeft', run: () => setPane(null) } :
    phase === 'rest' ? { label: timer.ready ? t('Next') : t('Skip'), icon: 'skipForward', run: leaveRest } :
    phase === 'working' ? { label: t('Done'), icon: 'check', run: finishTimed } :
    phase === 'complete' ? { label: allDone ? t('Finish') : t('Next'), icon: allDone ? 'flag' : 'arrowRight', run: allDone ? onFinish : onAdvanceUnit } :
    phase === 'prep' || mode === 'time' ? { label: t('Start'), icon: 'play', run: start } : { label: t('Done'), icon: 'check', run: record }

  return createPortal(<>
    <div className={'wf-scrim' + (open ? ' is-open' : '')} aria-hidden="true" onClick={() => { setPane(null); setOpen(false); toggleRef.current?.focus() }} />
    <div ref={dockRef} className={'wf-dock' + (open ? ' is-open' : '')} data-phase={phase} role={open ? 'dialog' : undefined} aria-modal={open && !sheets.length ? 'true' : undefined} aria-label={t('Focus')}>
      <section id={id + '-panel'} className="wf-panel" aria-hidden={!open} inert={!open}>
        <header className="wf-header"><span className="wf-kicker">{kicker}</span><h2>{pane === 'stations' || pane === 'finish' ? A.name : work?.label || exerciseNameFor(ex)}</h2></header>
        <div className="wf-content">
          <div className="wf-phase" key={pane || phase + ':' + entryIdx + ':' + setIdx + ':' + side}>
            {pane === 'info' ? <div className="wf-info">
              <Media ex={ex} compact />
              <section><strong>{A.name}</strong><p>{completedRows}/{totalRows} · {t('Sets')}</p></section>
              <section><strong>{t(ex.eq || 'Exercise')}</strong><p>{setsRepsOf(entry.target || {})} · {fmtRest(restSec)}</p></section>
              {notes.length > 0 && <section><strong>{t('Note')}</strong>{notes.map(note => <p key={note}>{note}</p>)}</section>}
              {A.note && <section><strong>{t('Session note')}</strong><p>{A.note}</p></section>}
              {unit.length > 1 && <section><strong>{t('Superset')}</strong><p>{unit.map(index => exerciseNameFor(exOr(A.entries[index].id))).join(' + ')}</p></section>}
              {instructions.length > 0 && <section><strong>{t('How to')}</strong>
                {getLang() !== 'en' && !instrTranslated(ex) && <p>{t('instructions in English')}</p>}
                <ol className="steps-list">{instructions.map((instruction, index) => <li key={index}>{instruction}</li>)}</ol>
              </section>}
            </div> : pane === 'stations' ? <div className="wf-stations">
              {A.entries.map((candidate, index) => <button type="button" key={index} aria-current={index === entryIdx ? 'true' : undefined} disabled={!!work}
                onClick={() => { onSelectEntry(index); setPane(null) }}>
                <span className="wf-station-copy"><strong>{exerciseNameFor(exOr(candidate.id))}</strong><small>{candidate.sets.filter(s => s.done).length}/{candidate.sets.length}</small></span>
                <span className="wf-dots" aria-hidden="true">{candidate.sets.map((s, i) => <i key={i} className={s.done ? 'done' : ''} />)}</span><Icon name="chevronRight" />
              </button>)}
            </div> : pane === 'load' ? <div className="wf-info"><div className="wf-fields">{mode === 'cardio' ? cardioFields : <>{weightField}{timedFields}</>}</div>{plateInfo}</div> : pane === 'more' ? <div className="wf-fields">
              {mode === 'reps' && effortField && <div className="wf-effort-field"><span>{t(EFFORT[effort].hd)}</span><div className="wf-effort-edit">
                <button type="button" aria-label={t('Decrease')} disabled={readonly} onClick={() => field(effortField, stepEffort(effort, set?.[effortField], -1))}><Icon name="minus" /></button>
                <NumberField aria-label={t(EFFORT[effort].hd)} nullable value={set?.[effortField] ?? null} placeholder="–" disabled={readonly} onChange={value => field(effortField, capEffort(effort, value))} />
                <button type="button" aria-label={t('Increase')} disabled={readonly} onClick={() => field(effortField, stepEffort(effort, set?.[effortField], 1))}><Icon name="plus" /></button>
              </div></div>}
              {mode !== 'cardio' && <button type="button" className="wf-effort" aria-pressed={isFailureSet(row)} disabled={readonly || isWarmupRow(row)} onClick={() => mutate(toggleFailure)}><Icon name={isFailureSet(row) ? 'check' : 'gauge'} />{t('Taken to failure')}</button>}
              {drops.map((drop, index) => <section key={'d' + index}><strong>{t('Drop {0}', index + 1)}</strong>
                <Stepper label={t('Load')} ariaLabel="load" value={drop.w} step={loadStep} onStep={stepLoad} disabled={readonly} onChange={value => mutate(current => side ? setSideDropAt(current, side, index, { w: value }) : setDropAt(current, index, { w: value }))} />
                <Stepper label={t('Reps')} ariaLabel="reps" value={drop.r} decimal={false} disabled={readonly} onChange={value => mutate(current => side ? setSideDropAt(current, side, index, { r: value }) : setDropAt(current, index, { r: value }))} />
              </section>)}
              {bursts.map((burst, index) => <section key={'b' + index}><strong>{t('Burst {0}', index + 1)} · {fmtRest(burst.restSec)}</strong>
                <Stepper label={t('Reps')} ariaLabel="reps" value={burst.r} decimal={false} disabled={readonly} onChange={value => mutate(current => {
                  if (side) return setSideClusterAt(current, side, index, value)
                  const delta = value - (clustersOf(current)[index]?.r || 0)
                  return { ...setClusterAt(current, index, { r: value }), r: Math.max(0, (current.r || 0) + delta) }
                })} />
              </section>)}
            </div> : pane === 'finish' ? <div className="wf-prep"><Icon name="flag" /><strong>{tn('{0} set', '{0} sets', completedRows)}</strong>
            </div> : phase === 'rest' ? <>
              <span className="wf-countdown" role={timer.ready ? 'status' : undefined}>{timer.ready ? t('Ready') : clock(timer.left)}</span>
              <div className="wf-rest-adjust">
                <button type="button" aria-label={t('Less time')} disabled={timer.ready} onClick={() => useUI.getState().addRest(-15)}><span>−15s</span></button>
                <button type="button" aria-label={t(timer.paused ? 'Resume' : 'Pause')} aria-pressed={!!timer.paused} disabled={timer.ready} onClick={() => timer.paused ? useUI.getState().resumeRest() : useUI.getState().pauseRest()}><Icon name={timer.paused ? 'play' : 'pause'} /></button>
                <button type="button" aria-label={t('More time')} disabled={!timer.ready && timer.left >= REST_MAX} onClick={() => useUI.getState().addRest(15)}><span>+15s</span></button>
              </div>
            </> : phase === 'working' ? <span className="wf-countdown">{clock(work.left)}</span> : phase === 'complete' ? <div className="wf-prep"><Icon name="check" /><strong>{t('Completed')}</strong></div> : phase === 'prep' ? <div className="wf-prep">
              <Icon name={mode === 'cardio' ? 'timer' : 'barbell'} />
              <div className="wf-fields">{mode === 'cardio' ? cardioFields : <>{weightField}{timedFields}</>}</div>
              <p>{fmtRest(restSec)} · {t('Rest')}</p>
            </div> : mode === 'reps' ? <>
              <div className="wf-wheel">
                <NumberField id={id + '-reps'} className="wf-rep-input" aria-label={t('Reps')} value={set?.r ?? 0} decimal={false} onChange={value => field('r', Math.min(999, value))} />
                <label className="wf-rep-label" htmlFor={id + '-reps'}>{t('Reps')}</label>
                <button type="button" className="wf-wheel-step minus" aria-label={t('Decrease') + ' ' + t('Reps')} disabled={!set?.r} onClick={() => field('r', Math.max(0, (set.r || 0) - 1))}><Icon name="minus" /></button>
                <button type="button" className="wf-wheel-step plus" aria-label={t('Increase') + ' ' + t('Reps')} onClick={() => field('r', Math.min(999, (set.r || 0) + 1))}><Icon name="plus" /></button>
              </div>
              <span className="wf-load"><Icon name="plate" />{fmtNum(set?.w ?? 0)} <small>{S.unit}</small></span>
            </> : mode === 'cardio' ? <div className="wf-fields">{cardioFields}</div> : <div className="wf-prep"><Icon name="timer" /><strong>{clock(set?.sec ?? entry.target?.sec ?? 45)}</strong></div>}
          </div>
        </div>
        <footer className="wf-actionbar">
          {phase === 'working' && !pane ? <button type="button" className="wf-secondary" aria-label={t('Cancel')} title={t('Cancel')} onClick={() => useUI.getState().stopWork()}><Icon name="xmark" /></button> : <span className="wf-dots" aria-hidden="true">{entry.sets.map((s, index) => <i key={index} className={s.done ? 'done' : index === setIdx ? 'current' : ''} />)}</span>}
          <button type="button" className="wf-primary" onClick={primary.run}><Icon name={primary.icon} />{primary.label}</button>
        </footer>
      </section>
      <div className="wf-rail">
        <div className="wf-tools" aria-hidden={!open} inert={!open}>
          {[['info', 'info', t('Details')], ['stations', 'list', t('Exercises')], ['load', 'barbell', t('Load')], ['more', 'more', t('More')], ['finish', 'flag', t('Finish')]].map(([key, icon, label]) =>
            <button type="button" key={key} aria-label={label} title={pane === key ? t('Close') : label} aria-expanded={pane === key} aria-controls={id + '-panel'} onClick={() => disclose(key)}><Icon name={pane === key ? 'xmark' : icon} /></button>)}
        </div>
        <button type="button" className="wf-summary" aria-hidden={!!open} inert={!!open} tabIndex={open ? -1 : 0} onClick={() => setOpen(true)}><strong>{exerciseNameFor(ex)}</strong><span>{summary}<Icon name="chevronRight" /></span></button>
        <button type="button" ref={toggleRef} className="wf-toggle" aria-label={open ? t('Close') : t('Focus')} title={open ? t('Close') : t('Focus')} aria-expanded={!!open} aria-controls={id + '-panel'} onClick={() => { setPane(null); setOpen(!open) }}><Ring timer={work || timer} /><Icon name={open ? 'xmark' : 'target'} /></button>
      </div>
    </div>
  </>, document.body)
}
