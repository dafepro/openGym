import { useEffect, useId, useRef } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { exOr } from '../lib/exercises.js'
import { exerciseNameFor, instrFor, instrTranslated, getLang, useLang, t } from '../lib/i18n.js'
import { fmtNum, fmtPlate } from '../lib/format.js'
import { modeOf, pinnedNoteFor, setsRepsOf, isPerSide } from '../lib/history.js'
import { isSideSet, isWarmupRow, setSideField, dropsOf, clustersOf } from '../lib/workout-model.js'
import { focusSet, focusRest, focusLoadLabel, lastFocusSet, focusEntryKey, focusFlowEntries } from '../lib/workout-focus.js'
import { baseWeightFor, inventoryFor, loadKindFor, rowLoad } from '../lib/plates.js'
import { REST_MAX, fmtRest } from '../lib/duration.js'
import { NumberField } from './ui.jsx'
import Icon from './Icon.jsx'
import Media from './Media.jsx'
import FocusSetFields from './FocusSetFields.jsx'
import FocusSwitch from './FocusSwitch.jsx'
import './WorkoutFocus.css'

const clock = sec => {
  const n = Math.abs(Math.round(sec))
  return (sec < 0 ? '+' : '') + Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0')
}

function Disclosure({ name, label, icon, pane, disclose, children }) {
  const expanded = pane === name
  const id = useId()
  return <section className={'wf-disclosure' + (expanded ? ' expanded' : '')}>
    <button type="button" className="wf-row-toggle" aria-label={label} aria-expanded={expanded} aria-controls={id} onClick={() => disclose(name)}>
      <Icon name={icon} /><span>{label}</span><Icon name={expanded ? 'chevronUp' : 'chevronDown'} />
    </button>
    <div id={id} className="wf-expander" aria-hidden={!expanded} inert={!expanded}><div>{children}</div></div>
  </section>
}

