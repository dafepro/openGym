import Icon from '../components/Icon.jsx'
import { Badge, Button, EmptyState, LoadingState, Notice, PageHeading, prescriptionLabel, countLabel, isVideoReview, isSelfPacedPractice } from '../components/ui.jsx'

export default function TodayView({ assignment, activeSession, onStart, onResume, onOpenDrill, loading = false, error, onRetry, sample = false, kind = 'assigned', onBuild, onShare }) {
  const sameEdition = !!activeSession && activeSession.assignmentId === assignment?.id && activeSession.assignmentRevision === assignment?.revision
  const reviewOnly = isVideoReview(assignment)
  const selfPaced = isSelfPacedPractice(assignment)
  const startAction = <Button icon="play" className="qt-assignment-start" disabled={sameEdition ? !onResume : !onStart} onClick={sameEdition ? onResume : onStart}>{sameEdition ? reviewOnly ? 'Resume review' : 'Resume practice' : reviewOnly ? 'Start review' : 'Start practice'}</Button>
  return <div className="qt-view qt-today">
    <PageHeading eyebrow={reviewOnly ? 'Watch closely. Notice the details.' : selfPaced ? 'A little focus. One drill at a time.' : 'A little focus. One set at a time.'} title={kind === 'shared' ? 'Shared practice' : 'Today'}>{kind === 'shared' ? 'Open the drills, make it your own, or start when you’re ready.' : reviewOnly ? 'Your assigned videos, ready to review.' : 'Your assigned practice, ready when you are.'}</PageHeading>
    {loading ? <LoadingState /> : error ? <Notice title="Assignment could not load" tone="error" action="Try again" onAction={onRetry}>{error}</Notice> : !assignment ? <EmptyState title="No assignment yet">Your trainer’s practice will appear here when it has been added.</EmptyState> : <>
      {activeSession && !sameEdition && <Notice title="A practice is still in progress" action="Resume" onAction={onResume}>Your earlier assignment edition is saved. You can return to it before starting this one.</Notice>}
      <section className="qt-assignment-card">
        {!reviewOnly && <div className="qt-assignment-art" aria-hidden="true"><div className="qt-assignment-pitch"><i /><span /></div><Icon name="ball" size={48} /><span className="qt-art-caption">Focus on the next touch</span></div>}
        <div className="qt-assignment-body"><div className="qt-card-meta"><Badge tone="active">{kind === 'shared' ? 'Shared with you' : 'Current assignment'}</Badge><span>{assignment.dateLabel || assignment.assignedOn || ''}</span></div><h2>{assignment.title}</h2><p className="qt-assignment-description">{assignment.description || (reviewOnly ? 'Watch the demonstrations and mark each one reviewed. This review does not record athletic work.' : 'Work through your drills. Open a demonstration whenever you need a reminder.')}</p>
          <div className="qt-assignment-facts"><span><Icon name="ball" size={18} />{countLabel(assignment.drills.length, reviewOnly ? 'video' : 'drill')}</span><span><Icon name="video" size={18} />{reviewOnly ? 'Video review only' : 'Demonstrations with each drill'}</span></div>
          {startAction}
          <div className="qt-drill-list" aria-label="Drills in this assignment">{assignment.drills.map((drill, index) => <button type="button" className="qt-drill-row" key={drill.id} onClick={() => onOpenDrill?.(drill, index)} disabled={!onOpenDrill}><span className="qt-drill-number">{index + 1}</span><span className="qt-drill-copy"><strong>{drill.title}</strong><small>{prescriptionLabel(drill)}</small></span><Icon name="arrow" size={18} /></button>)}</div>
          {sample && <p className="qt-fine-print">Sample assignment · quantities are examples, not training advice.</p>}
        </div>
      </section>
      {(onBuild || onShare) && <div className="qt-field-grid qt-assignment-options">{onBuild && <Button variant="secondary" icon="plus" onClick={onBuild}>{kind === 'shared' ? 'Make a copy' : 'Build a practice'}</Button>}{onShare && <Button variant="secondary" onClick={onShare}>Share assignment</Button>}</div>}
      <div className="qt-next-note"><Icon name="info" size={18} /><p>{reviewOnly ? 'Starting opens the first video. Marking a video reviewed does not record repetitions, sets, or training time.' : <>Your drills are ready. Choose <strong>{selfPaced ? 'Start drill' : 'Start set'}</strong> when you’re ready; demonstrations are optional.</>}</p></div>
    </>}
  </div>
}
