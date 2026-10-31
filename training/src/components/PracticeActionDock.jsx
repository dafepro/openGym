import { createPortal } from 'react-dom'
import Icon from './Icon.jsx'
import PlayPauseIcon from './PlayPauseIcon.jsx'
import { formatClock } from './ui.jsx'

// Each phase has one start/pause action and one explicit record/advance action.
// Browsing, pausing, and quitting never imply that a drill was completed.
export default function PracticeActionDock({ drill, sets = [], currentSetIndex = 0, phase, primaryLabel, onPrimary, disabled, practiceSeconds = 0, practicePaused, onTogglePracticePause, remainingSeconds = 0, totalSeconds = 0, onPauseRest, onResumeRest, onAdjustRest, onStop, onUndo, onQuit, restPaused, onReviewUnfinished, actualValue, onActualChange }) {
  const free = drill?.mode === 'practice', watch = drill?.mode === 'watch'
  const ready = phase === 'ready', working = phase === 'working', rest = phase === 'rest', review = phase === 'review', complete = phase === 'complete'
  const row = sets[currentSetIndex]
  const paused = free ? practicePaused : rest ? restPaused : ready && row?.status === 'stopped'
  const counting = working && drill?.mode === 'reps' || review
  const canStart = ready && !watch
  const playAction = canStart ? onPrimary : rest ? restPaused ? onResumeRest : onPauseRest : working && free ? onTogglePracticePause : working && drill?.mode === 'time' ? onStop : null
  const playLabel = canStart ? paused ? 'Resume set' : primaryLabel || (free ? 'Start drill' : 'Start set') : rest ? restPaused ? 'Resume rest' : 'Pause rest' : free ? practicePaused ? 'Resume practice timer' : 'Pause practice timer' : 'Pause set'
  const nextLabel = complete ? 'Save session' : rest ? 'Skip rest' : review ? 'Confirm time' : watch ? 'Mark reviewed' : free ? 'Next drill' : 'Set done'
  const nextEnabled = !canStart && !!onPrimary && !disabled
  const seconds = free ? Math.floor(practiceSeconds) : rest || working ? Math.ceil(remainingSeconds) : Math.max(0, (drill?.durationSec || 0) - (row?.actual || 0))
  const caption = watch ? 'Video review' : complete ? 'Practice recorded' : rest ? restPaused ? 'Rest paused' : 'Rest' : review ? 'Confirm elapsed set' : free ? working ? practicePaused ? 'Timer paused' : 'Time practiced' : 'Ready to practice' : `Set ${row?.setNumber || currentSetIndex + 1} of ${drill?.sets || 1}${row?.side ? ` · ${row.side} foot` : ''}`
  const changeCount = delta => onActualChange?.(String(Math.min(review ? 86400 : 9999, Math.max(0, Number(actualValue || 0) + delta))))
  const panel = <section className="qt-workout-controls" data-phase={phase} aria-label="Practice controls">
    <p className="qt-control-caption" key={`${phase}-${paused}`}>{caption}</p>
    <div className="qt-control-row">
      <button className="qt-control-edge qt-control-quit" type="button" onClick={onQuit} disabled={!onQuit} aria-label="Quit practice"><Icon name="close" size={25} /><span>Quit</span></button>
      <div className="qt-control-center">
        {counting ? <div className="qt-count-stepper">
          <button type="button" onClick={() => changeCount(-1)} disabled={!onActualChange || Number(actualValue) <= 0} aria-label={review ? 'Subtract one second' : 'Subtract one repetition'}>−</button>
          <label><input type="number" min="0" max={review ? 86400 : 9999} inputMode="numeric" aria-label={review ? 'Seconds actually completed' : 'Repetitions completed'} value={actualValue ?? ''} onChange={event => onActualChange?.(event.target.value)} readOnly={!onActualChange} /><span>{review ? 'seconds' : `of ${drill.reps} reps`}</span></label>
          <button type="button" onClick={() => changeCount(1)} disabled={!onActualChange || Number(actualValue) >= (review ? 86400 : 9999)} aria-label={review ? 'Add one second' : 'Add one repetition'}>+</button>
        </div> : <>
          <div className="qt-control-measure">{complete ? <Icon name="check" size={30} /> : watch ? <Icon name="video" size={30} /> : drill?.mode === 'reps' && !rest ? <strong>{drill.reps}<small> reps</small></strong> : <strong role="timer" aria-label={free ? 'Time practiced' : `${rest ? 'Rest' : 'Work'} time remaining`}>{formatClock(seconds)}</strong>}<span>{complete ? 'Ready to save' : canStart ? paused ? 'Paused' : 'Tap play to start' : free ? 'Self-paced' : rest ? 'Recover' : 'Keep your focus'}</span></div>
          {!complete && !watch && <button className="qt-control-play" type="button" aria-label={playLabel} onClick={playAction} disabled={!playAction || canStart && disabled}><PlayPauseIcon playing={!!playAction && !canStart && !paused} /></button>}
        </>}
      </div>
      <button className="qt-control-edge qt-control-next" type="button" onClick={nextEnabled ? onPrimary : undefined} disabled={!nextEnabled} aria-label={nextLabel} title={working ? free ? 'Record this drill and move on' : 'Record this set' : nextLabel}><Icon name="forward" size={26} /><span>{complete ? 'Save' : rest ? 'Skip' : review || watch ? 'Confirm' : free ? 'Next' : 'Set done'}</span></button>
    </div>
    <div className="qt-control-extras">{rest ? <><button type="button" onClick={() => onAdjustRest?.(-15)} disabled={!onAdjustRest} aria-label="Reduce rest by 15 seconds">−15s</button>{onUndo && <button type="button" onClick={onUndo}>Undo set</button>}<button type="button" onClick={() => onAdjustRest?.(15)} disabled={!onAdjustRest} aria-label="Add 15 seconds of rest">+15s</button></> : review ? <button type="button" onClick={onReviewUnfinished} disabled={!onReviewUnfinished}>Keep unfinished</button> : onUndo ? <button type="button" onClick={onUndo}><Icon name="undo" size={14} />Undo last {free ? 'drill' : 'set'}</button> : <span>{working ? free ? 'Next records this drill as done' : 'Record only the work you complete' : complete ? 'Save this practice to your history' : 'Check the setup, then tap play'}</span>}</div>
    <div className="qt-control-progress" aria-hidden="true"><i style={{ transform: `scaleX(${totalSeconds > 0 && (rest || working) ? Math.max(0, Math.min(1, remainingSeconds / totalSeconds)) : 0})` }} /></div>
  </section>
  // Keep fixed controls outside any transformed navigation surface.
  return typeof document === 'undefined' ? panel : createPortal(panel, document.body)
}
