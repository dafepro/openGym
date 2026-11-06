import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import Icon from '../components/Icon.jsx'
import DrillDemonstration from '../components/DrillDemonstration.jsx'
import PracticeActionDock from '../components/PracticeActionDock.jsx'
import CoachingBrief from '../components/CoachingBrief.jsx'
import Dialog from '../components/Dialog.jsx'
import Reveal from '../components/Reveal.jsx'
import SessionRecap from '../components/SessionRecap.jsx'
import { Badge, Button, EmptyState, Notice, prescriptionLabel, isVideoReview, isSelfPacedPractice } from '../components/ui.jsx'

export default function PracticeView({ assignment, drill, drillIndex = 0, drillCount, completedDrillIds = [], nextDrill, finalRow, onSelectDrill, onReviewDrill, sets = [], currentSetIndex = 0, phase = 'ready', practiceSeconds = 0, practicePaused = false, onTogglePracticePause, remainingSeconds = 0, totalSeconds = 0, restPaused = false, primaryLabel, onPrimary, onPauseRest, onResumeRest, onAdjustRest, onStop, onRecordStopped, onUndo, onFinish, onBack, onReviewUnfinished, actualValue, onActualChange, onMediaError, sample = false, saved = false, finishedSession, onHistory, complete = false, completedCount = 0, totalCount = 0, saveError, disabled = false }) {
  const reviewOnly = isVideoReview(assignment)
  const selfPaced = isSelfPacedPractice(assignment)
  const freeDrill = drill?.mode === 'practice'
  const demoKey = `${assignment?.id}:${assignment?.revision}:${drill?.id}`
  const demoVideo = useRef(null)
  const sequenceRail = useRef(null)
  const count = drillCount || assignment?.drills?.length || 1
  const [demoFor, setDemoFor] = useState(null)
  const [setsOpen, setSetsOpen] = useState(false)
  const showDemo = demoFor === demoKey
  useEffect(() => {
    const rail = sequenceRail.current
    const current = rail?.children[drillIndex]
    if (rail && current && count > 6) rail.scrollLeft = Math.max(0, current.offsetLeft - rail.offsetLeft - (rail.clientWidth - current.clientWidth) / 2)
  }, [drillIndex, count])
  useEffect(() => { setDemoFor(null); setSetsOpen(false); window.scrollTo({ top: 0, behavior: 'instant' }) }, [demoKey])
  const pauseForHelp = () => {
    if (phase === 'working' && drill?.mode === 'time') onStop?.()
    else if (phase === 'working' && freeDrill && !practicePaused) onTogglePracticePause?.()
    else if (phase === 'rest' && !restPaused) onPauseRest?.()
  }
  // A work countdown may finish on the same tick that help opens. If it
  // advances to rest, that new clock must stay paused behind the video too.
  useEffect(() => { if (showDemo) pauseForHelp() }, [showDemo, phase, practicePaused, restPaused])
  const openDemo = () => {
    pauseForHelp()
    flushSync(() => setDemoFor(demoKey))
    demoVideo.current?.play()?.catch(() => {})
  }
  const leaveDrill = () => { pauseForHelp(); onBack?.() }
  if (saved) return <section className="qt-completion qt-completion--recap qt-view"><p className="qt-eyebrow">{assignment?.title}</p><h1>{saveError ? 'Session needs saving' : reviewOnly ? complete ? 'Videos reviewed' : 'Review saved' : complete ? 'Practice complete' : 'Session saved'}</h1><p>{saveError ? 'Your work is still in memory. Retry saving or export a backup before closing this tab.' : reviewOnly ? 'Your video review is saved. No athletic work was recorded.' : complete ? 'A little more practice, in the books.' : selfPaced ? 'Saved, including drills left unfinished.' : 'Saved, including sets left unfinished.'}</p><SessionRecap session={finishedSession} completed={completedCount} total={totalCount} label={reviewOnly ? completedCount === 1 ? 'video reviewed' : 'videos reviewed' : selfPaced ? completedCount === 1 ? 'drill practiced' : 'drills practiced' : completedCount === 1 ? 'set recorded' : 'sets recorded'} /><p className="qt-fine-print">{saveError ? 'Not saved yet.' : 'Saved on this device.'}</p><div className="qt-recap-actions">{onHistory && !saveError && <Button icon="history" onClick={onHistory}>View history</Button>}<Button variant={onHistory && !saveError ? 'text' : 'primary'} icon="home" onClick={onBack}>Back to practice</Button></div></section>
  if (!drill) return <EmptyState title="No active practice" action="Back to practice" onAction={onBack}>Open your assignment to begin a practice.</EmptyState>
  const rest = phase === 'rest'
  const working = phase === 'working'
  const review = phase === 'review'
  const paused = working && freeDrill && practicePaused || phase === 'ready' && sets[currentSetIndex]?.status === 'stopped'
  return <div className={`qt-view qt-practice qt-practice--${rest ? 'rest' : phase}${reviewOnly ? ' qt-practice--video-review' : ''}`}>
    <header className="qt-practice-header">
      <button type="button" className="qt-practice-back" onClick={leaveDrill} aria-label="Back to practice, keeping your progress">
        <Icon name="back" />
        <span title={assignment?.title || 'Practice'}>{assignment?.title || 'Practice'}</span>
      </button>
    </header>
    <article className="qt-drill-card">
    <ol ref={sequenceRail} className="pb-drill-index" data-long={count > 6 || undefined} aria-label={`Drills in this practice. Current drill ${drillIndex + 1} of ${count}.`}>
      {Array.from({ length: count }, (_, index) => {
        const item = assignment?.drills[index]
        const current = index === drillIndex
        const done = completedDrillIds.includes(item?.id)
        const label = `Drill ${index + 1}${item ? `: ${item.title}` : ''}`
        return <li key={item?.id || index} data-current={current && !done} data-done={done} aria-current={current ? 'step' : undefined}>
          <button type="button" aria-label={done ? `${label} (completed, review)` : label} title={item?.title}
            aria-disabled={current && !done || undefined} disabled={done ? !onReviewDrill : !onSelectDrill}
            onClick={() => {
              if (done) { pauseForHelp(); onReviewDrill?.(item, index) }
              else if (!current) onSelectDrill?.(item.id)
            }}>
            <span>{String(index + 1).padStart(2, '0')}</span>{done && <Icon name="check" size={12}/>}
          </button>
        </li>
      })}
    </ol>
    <div className="pb-drill-topline"><div className="qt-drill-heading"><p className="qt-eyebrow">{rest ? 'Up next · ' : ''}{reviewOnly ? 'Video' : 'Drill'} {String(drillIndex + 1).padStart(2, '0')}</p><h1>{drill.title}</h1></div>
      {drill.media?.status === 'approved' && <button className="pb-demo-compact" type="button" aria-label="Watch demonstration" aria-haspopup="dialog" aria-expanded={showDemo} onClick={openDemo}><span className="qt-demo-thumb" aria-hidden="true"><video src={`${drill.media.path}#t=0.1`} muted playsInline preload="metadata" tabIndex="-1" aria-hidden="true" /><span><Icon name="play" size={16}/></span></span><span>Watch demo</span></button>}
    </div>
    <div className="qt-work-target" aria-label="Practice targets">
      <strong>{freeDrill ? 'Self-paced' : drill.mode === 'watch' ? 'Video review' : prescriptionLabel(drill)}</strong>
      {!freeDrill && drill.mode !== 'watch' && drill.restSec != null && <span>{drill.restSec}s rest</span>}
      {sets[currentSetIndex]?.side && <span className="qt-current-foot">{sets[currentSetIndex].side === 'left' ? 'Left foot' : 'Right foot'}</span>}
      <Badge tone={rest ? 'rest' : working ? 'active' : 'neutral'}>{rest ? restPaused ? 'Rest paused' : 'Rest' : paused ? 'Paused' : working ? 'Practicing' : review ? 'Check time' : phase === 'complete' ? 'Complete' : 'Ready'}</Badge>
    </div>
    {assignment?.note && <p className="pb-practice-focus" aria-label="Practice focus"><Icon name="star" size={15}/><span>{assignment.note}</span></p>}
    <CoachingBrief drill={drill} />
    {drill.media?.status !== 'approved' && <p className="qt-instructions-only">Written instructions · no demonstration video</p>}
    {showDemo && <Dialog title={drill.title} className="qt-video-dialog pb-demo-dialog" onClose={() => setDemoFor(null)}><DrillDemonstration playerRef={demoVideo} media={drill.media} title={drill.title} autoPlay sample={sample} onPlaybackError={onMediaError}/>{(freeDrill || drill.mode === 'time' || rest) && <p className="pb-demo-paused-note">Work is paused. Close this video, then tap Resume when ready.</p>}</Dialog>}
    {saveError && <Notice tone="error" title="Progress could not be saved">{saveError}</Notice>}
    <section className={`qt-set-panel${freeDrill || drill.mode === 'watch' ? ' qt-set-panel--simple' : ''}`} aria-label={reviewOnly ? 'Video review' : freeDrill ? 'Current drill' : 'Current set'}>
      {review && <div className="qt-review"><h2>Confirm your time</h2><p>The timer was interrupted. Check the seconds you completed in the controls below before recording this set.</p></div>}
      {sets.length > 1 && <div className="qt-set-details"><button type="button" className="qt-set-disclosure" aria-expanded={sets.length <= 6 || setsOpen} aria-controls="current-set-details" onClick={() => { if (sets.length > 6) setSetsOpen(value => !value) }} disabled={sets.length <= 6}><span>Set progress · {sets.filter(set => set.status === 'done').length} / {sets.length}</span><Icon name="arrow" size={15} /></button><Reveal open={sets.length <= 6 || setsOpen} id="current-set-details"><ol className="qt-set-progress" aria-label={reviewOnly ? 'Review progress' : freeDrill ? 'Drill progress' : 'Set progress'}>{sets.map((set, index) => <li key={set.id} className={`qt-set-status qt-set-status--${set.status}${index === currentSetIndex ? ' qt-set-status--current' : ''}`} aria-current={index === currentSetIndex ? 'step' : undefined}><span className="qt-set-marker">{set.status === 'done' ? <Icon name="check" size={16} /> : index + 1}</span><span>{set.label || (set.mode === 'watch' ? 'Video review' : set.mode === 'practice' ? 'Practice this drill' : `Set ${set.setNumber || index + 1}`)}{set.side && <small>{set.side === 'left' ? 'Left foot' : 'Right foot'}</small>}</span><small>{set.status === 'done' ? set.mode === 'watch' ? 'Reviewed' : set.prescriptionMet === false ? 'Ended early' : 'Done' : index === currentSetIndex ? 'Current' : set.status === 'stopped' ? 'Unfinished' : 'Pending'}</small></li>)}</ol></Reveal></div>}
    </section>
    {nextDrill && nextDrill.id !== drill.id && <p className="pb-up-next">Up next: <strong>{nextDrill.title}</strong></p>}
    </article>
    <PracticeActionDock drill={drill} drillIndex={drillIndex} drillCount={count} finalRow={finalRow} sets={sets} currentSetIndex={currentSetIndex} phase={phase} primaryLabel={primaryLabel} onPrimary={onPrimary} disabled={disabled} practiceSeconds={practiceSeconds} practicePaused={practicePaused} onTogglePracticePause={onTogglePracticePause} remainingSeconds={remainingSeconds} totalSeconds={totalSeconds} restPaused={restPaused} onPauseRest={onPauseRest} onResumeRest={onResumeRest} onAdjustRest={onAdjustRest} onStop={onStop} onRecordStopped={onRecordStopped} onUndo={onUndo} onQuit={onFinish} onReviewUnfinished={onReviewUnfinished} actualValue={actualValue} onActualChange={onActualChange} />
  </div>
}
