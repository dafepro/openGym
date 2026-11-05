import Icon from '../components/Icon.jsx'
import PracticeSequence from '../components/PracticeSequence.jsx'
import { Badge, Button, EmptyState, LoadingState, Notice, countLabel, isVideoReview } from '../components/ui.jsx'

export default function TodayView({ assignment, activeSession, onStart, onResume, onOpenDrill, onWatchDrill, loading = false, error, onRetry, sample = false, kind = 'assigned', onBuild, onShare, onRandom, onOwnDrill, disabled = false, preview = false }) {
  const sameEdition = !!activeSession && activeSession.assignmentId === assignment?.id && activeSession.assignmentRevision === assignment?.revision
  const reviewOnly = isVideoReview(assignment)
  const label = sameEdition ? reviewOnly ? 'Resume review' : 'Resume practice' : reviewOnly ? 'Start review' : 'Start practice'
  return <div className="qt-view qt-today pb-today">
    {loading ? <LoadingState /> : error ? <Notice title="Assignment could not load" tone="error" action="Try again" onAction={onRetry}>{error}</Notice> : !assignment ? <EmptyState title="No assigned practice yet">Choose your own practice to get moving.</EmptyState> : <>
      {activeSession && !sameEdition && !preview && <Notice title="A practice is still in progress" action="Resume" onAction={onResume}>{activeSession.assignment?.title || 'Your current practice'}</Notice>}
      <section className="qt-assignment-card pb-practice-sheet" aria-label="Complete practice">
        <div className="qt-assignment-body">
          <div className="qt-card-meta"><Badge tone="active">{preview ? 'Player preview' : kind === 'shared' ? 'Shared practice' : kind === 'personal' ? 'Your practice' : 'Assigned practice'}</Badge></div>
          <h1>{assignment.title}</h1>
          <p className="pb-practice-caption">{countLabel(assignment.drills.length, reviewOnly ? 'video' : 'drill')}<span aria-hidden="true"> · </span>{reviewOnly ? 'Reference session' : 'One complete practice'}</p>
          <Button icon="forward" className="qt-assignment-start pb-practice-start" disabled={preview || disabled || (sameEdition ? !onResume : !onStart)} onClick={sameEdition ? onResume : onStart}>{preview ? 'Start practice' : label}</Button>
          {assignment.note && <p className="pb-practice-note"><Icon name="pencil" size={15}/><span>{assignment.note}</span></p>}
          <PracticeSequence drills={assignment.drills} onOpenDrill={onOpenDrill} onWatchDrill={onWatchDrill}/>
          {reviewOnly && <p className="qt-fine-print">Video review does not record athletic work.</p>}
          {sample && <p className="qt-fine-print">Sample assignment · quantities are examples, not training advice.</p>}
        </div>
      </section>
      {onBuild && <Button variant="text" className="pb-choose-practice" icon="arrow" onClick={onBuild}>{kind === 'shared' ? 'Make a copy' : 'Choose my own practice'}</Button>}
      {onShare && <Button variant="text" onClick={onShare}>Share assignment</Button>}
    </>}
    {(onRandom || onOwnDrill) && <section className="pb-quick-start" aria-label="Practice your way"><div className="pb-section-heading"><h2>Practice your way</h2><span>No plan needed</span></div><div className="pb-quick-actions">
      {onRandom && <button type="button" onClick={onRandom} disabled={disabled}><Icon name="shuffle" size={22}/><span><strong>Surprise me</strong><small>A mix that fits your setup</small></span><Icon name="arrow" size={16}/></button>}
      {onOwnDrill && <button type="button" onClick={onOwnDrill} disabled={disabled}><Icon name="pencil" size={22}/><span><strong>My own drill</strong><small>Create it. Track your work.</small></span><Icon name="arrow" size={16}/></button>}
    </div></section>}
  </div>
}
