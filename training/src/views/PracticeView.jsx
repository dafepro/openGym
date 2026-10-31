import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import Icon from '../components/Icon.jsx'
import DrillDemonstration from '../components/DrillDemonstration.jsx'
import PracticeActionDock from '../components/PracticeActionDock.jsx'
import CoachingBrief from '../components/CoachingBrief.jsx'
import Dialog from '../components/Dialog.jsx'
import { Badge, Button, EmptyState, Notice, prescriptionLabel, isVideoReview, isSelfPacedPractice } from '../components/ui.jsx'

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
  return <div className={`qt-view qt-practice qt-practice--${rest ? 'rest' : phase}${reviewOnly ? ' qt-practice--video-review' : ''}`}>
    <header className="qt-practice-header"><button type="button" className="qt-icon-button" onClick={onBack} aria-label="Return to Today, keeping this practice"><Icon name="back" /></button><span>{assignment?.title || 'Practice'}</span></header>
    <article className="qt-drill-card">
    <div className="qt-drill-heading"><p className="qt-eyebrow">{reviewOnly ? 'Video' : 'Drill'} {drillIndex + 1} of {drillCount || assignment?.drills?.length || 1}</p><h1>{drill.title}</h1></div>
    <div className="qt-work-target" aria-label="Practice targets">
      <strong>{freeDrill ? 'Self-paced' : drill.mode === 'watch' ? 'Video review' : prescriptionLabel(drill)}</strong>
      {!freeDrill && drill.mode !== 'watch' && drill.restSec != null && <span>{drill.restSec}s rest</span>}
      <Badge tone={rest ? 'rest' : working ? 'active' : 'neutral'}>{rest ? restPaused ? 'Rest paused' : 'Rest' : working ? 'Practicing' : phase === 'complete' ? 'Complete' : 'Ready'}</Badge>
    </div>
    {!freeDrill && drill.mode !== 'watch' && phase !== 'complete' && <p className="qt-foot-target">Set {sets[currentSetIndex]?.setNumber || currentSetIndex + 1} of {drill.sets || 1}{sets[currentSetIndex]?.side && <> · {sets[currentSetIndex].side === 'left' ? 'Left foot' : 'Right foot'}</>}</p>}
    <CoachingBrief drill={drill} />
    {drill.media?.status === 'approved' ? <button className="qt-demo-trigger" type="button" aria-haspopup="dialog" aria-expanded={showDemo} onClick={() => { flushSync(() => setDemoFor(demoKey)); demoVideo.current?.play()?.catch(() => {}) }}>
      <span className="qt-demo-thumb" aria-hidden="true">{drill.media?.poster ? <img src={drill.media.poster} alt="" /> : <Icon name="ball" size={30} />}<span><Icon name="play" size={18} /></span></span>
      <span>Watch demonstration<small>Opens in a popup</small></span><Icon name="arrow" size={18} />
    </button> : <p className="qt-instructions-only">Written instructions · no demonstration video</p>}
    {showDemo && <Dialog title={drill.title} className="qt-video-dialog" onClose={() => setDemoFor(null)}><DrillDemonstration playerRef={demoVideo} media={drill.media} title={drill.title} autoPlay sample={sample} onPlaybackError={onMediaError} />{working && (drill.mode === 'time' || freeDrill && !practicePaused) && <p className="qt-fine-print">Your practice timer keeps running.</p>}</Dialog>}
    {saveError && <Notice tone="error" title="Progress could not be saved">{saveError}</Notice>}
    <section className={`qt-set-panel${freeDrill || drill.mode === 'watch' ? ' qt-set-panel--simple' : ''}`} aria-label={reviewOnly ? 'Video review' : freeDrill ? 'Current drill' : 'Current set'}>
      {review && <div className="qt-review"><h2>Confirm your time</h2><p>The timer was interrupted. Check the seconds you completed in the controls below before recording this set.</p></div>}
      {sets.length > 1 && <details className="qt-set-details"><summary>Set progress · {sets.filter(set => set.status === 'done').length} / {sets.length}</summary><ol className="qt-set-progress" aria-label={reviewOnly ? 'Review progress' : freeDrill ? 'Drill progress' : 'Set progress'}>{sets.map((set, index) => <li key={set.id} className={`qt-set-status qt-set-status--${set.status}${index === currentSetIndex ? ' qt-set-status--current' : ''}`} aria-current={index === currentSetIndex ? 'step' : undefined}><span className="qt-set-marker">{set.status === 'done' ? <Icon name="check" size={16} /> : index + 1}</span><span>{set.label || (set.mode === 'watch' ? 'Video review' : set.mode === 'practice' ? 'Practice this drill' : `Set ${set.setNumber || index + 1}`)}{set.side && <small>{set.side === 'left' ? 'Left foot' : 'Right foot'}</small>}</span><small>{set.status === 'done' ? set.mode === 'watch' ? 'Reviewed' : set.prescriptionMet === false ? 'Ended early' : 'Done' : index === currentSetIndex ? 'Current' : set.status === 'stopped' ? 'Unfinished' : 'Pending'}</small></li>)}</ol></details>}
    </section>
    </article>
    <PracticeActionDock drill={drill} sets={sets} currentSetIndex={currentSetIndex} phase={phase} primaryLabel={primaryLabel} onPrimary={onPrimary} disabled={disabled} practiceSeconds={practiceSeconds} practicePaused={practicePaused} onTogglePracticePause={onTogglePracticePause} remainingSeconds={remainingSeconds} totalSeconds={totalSeconds} restPaused={restPaused} onPauseRest={onPauseRest} onResumeRest={onResumeRest} onAdjustRest={onAdjustRest} onStop={onStop} onUndo={onUndo} onQuit={onFinish} onReviewUnfinished={onReviewUnfinished} actualValue={actualValue} onActualChange={onActualChange} />
  </div>
}
