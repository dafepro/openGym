import { Button } from './ui.jsx'

export default function PracticeActionDock({ phase, primaryLabel, onPrimary, disabled, onPauseRest, onResumeRest, onAdjustRest, onStop, onUndo, restPaused, onReviewUnfinished }) {
  const rest = phase === 'rest'
  const label = primaryLabel || (phase === 'working' ? 'Set done' : phase === 'review' ? 'Confirm elapsed set' : phase === 'complete' ? 'Finish session' : 'Start set')
  return <div className={`qt-action-dock qt-action-dock--${rest ? 'rest' : 'work'}`}>
    <div className="qt-secondary-rail">{rest ? <><button type="button" onClick={() => onAdjustRest?.(-15)} disabled={!onAdjustRest} aria-label="Reduce rest by 15 seconds">−15s</button><button type="button" onClick={restPaused ? onResumeRest : onPauseRest} disabled={restPaused ? !onResumeRest : !onPauseRest}>{restPaused ? 'Resume rest' : 'Pause rest'}</button><button type="button" onClick={() => onAdjustRest?.(15)} disabled={!onAdjustRest} aria-label="Add 15 seconds of rest">+15s</button></> : phase === 'working' && onStop ? <button type="button" onClick={onStop}>Stop set</button> : phase === 'review' && onReviewUnfinished ? <button type="button" onClick={onReviewUnfinished}>Keep unfinished</button> : onUndo ? <button type="button" onClick={onUndo}>Undo last set</button> : <span aria-hidden="true" />}</div>
    <Button icon={phase === 'working' || phase === 'review' ? 'check' : phase === 'complete' ? 'flag' : 'play'} onClick={onPrimary} disabled={disabled || !onPrimary}>{label}</Button>
  </div>
}
