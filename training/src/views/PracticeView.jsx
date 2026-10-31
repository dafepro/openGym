import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import Icon from '../components/Icon.jsx'
import DrillDemonstration from '../components/DrillDemonstration.jsx'
import PracticeActionDock from '../components/PracticeActionDock.jsx'
import CoachingBrief from '../components/CoachingBrief.jsx'
import Dialog from '../components/Dialog.jsx'
import PlayPauseIcon from '../components/PlayPauseIcon.jsx'
import { Badge, Button, EmptyState, Notice, formatClock, prescriptionLabel, isVideoReview, isSelfPacedPractice } from '../components/ui.jsx'

export default function PracticeView({ assignment, drill, drillIndex = 0, drillCount, sets = [], currentSetIndex = 0, phase = 'ready', practiceSeconds = 0, practicePaused = false, onTogglePracticePause, remainingSeconds = 0, totalSeconds = 0, restPaused = false, primaryLabel, onPrimary, onPauseRest, onResumeRest, onAdjustRest, onStop, onUndo, onFinish, onBack, onReviewUnfinished, actualValue, onActualChange, onMediaError, sample = false, saved = false, complete = false, completedCount = 0, totalCount = 0, saveError, disabled = false }) {
  const reviewOnly = isVideoReview(assignment)
  const selfPaced = isSelfPacedPractice(assignment)
  const freeDrill = drill?.mode === 'practice'
  const demoKey = `${assignment?.id}:${assignment?.revision}:${drill?.id}`
  const demoVideo = useRef(null)
  const [demoFor, setDemoFor] = useState(null)
  const showDemo = demoFor === demoKey
  useEffect(() => { setDemoFor(null); window.scrollTo({ top: 0, behavior: 'instant' }) }, [demoKey])
  if (saved) return <section className="qt-completion qt-view"><span className={`qt-completion-mark${complete ? '' : ' qt-completion-mark--partial'}`}><Icon name={complete ? 'check' : 'flag'} size={40} /></span><p className="qt-eyebrow">{assignment?.title}</p><h1>{saveError ? 'Session needs saving' : reviewOnly ? complete ? 'Videos reviewed' : 'Review saved' : complete ? 'Practice complete' : 'Session saved'}</h1><p>{saveError ? 'Your work is still in memory. Retry saving or export a backup before closing this tab.' : reviewOnly ? 'Your video review is saved. No athletic work was recorded.' : complete ? 'A little more practice, in the books.' : selfPaced ? 'Your practice is saved, including drills left unfinished.' : 'Your work is saved, including the sets left unfinished.'}</p><div className="qt-completion-summary"><strong>{completedCount}<span> / {totalCount}</span></strong><span>{reviewOnly ? completedCount === 1 ? 'video reviewed' : 'videos reviewed' : selfPaced ? completedCount === 1 ? 'drill practiced' : 'drills practiced' : completedCount === 1 ? 'set recorded' : 'sets recorded'}</span></div><p className="qt-fine-print">{saveError ? 'Not saved yet.' : 'Saved on this device.'}</p><Button icon="home" onClick={onBack}>Return to Today</Button></section>
  if (!drill) return <EmptyState title="No active practice" action="Return to Today" onAction={onBack}>Open your assignment to begin a practice.</EmptyState>
  const rest = phase === 'rest'
  const working = phase === 'working'
  const review = phase === 'review'
  const fraction = totalSeconds > 0 ? Math.max(0, Math.min(1, remainingSeconds / totalSeconds)) : 0
  return <div className={`qt-view qt-practice qt-practice--${rest ? 'rest' : phase}${reviewOnly ? ' qt-practice--video-review' : ''}`}>
    <header className="qt-practice-header"><button type="button" className="qt-icon-button" onClick={onBack} aria-label="Return to Today, keeping this practice"><Icon name="back" /></button><span>{assignment?.title || 'Practice'}</span>{onFinish && <button type="button" className="qt-finish-button" onClick={onFinish}><Icon name="flag" size={17} />Finish</button>}</header>
    <article className="qt-drill-card" key={demoKey}>
    <div className="qt-drill-heading"><p className="qt-eyebrow">{reviewOnly ? 'Video' : 'Drill'} {drillIndex + 1} of {drillCount || assignment?.drills?.length || 1}</p><h1>{drill.title}</h1></div>
    <div className="qt-work-target" aria-label="Assigned work">
      <strong>{freeDrill ? 'Self-paced' : drill.mode === 'watch' ? 'Video review' : prescriptionLabel(drill)}</strong>
      {!freeDrill && drill.mode !== 'watch' && drill.restSec != null && <span>{drill.restSec}s rest</span>}
      <Badge tone={rest ? 'rest' : working ? 'active' : 'neutral'}>{rest ? restPaused ? 'Rest paused' : 'Rest' : working ? 'Practicing' : phase === 'complete' ? 'Complete' : 'Ready'}</Badge>
    </div>
    {!freeDrill && drill.mode !== 'watch' && phase !== 'complete' && <p className="qt-foot-target">Set {sets[currentSetIndex]?.setNumber || currentSetIndex + 1} of {drill.sets || 1}{sets[currentSetIndex]?.side && <> · {sets[currentSetIndex].side === 'left' ? 'Left foot' : 'Right foot'}</>}</p>}
    {freeDrill && <div className="qt-practice-stopwatch"><div><span>{working && practicePaused ? 'Timer paused' : 'Time practiced'}</span><strong role="timer" aria-label="Time practiced">{formatClock(Math.floor(practiceSeconds))}</strong></div><button type="button" aria-label={practicePaused ? 'Resume practice timer' : 'Pause practice timer'} disabled={!working || !onTogglePracticePause} onClick={onTogglePracticePause}><PlayPauseIcon playing={working && !practicePaused} /></button></div>}
    <CoachingBrief drill={drill} />
    <button className="qt-demo-trigger" type="button" aria-haspopup="dialog" aria-expanded={showDemo} onClick={() => { flushSync(() => setDemoFor(demoKey)); demoVideo.current?.play()?.catch(() => {}) }}>
      <span className="qt-demo-thumb" aria-hidden="true">{drill.media?.poster ? <img src={drill.media.poster} alt="" /> : <Icon name="ball" size={30} />}<span><Icon name="play" size={18} /></span></span>
      <span>Watch demonstration<small>Opens in a popup</small></span><Icon name="arrow" size={18} />
    </button>
    {showDemo && <Dialog title={drill.title} className="qt-video-dialog" onClose={() => setDemoFor(null)}><DrillDemonstration playerRef={demoVideo} media={drill.media} title={drill.title} autoPlay sample={sample} onPlaybackError={onMediaError} />{working && (drill.mode === 'time' || freeDrill && !practicePaused) && <p className="qt-fine-print">Your practice timer keeps running.</p>}</Dialog>}
    {saveError && <Notice tone="error" title="Progress could not be saved">{saveError}</Notice>}
    <section className={`qt-set-panel${freeDrill || drill.mode === 'watch' ? ' qt-set-panel--simple' : ''}`} aria-label={reviewOnly ? 'Video review' : freeDrill ? 'Current drill' : 'Current set'}>
      {review ? <div className="qt-review"><Icon name="clock" size={28} /><h2>Review elapsed set</h2><p>This timer needs your confirmation after an interruption. Confirm the work you completed before recording this set.</p><p className="qt-set-prescription">Planned: {prescriptionLabel(drill)}</p>{onActualChange && <label className="qt-actual-field">Seconds actually completed<input type="number" min="0" max="86400" inputMode="numeric" value={actualValue ?? ''} onChange={event => onActualChange(event.target.value)} /></label>}</div> : (working && drill.mode === 'time' || rest) ? <div className="qt-timer"><p>{rest ? restPaused ? 'Rest is paused' : 'Time to recover' : 'Keep your focus'}</p><strong role="timer" aria-label={`${rest ? 'Rest' : 'Work'} time remaining`}>{formatClock(remainingSeconds)}</strong><div className="qt-progress-track" aria-hidden="true"><i style={{ transform: `scaleX(${fraction})` }} /></div><p>{rest ? 'The next set starts when you are ready.' : 'Your prescribed time is separate from video playback.'}</p></div> : working && drill.mode === 'reps' && onActualChange ? <label className="qt-actual-field">Repetitions completed<input type="number" min="0" max="9999" inputMode="numeric" value={actualValue ?? ''} onChange={event => onActualChange(event.target.value)} /></label> : phase === 'complete' ? <p className="qt-fine-print">{reviewOnly ? 'All videos reviewed.' : 'All work recorded.'} Finish to save.</p> : null}

      {sets.length > 1 && <details className="qt-set-details"><summary>Set progress · {sets.filter(set => set.status === 'done').length} / {sets.length}</summary><ol className="qt-set-progress" aria-label={reviewOnly ? 'Review progress' : freeDrill ? 'Drill progress' : 'Set progress'}>{sets.map((set, index) => <li key={set.id} className={`qt-set-status qt-set-status--${set.status}${index === currentSetIndex ? ' qt-set-status--current' : ''}`} aria-current={index === currentSetIndex ? 'step' : undefined}><span className="qt-set-marker">{set.status === 'done' ? <Icon name="check" size={16} /> : index + 1}</span><span>{set.label || (set.mode === 'watch' ? 'Video review' : set.mode === 'practice' ? 'Practice this drill' : `Set ${set.setNumber || index + 1}`)}{set.side && <small>{set.side === 'left' ? 'Left foot' : 'Right foot'}</small>}</span><small>{set.status === 'done' ? set.mode === 'watch' ? 'Reviewed' : set.prescriptionMet === false ? 'Ended early' : 'Done' : index === currentSetIndex ? 'Current' : set.status === 'stopped' ? 'Unfinished' : 'Pending'}</small></li>)}</ol></details>}
      {rest && onUndo && <Button variant="text" icon="undo" onClick={onUndo}>Undo last recorded set</Button>}
    </section>
    </article>
    <PracticeActionDock stopLabel={freeDrill ? 'Stop drill' : 'Stop set'} phase={phase} primaryLabel={primaryLabel} onPrimary={onPrimary} disabled={disabled} restPaused={restPaused} onPauseRest={onPauseRest} onResumeRest={onResumeRest} onAdjustRest={onAdjustRest} onStop={onStop} onUndo={onUndo} onReviewUnfinished={onReviewUnfinished} />
  </div>
}