export default function WorkoutFocus({
  entryIdx, unit, controlsForEntry, onSelectEntry, onAdvanceUnit,
  onToggle, onToggleSide, onField, onSideField, onMutateSet, onStartTimed, onFinish, onAddExercise,
}) {
  const S = useStore(s => s.S)
  useLang()
  const { focusPrepared: prepared, focusView: view = 'live',
    focusPane: pane, focusLastSet: tracked, focusSkippedWarmups: skipped, timer, work, sheets = [] } = useUI()
  const A = S.active
  const current = focusSet(A, entryIdx, skipped)
  const { entry, setIdx, row, set, side } = current
  const actionRef = useRef(null), pageRef = useRef(null), lastRecord = useRef(-Infinity)
  const lastEditor = useRef(null)
  const infoVisited = useRef(null)
  const id = useId()
  const sessionKey = A?.id ?? A?.start
  const prepKey = entryIdx + ':' + entry?.id
  if (pane === 'info') infoVisited.current = prepKey
  const setPane = value => useUI.setState({ focusPane: value, focusDetailsOpen: !!value || view === 'workout' })
  const disclose = value => {
    if (value === 'last' && pane !== 'last') lastEditor.current = lastFocusSet(A, tracked, timer)
    setPane(pane === value ? null : value)
  }
  const dismiss = () => useUI.getState().dismissFocus()

  useEffect(() => {
    document.body.classList.add('workout-focus')
    return () => document.body.classList.remove('workout-focus')
  }, [])
  useEffect(() => { if (useUI.getState().focusPane) setPane(null) }, [sessionKey, prepKey])
  useEffect(() => { lastRecord.current = -Infinity }, [sessionKey])
  useEffect(() => {
    const keydown = event => {
      if (useUI.getState().sheets.length) return
      if (event.key === 'Escape') {
        if (!dismiss()) return
        event.preventDefault(); event.stopPropagation()
        pageRef.current?.querySelector('.wf-info-toggle')?.focus({ preventScroll: true })
      } else if ((event.key === ' ' || event.key === 'Enter') && !event.repeat &&
        !event.target?.closest?.('button,input,textarea,select,a,[contenteditable="true"]') &&
        !useUI.getState().focusDetailsOpen) {
        event.preventDefault(); actionRef.current?.()
      }
    }
    document.addEventListener('keydown', keydown, true)
    return () => document.removeEventListener('keydown', keydown, true)
  }, [])
  if (!entry) return null

  const ex = exOr(entry.id), mode = modeOf({ ...entry.target, id: entry.id })
  const isPrepared = prepared?.sessionId === sessionKey && !!prepared?.entries?.includes(prepKey)
  const phase = work ? 'working' : timer ? 'rest' : !row ? 'complete' : !isPrepared ? 'prep' : 'set'
  const readonly = !!work || !row
  const latest = lastFocusSet(A, tracked, timer)
  // Capture the row on expansion: a timer completion must never retarget an open editor.
  const previous = pane === 'last' ? lastEditor.current : latest
  const controls = { onToggle, onToggleSide, onField, onSideField, onMutateSet, onStartTimed }
  const validTarget = (target, completed = false) => {
    const fresh = useStore.getState().S.active
    const freshEntry = fresh?.entries[target?.entryIdx], freshRow = freshEntry?.sets[target?.setIdx]
    if ((fresh?.id ?? fresh?.start) !== sessionKey || freshEntry?.id !== target?.entry?.id || !freshRow) return false
    if (completed) return freshRow.at === target.row.at && (target.side ? freshRow.sides?.[target.side]?.done : freshRow.done)
    const freshCur = Number.isInteger(fresh?.cur) ? Math.min(Math.max(fresh.cur, 0), Math.max(0, fresh.entries.length - 1)) : 0
    return freshCur === target.entryIdx && focusSet(fresh, target.entryIdx, useUI.getState().focusSkippedWarmups).setIdx === target.setIdx &&
      !freshRow.done && (!target.side || !freshRow.sides?.[target.side]?.done) && !useUI.getState().work
  }
  const handlers = (target, completed = false) => {
    const bound = !target ? null : target.entryIdx === entryIdx ? controls : controlsForEntry?.(target.entryIdx)
    return {
      field: (name, value) => {
        if (!validTarget(target, completed) || !bound) return
        if (target.side) {
          if (bound.onSideField) bound.onSideField(target.setIdx, target.side, name, value)
          else bound.onMutateSet(target.setIdx, current => setSideField(current, target.side, name, value))
        } else bound.onField(target.setIdx, name, value)
      },
      mutate: fn => { if (validTarget(target, completed) && bound) bound.onMutateSet(target.setIdx, fn) },
    }
  }
  const edit = handlers(current)
  const previousRow = previous && A.entries[previous.entryIdx]?.sets[previous.setIdx]
  const previousTarget = previous && previousRow && { ...previous, entry: A.entries[previous.entryIdx], row: previousRow, set: previous.side ? previousRow.sides?.[previous.side] : previousRow }
  const previousValid = previous && validTarget(previous, true)
  const lastEdit = handlers(previous, true)
  const undoLast = () => {
    if (!previousValid || useUI.getState().work) return
    const bound = previous.entryIdx === entryIdx ? controls : controlsForEntry?.(previous.entryIdx)
    if (!bound) return
    if (previous.side) bound.onToggleSide(previous.setIdx, previous.side)
    else bound.onToggle(previous.setIdx)
    const rest = useUI.getState().timer
    if (rest?.forIdx === previous.entryIdx && rest?.forSet === previous.setIdx) useUI.getState().stopRest()
    onSelectEntry(previous.entryIdx); setPane(null)
    lastRecord.current = Date.now()
  }
  const ready = () => useUI.setState(current => ({ focusPrepared: {
    sessionId: sessionKey,
    entries: [...new Set([...(current.focusPrepared?.sessionId === sessionKey ? current.focusPrepared.entries : []), prepKey])],
  } }))
  const progress = ({ unitDone }) => { if (unitDone) onAdvanceUnit() }
  const record = () => {
    if (!validTarget(current) || useUI.getState().timer || Date.now() - lastRecord.current < 600) return
    lastRecord.current = Date.now()
    if (side) onToggleSide(setIdx, side, progress)
    else onToggle(setIdx, progress)
  }
  const start = () => {
    if (!validTarget(current) || useUI.getState().timer) return
    lastRecord.current = Date.now(); ready()
    if (mode === 'time') onStartTimed(setIdx, progress)
  }
  const leaveRest = () => { lastRecord.current = Date.now(); useUI.getState().stopRest() }
  const skipWarmups = () => {
    if (!validTarget(current) || !isWarmupRow(row)) return
    lastRecord.current = Date.now()
    useUI.setState(ui => ({ focusPane: null, focusDetailsOpen: view === 'workout', focusSkippedWarmups: {
      sessionId: sessionKey,
      entries: [...new Set([...(ui.focusSkippedWarmups?.sessionId === sessionKey ? ui.focusSkippedWarmups.entries : []), focusEntryKey(A, entryIdx)])],
    } }))
  }
  const finishTimed = () => {
    const current = useUI.getState().work
    if (!current || Date.now() - (current.endsAt - current.total * 1000) < 600) return
    lastRecord.current = Date.now(); useUI.getState().finishWorkEarly()
  }
  const allDone = focusFlowEntries(A, skipped).every(e => e.sets.every(s => s.done))
  const canSkipWarmups = !work && isWarmupRow(row) && entry.sets.some(s => !isWarmupRow(s) && !s.done)
  const primary = phase === 'rest' ? { label: t(timer.ready ? 'Next set' : 'Skip rest'), icon: timer.ready ? 'play' : 'skipForward', run: leaveRest } :
    phase === 'working' ? { label: t('Done'), icon: 'check', run: finishTimed } :
    phase === 'complete' ? { label: allDone ? t('Add exercise') : t('Next'), icon: allDone ? 'plus' : 'arrowRight', run: allDone ? onAddExercise : onAdvanceUnit, disabled: allDone && !onAddExercise } :
    phase === 'prep' || mode === 'time' ? { label: t('Start'), icon: 'play', run: start } : { label: t('Done'), icon: 'check', run: record }
  actionRef.current = primary.run
  const restSec = focusRest(A, entryIdx, setIdx, S.restSec)
  const loadLabel = t(...focusLoadLabel(entry, S.unit))
  const load = set && mode === 'reps' ? rowLoad(loadKindFor(S, { ...entry.target, id: entry.id }), set.w, baseWeightFor(S, entry.id), inventoryFor(S)) : null
  const notes = [...new Set([S.exNotes?.[entry.id], entry.target?.note, entry.note, pinnedNoteFor(S, entry.id)?.note].filter(Boolean))]
  const summary = work ? t('Time') + ' · ' + clock(work.left) : timer ? t(timer.ready ? 'Ready' : timer.paused ? 'Paused' : 'Rest') + (timer.ready ? '' : ' · ' + clock(timer.left)) : row ? t('Set {0}', setIdx + 1) + ' / ' + entry.sets.length : t('Completed')
  const phaseLabel = work ? t('Time') : timer ? t(timer.kind === 'switch' ? 'Switch sides' : timer.ready ? 'Ready' : timer.paused ? 'Paused' : 'Rest') : summary
  const kicker = view === 'workout' ? t('Workout') : phaseLabel + (side || row?.side ? ' · ' + t((side || row.side) === 'L' ? 'Left' : 'Right') : '') + (isWarmupRow(row) ? ' · ' + t('Warm-up') : '')
  const timerFraction = Math.max(0, Math.min(1, (work || timer)?.left / (work || timer)?.total))
  const mainFields = <FocusSetFields target={current} {...edit} disabled={readonly} />
  const lastLabel = t('Last set') + (previousTarget ? ' · ' + t('Set {0}', previousTarget.setIdx + 1) + (previousTarget.entryIdx !== entryIdx ? ' · ' + exerciseNameFor(exOr(previousTarget.entry.id)) : '') + (previousTarget.side ? ' · ' + t(previousTarget.side === 'L' ? 'Left' : 'Right') : '') : '')
  const lastFields = previousTarget && <Disclosure name="last" label={lastLabel} icon="pencil" pane={pane} disclose={disclose}>
    <FocusSetFields target={previousTarget} {...lastEdit} disabled={!previousValid} effort extras />
  </Disclosure>
  const loadDisclosure = <Disclosure name="load" label={loadLabel + ' · ' + fmtNum(set?.w ?? 0)} icon="barbell" pane={pane} disclose={disclose}>
    {mainFields}
    {load && <div className="wf-plate"><strong>{t('Plate loading')}</strong><p>{load.barOnly ? t('Bar only') : load.kind === 'pairs' ? t('{0} per side', load.plates.map(fmtPlate).join(' + ') || '–') : t('Load {0}', load.plates.map(fmtPlate).join(' + ') || '–')}</p>{load.missing > 0 && <p className="wf-errors">{t('{0} short', fmtPlate(load.missing) + ' ' + S.unit)}</p>}</div>}
  </Disclosure>

  return <section ref={pageRef} className="wf-page" data-testid="focus-view" data-phase={phase} aria-label={t('Focus')}>
      <section id={id + '-panel'} className="wf-panel" aria-hidden={!!sheets.length} inert={!!sheets.length}>
        <header className="wf-header"><div><span className="wf-kicker">{kicker}</span><h2>{view === 'workout' ? A.name : work?.label || exerciseNameFor(ex)}</h2></div>
          {view === 'live' && <button type="button" className="wf-info-toggle" aria-label={t('Details')} aria-expanded={pane === 'info'} aria-controls={id + '-info'} onClick={() => disclose('info')}><Icon name={pane === 'info' ? 'chevronUp' : 'info'} /></button>}
        </header>
        {(work || timer) && <div className={'wf-timer-strip' + (view === 'live' ? ' wf-live-timer' : '')}><span role={timer?.ready ? 'status' : undefined}>{view === 'workout' ? summary : timer?.ready ? t('Ready') : clock((work || timer).left)}</span><div className="wf-timer-progress"><i style={{ width: (timerFraction * 100 || 0) + '%' }} /></div></div>}
        <div className="wf-content">
          <FocusSwitch stateKey={view + ':' + phase + ':' + entryIdx + ':' + setIdx + ':' + side}>
            {view === 'workout' ? <div className="wf-stations">
              {A.entries.map((candidate, index) => <button type="button" key={index} aria-current={index === entryIdx ? 'true' : undefined} disabled={!!work} onClick={() => {
                onSelectEntry(index); useUI.setState({ focusView: 'live', focusPane: null, focusDetailsOpen: false })
              }}><span><strong>{exerciseNameFor(exOr(candidate.id))}</strong><small>{t('{0} sets', candidate.sets.filter(s => s.done).length + '/' + candidate.sets.length)}</small></span><Icon name={candidate.sets.length && candidate.sets.every(s => s.done) ? 'check' : 'chevronRight'} /></button>)}
            </div> : <>
              <div id={id + '-info'} className={'wf-expander wf-info' + (pane === 'info' ? ' expanded' : '')} aria-hidden={pane !== 'info'} inert={pane !== 'info'}><div>
                {infoVisited.current === prepKey && <><Media ex={ex} compact /><p>{setsRepsOf(entry.target || {})} · {fmtRest(restSec)} · {t('Rest')}</p>{notes.map(note => <p key={note}>{note}</p>)}{A.note && <p>{A.note}</p>}{unit.length > 1 && <p>{t('Superset')} · {unit.map(index => exerciseNameFor(exOr(A.entries[index].id))).join(' + ')}</p>}
                  {instrFor(ex).length > 0 && <><strong>{t('How to')}</strong>{getLang() !== 'en' && !instrTranslated(ex) && <p>{t('instructions in English')}</p>}<ol className="steps-list">{instrFor(ex).map((instruction, index) => <li key={index}>{instruction}</li>)}</ol></>}
                </>}
              </div></div>
              {phase === 'rest' ? <>
                {row && <><div className="wf-next-label">{t('Next set')} · {t('Set {0}', setIdx + 1)} / {entry.sets.length}</div>{mode === 'cardio' ? mainFields : loadDisclosure}</>}
              </> : phase === 'working' ? null : phase === 'complete' ? <div className="wf-complete"><Icon name="check" /></div> : phase === 'prep' ? <div className="wf-prep">{mainFields}<p>{fmtRest(restSec)} · {t('Rest')}</p></div> : mode === 'reps' ? <>
                {row.max && <strong className="wf-target">{t('Max: as many reps as you can')}</strong>}
                {!row.max && entry.target?.repsMin > 0 && <span className="wf-target">{t('Reps')} · {entry.target.repsMin > 0 ? entry.target.repsMin + '–' : ''}{entry.target.reps}</span>}
                <div className="wf-reps-control"><span className="wf-rep-glow" aria-hidden="true" /><button type="button" aria-label={t('Decrease') + ' ' + t('Reps')} disabled={!set?.r} onClick={() => edit.field('r', Math.max(0, (set.r || 0) - 1))}><Icon name="minus" /></button><div><NumberField id={id + '-reps'} className="wf-rep-input" data-digits={String(set?.r ?? 0).length} aria-label={t('Reps')} value={set?.r ?? 0} decimal={false} onChange={value => edit.field('r', Math.min(999, value))} /><label htmlFor={id + '-reps'}>{clustersOf(set).length ? t('Total reps') : t('Reps')}</label></div><button type="button" aria-label={t('Increase') + ' ' + t('Reps')} onClick={() => edit.field('r', Math.min(999, (set.r || 0) + 1))}><Icon name="plus" /></button></div>
                {isPerSide({ ...entry.target, id: entry.id }) && !isSideSet(row) && <span className="wf-target">{t('{0} per side', fmtNum((set?.r || 0) / 2))}</span>}
                {loadDisclosure}
              </> : mode === 'cardio' ? mainFields : <div className="wf-prep"><strong>{clock(set?.planSec ?? set?.sec ?? entry.target?.sec ?? 45)}</strong>{loadDisclosure}</div>}
              {(dropsOf(set).length > 0 || clustersOf(set).length > 0) && phase !== 'working' && <FocusSetFields target={current} {...edit} main={false} extras disabled={readonly} />}
              {!timer && !work && row && phase !== 'prep' && mode !== 'cardio' && !isWarmupRow(row) && <Disclosure name="effort" label={t('More')} icon="gauge" pane={pane} disclose={disclose}><FocusSetFields target={current} {...edit} main={false} effort disabled={readonly} /></Disclosure>}
              {lastFields}
            </>}
          </FocusSwitch>
        </div>
        {view === 'workout' && <div className="wf-live-context">{exerciseNameFor(ex)} · {row ? t('Set {0}', setIdx + 1) + ' / ' + entry.sets.length : t('Completed')}</div>}
      </section>
      <div className="wf-actions" aria-hidden={!!sheets.length} inert={!!sheets.length}>
        {(canSkipWarmups || pane === 'last' && previousTarget || phase === 'working') && <div className="wf-secondary-actions">
          {pane === 'last' && previousTarget && <button type="button" disabled={!previousValid || !!work} onClick={undoLast}><Icon name="undo" />{t('Undo')}</button>}
          {canSkipWarmups && <button type="button" onClick={skipWarmups}><Icon name="skipForward" />{t('Skip warm-ups')}</button>}
          {phase === 'working' && <button type="button" onClick={() => useUI.getState().abandonWork()}><Icon name="stop" />{t('Stop')}</button>}
        </div>}
        {phase === 'rest' && <div className="wf-secondary-actions wf-rest-adjust">
          <button type="button" aria-label={t('Less time')} disabled={timer.ready} onClick={() => useUI.getState().addRest(-15)}>−15s</button>
          <button type="button" className="wf-pause" disabled={timer.ready} aria-label={t(timer.paused ? 'Resume' : 'Pause')} onClick={timer.paused ? useUI.getState().resumeRest : useUI.getState().pauseRest}><Icon name={timer.paused ? 'play' : 'pause'} />{t(timer.paused ? 'Resume' : 'Pause')}</button>
          <button type="button" aria-label={t('More time')} disabled={!timer.ready && timer.left >= REST_MAX} onClick={() => useUI.getState().addRest(15)}>+15s</button>
        </div>}
        <button type="button" className="wf-view-toggle" aria-label={t(view === 'workout' ? 'Live' : 'Workout')} aria-expanded={view === 'workout'} aria-controls={id + '-panel'} onClick={() => useUI.setState({ focusView: view === 'workout' ? 'live' : 'workout', focusPane: null, focusDetailsOpen: view !== 'workout' })}><Icon name={view === 'workout' ? 'target' : 'list'} /><span>{t(view === 'workout' ? 'Live' : 'Workout')}</span></button>
        <button type="button" className="wf-primary" disabled={primary.disabled} onClick={primary.run}><Icon name={primary.icon} /><span>{primary.label}</span></button>
        <button type="button" className="wf-finish" aria-label={t('Finish workout')} onClick={onFinish}><Icon name="flag" /><span>{t('Finish')}</span></button>
      </div>
    </section>
}
