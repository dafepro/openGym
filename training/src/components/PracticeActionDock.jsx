import Icon from './Icon.jsx'

// Keep the whole immediate action flow in one large, steady bottom panel.
// Only controls supported by the active phase are enabled.
export default function PracticeActionDock({
  phase, stopLabel = 'Stop set', primaryLabel, onPrimary, disabled,
  onPauseRest, onResumeRest, onAdjustRest, onStop, onFinish, onUndo,
  restPaused, onReviewUnfinished, onTogglePracticePause, practicePaused,
  canPausePractice = false, clockLabel = 'Practice clock', clockValue = '0:00',
  clockFraction = 0,
}) {
  const rest = phase === 'rest'
  const working = phase === 'working'
  const pause = rest
    ? { label: restPaused ? 'Resume' : 'Pause', action: restPaused ? onResumeRest : onPauseRest }
    : canPausePractice && working
      ? { label: practicePaused ? 'Resume' : 'Pause', action: onTogglePracticePause }
      : { label: 'Pause', action: null }
  const stop = working ? onStop : onFinish
  const actionLabel = primaryLabel || (phase === 'working' ? 'Set done' : phase === 'rest' ? 'Skip rest' : phase === 'review' ? 'Confirm elapsed set' : phase === 'complete' ? 'Finish session' : 'Start set')
  const nextLabel = phase === 'complete' ? 'Finish' : phase === 'review' ? 'Confirm' :
    phase === 'ready' ? actionLabel === 'Mark reviewed' ? 'Reviewed' : 'Start' : 'Next'
  const doneHint = working && (actionLabel === 'Set done' || actionLabel === 'Drill done' || actionLabel === 'Done')
  return <div className={`qt-action-dock qt-action-dock--${rest ? 'rest' : 'work'}`} aria-label="Practice actions">
    <div className="qt-action-clock" aria-live="off">
      <span>{clockLabel}</span>
      <strong role="timer">{clockValue}</strong>
      <span className="qt-action-progress" aria-hidden="true"><i style={{ transform: `scaleX(${Math.max(0, Math.min(1, clockFraction))})` }} /></span>
    </div>
    <div className="qt-action-main">
      <button className="qt-action-stop" type="button" onClick={stop} disabled={!stop} aria-label={working ? stopLabel : 'Stop practice'}>
        <Icon name="close" size={23} /><span>Stop</span>
      </button>
      <button className="qt-action-pause" type="button" onClick={pause.action} disabled={!pause.action} aria-label={pause.label + (rest ? ' rest' : canPausePractice ? ' practice timer' : '')}>
        <Icon name={pause.label === 'Resume' ? 'play' : 'pause'} size={22} /><span>{pause.label}</span>
      </button>
      <button className="qt-action-next" type="button" onClick={onPrimary} disabled={disabled || !onPrimary} aria-label={doneHint ? actionLabel + ', next' : actionLabel}>
        <span>{doneHint && <small>Done</small>}<strong>{nextLabel}</strong></span><Icon name="arrow" size={26} />
      </button>
    </div>
    {rest && <div className="qt-secondary-rail qt-rest-adjust">
      <button type="button" onClick={() => onAdjustRest?.(-15)} disabled={!onAdjustRest}>−15s</button>
      <button type="button" onClick={() => onAdjustRest?.(15)} disabled={!onAdjustRest}>+15s</button>
    </div>}
    {(onUndo || phase === 'review' && onReviewUnfinished) && <div className="qt-secondary-rail qt-optional-actions">
      {phase === 'review' && onReviewUnfinished
        ? <button type="button" onClick={onReviewUnfinished}>Keep unfinished</button>
        : onUndo && <button type="button" onClick={onUndo}>Undo last entry</button>}
    </div>}
  </div>
}
