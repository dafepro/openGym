import Icon from '../components/Icon.jsx'
import { Badge, Button, EmptyState, LoadingState, Notice, prescriptionLabel, countLabel, isVideoReview } from '../components/ui.jsx'

export default function TodayView({ assignment, activeSession, onStart, onResume, onOpenDrill, loading = false, error, onRetry, sample = false, kind = 'assigned', onBuild, onShare }) {
  const sameEdition = !!activeSession && activeSession.assignmentId === assignment?.id && activeSession.assignmentRevision === assignment?.revision
  const reviewOnly = isVideoReview(assignment)
  const startAction = <Button icon="play" className="qt-assignment-start" disabled={sameEdition ? !onResume : !onStart} onClick={sameEdition ? onResume : onStart}>{sameEdition ? reviewOnly ? 'Resume review' : 'Resume practice' : reviewOnly ? 'Start review' : 'Start practice'}</Button>
  return <div className="qt-view qt-today">
    {loading ? <LoadingState /> : error ? <Notice title="Assignment could not load" tone="error" action="Try again" onAction={onRetry}>{error}</Notice> : !assignment ? <EmptyState title="No assignment yet">Your trainer’s practice will appear here when it has been added.</EmptyState> : <>
      {activeSession && !sameEdition && <Notice title="A practice is still in progress" action="Resume" onAction={onResume}>Your earlier assignment edition is saved. You can return to it before starting this one.</Notice>}
      <section className="qt-assignment-card">
        <div className="qt-assignment-body">
          <div className="qt-card-meta"><Badge tone="active">{kind === 'shared' ? 'Shared practice' : 'Today'}</Badge><span>{countLabel(assignment.drills.length, reviewOnly ? 'video' : 'drill')}</span></div>
          <h1>{assignment.title}</h1>
          {startAction}
          <div className="qt-drill-list" aria-label="Drills in this assignment">{assignment.drills.map((drill, index) => <button type="button" className="qt-drill-row" key={drill.id} onClick={() => onOpenDrill?.(drill, index)} disabled={!onOpenDrill}><span className="qt-drill-number">{index + 1}</span><span className="qt-drill-copy"><strong>{drill.title}</strong><small>{prescriptionLabel(drill)}</small></span><Icon name="arrow" size={18} /></button>)}</div>
          {assignment.description && <details className="qt-practice-notes"><summary>Practice notes</summary><p>{assignment.description}</p></details>}
          {reviewOnly && <p className="qt-fine-print">Video review does not record athletic work.</p>}
          {sample && <p className="qt-fine-print">Sample assignment · quantities are examples, not training advice.</p>}
        </div>
      </section>
      {(onBuild || onShare) && <div className="qt-field-grid qt-assignment-options">{onBuild && <Button variant="secondary" icon="plus" onClick={onBuild}>{kind === 'shared' ? 'Make a copy' : 'Build a practice'}</Button>}{onShare && <Button variant="secondary" onClick={onShare}>Share assignment</Button>}</div>}
    </>}
  </div>
}
