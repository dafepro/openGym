import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon.jsx'
import PlayPauseIcon from './PlayPauseIcon.jsx'
import { formatClock } from './ui.jsx'
import '../styles/playbook-workout.css'

// All work actions share one stable surface. Completing a set records actual
// work; navigating or pausing never grants completion of the target.
export default function PracticeActionDock({ drill, drillIndex = 0, drillCount = 1, sets = [], currentSetIndex = 0, phase, primaryLabel, onPrimary, disabled, practiceSeconds = 0, practicePaused, onTogglePracticePause, remainingSeconds = 0, totalSeconds = 0, onPauseRest, onResumeRest, onAdjustRest, onStop, onRecordStopped, onUndo, onQuit, restPaused, onReviewUnfinished, actualValue, onActualChange }) {
  const panelRef = useRef(null)
  const focusedControl = useRef(null)
  useEffect(() => {
    const previous = focusedControl.current
    const focusWasHere = document.activeElement === document.body || panelRef.current?.contains(document.activeElement)
    if (focusWasHere && !document.querySelector('dialog[open]') && previous && (!previous.isConnected || previous.disabled)) {
      panelRef.current?.querySelector('.qt-control-play:not(:disabled), .qt-count-stepper button:not(:disabled), .qt-control-next:not(:disabled)')?.focus({ preventScroll: true })
    }
  }, [drill?.id, phase, currentSetIndex, actualValue])
  const free = drill?.mode === 'practice', watch = drill?.mode === 'watch'
  const ready = phase === 'ready', working = phase === 'working', rest = phase === 'rest', review = phase === 'review', complete = phase === 'complete'
  const row = sets[currentSetIndex]
  const paused = free ? practicePaused : rest ? restPaused : ready && row?.status === 'stopped'
  const counting = working && drill?.mode === 'reps' || review
  const canStart = ready && !watch
  const playAction = canStart ? onPrimary : rest ? restPaused ? onResumeRest : onPauseRest : working && free ? onTogglePracticePause : working && drill?.mode === 'time' ? onStop : null
  const playLabel = canStart ? paused ? 'Resume set' : primaryLabel || (free ? 'Start drill' : 'Start set') : rest ? restPaused ? 'Resume rest' : 'Pause rest' : free ? practicePaused ? 'Resume practice timer' : 'Pause practice timer' : 'Pause set'
  const lastDrill = drillIndex + 1 >= drillCount
  const lastSet = currentSetIndex >= Math.max(0, sets.length - 1)
  const workForwardLabel = free || lastSet ? lastDrill ? 'Finish practice' : 'Next drill' : 'Finish set'
  const nextLabel = complete ? 'Finish practice' : rest ? 'Skip rest' : review ? 'Confirm time' : watch ? 'Mark reviewed' : workForwardLabel
  const recordPausedTime = ready && paused && drill?.mode === 'time'
  const forwardAction = recordPausedTime ? onRecordStopped : onPrimary
  const nextEnabled = (!canStart || recordPausedTime) && !!forwardAction && !disabled
  const seconds = free ? Math.floor(practiceSeconds) : rest || working ? Math.ceil(remainingSeconds) : Math.max(0, (drill?.durationSec || 0) - (row?.actual || 0))
  const caption = watch ? 'Video review' : complete ? 'Practice recorded' : rest ? restPaused ? 'Rest paused' : 'Rest time left' : review ? 'Confirm time worked' : free ? working ? practicePaused ? 'Elapsed · paused' : 'Time practiced' : 'Elapsed · ready' : counting ? 'Repetitions completed' : paused ? 'Time left · paused' : 'Time left'
  const context = complete ? 'Ready to save' : free || watch ? `Drill ${drillIndex + 1} / ${drillCount}` : `${rest ? 'NEXT' : working ? 'WORK' : paused ? 'PAUSED' : 'READY'} · SET ${row?.setNumber || currentSetIndex + 1} / ${drill?.sets || 1}`
  const changeCount = delta => onActualChange?.(String(Math.min(review ? 86400 : 10000, Math.max(0, Number(actualValue || 0) + delta))))
  const panel = <section ref={panelRef} onFocusCapture={event => { focusedControl.current = event.target }} className="qt-workout-controls" data-layout="playbook" data-phase={phase} aria-label="Practice controls">
    <div className="qt-control-top">
      <div className="qt-control-readout">
        <p className="qt-control-caption" key={`${phase}-${paused}`}>{caption}</p>
        {counting ? <div className="qt-count-stepper">
          <button type="button" onClick={() => changeCount(-1)} disabled={!onActualChange || Number(actualValue) <= 0} aria-label={review ? 'Subtract one second' : 'Subtract one repetition'}>−</button>
          <label><input type="number" min="0" max={review ? 86400 : 10000} inputMode="numeric" aria-label={review ? 'Seconds actually completed' : 'Repetitions completed'} value={actualValue ?? ''} onChange={event => onActualChange?.(event.target.value)} readOnly={!onActualChange} /><span>{review ? 'seconds' : `of ${drill.reps} reps`}</span></label>
          <button type="button" onClick={() => changeCount(1)} disabled={!onActualChange || Number(actualValue) >= (review ? 86400 : 10000)} aria-label={review ? 'Add one second' : 'Add one repetition'}>+</button>
        </div> : <div className="qt-control-measure">
          {complete ? <Icon name="check" size={32} /> : watch ? <Icon name="video" size={32} /> : drill?.mode === 'reps' && !rest ? <strong>{drill.reps}<small> reps</small></strong> : <strong role="timer" aria-label={free ? 'Time practiced' : `${rest ? 'Rest' : 'Work'} time remaining`}>{formatClock(seconds)}</strong>}
          {canStart && <span>{paused ? 'Resume when ready' : free ? 'Self-paced' : 'Start when ready'}</span>}
        </div>}
      </div>
      {!counting && !complete && !watch && <button className="qt-control-play" type="button" aria-label={playLabel} onClick={playAction} disabled={!playAction || canStart && disabled}><PlayPauseIcon playing={!!playAction && !canStart && !paused} /><span>{canStart ? paused ? 'Resume' : 'Start' : paused ? 'Resume' : 'Pause'}</span></button>}
    </div>
    <div className="qt-control-row">
      <button className="qt-control-edge qt-control-quit" type="button" onClick={onQuit} disabled={!onQuit} aria-label="Quit practice"><Icon name="close" size={24} /><span>Exit</span></button>
      <div className="qt-control-context"><strong key={`${phase}-${currentSetIndex}`}>{context}</strong>{row?.side && <small>{row.side === 'left' ? 'Left foot' : 'Right foot'}</small>}</div>
      <button className="qt-control-edge qt-control-next" type="button" onClick={nextEnabled ? forwardAction : undefined} disabled={!nextEnabled} aria-label={nextLabel} title={working ? free ? lastDrill ? 'Record the final drill' : 'Record this drill and move on' : 'Record the work completed in this set' : nextLabel}><Icon name="forward" size={25} /><span>{complete ? 'Save' : rest ? 'Skip rest' : review || watch ? 'Confirm' : workForwardLabel}</span></button>
    </div>
    {(rest || review || onUndo) && <div className="qt-control-extras">{rest ? <><button type="button" onClick={() => onAdjustRest?.(-15)} disabled={!onAdjustRest} aria-label="Reduce rest by 15 seconds">−15s rest</button>{onUndo && <button type="button" onClick={onUndo}>Undo set</button>}<button type="button" onClick={() => onAdjustRest?.(15)} disabled={!onAdjustRest} aria-label="Add 15 seconds of rest">+15s rest</button></> : review ? <button type="button" onClick={onReviewUnfinished} disabled={!onReviewUnfinished}>Keep unfinished</button> : <button type="button" onClick={onUndo}><Icon name="undo" size={14} />Undo last {free ? 'drill' : 'set'}</button>}</div>}
    <div className="qt-control-progress" aria-hidden="true"><i style={{ transform: `scaleX(${totalSeconds > 0 && (rest || working) ? Math.max(0, Math.min(1, remainingSeconds / totalSeconds)) : 0})` }} /></div>
  </section>
  return typeof document === 'undefined' ? panel : createPortal(panel, document.body)
}
