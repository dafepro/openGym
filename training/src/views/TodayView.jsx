import Icon from '../components/Icon.jsx'
import { Badge, Button, EmptyState, LoadingState, Notice, PageHeading, prescriptionLabel, countLabel } from '../components/ui.jsx'

export default function TodayView({ assignment, activeSession, onStart, onResume, onOpenDrill, loading = false, error, onRetry, sample = false }) {
  const sameEdition = !!activeSession && activeSession.assignmentId === assignment?.id && activeSession.assignmentRevision === assignment?.revision
  return <div className="qt-view qt-today">
    <PageHeading eyebrow="A little focus. One set at a time." title="Today">Your assigned practice, ready when you are.</PageHeading>
    {loading ? <LoadingState /> : error ? <Notice title="Assignment could not load" tone="error" action="Try again" onAction={onRetry}>{error}</Notice> : !assignment ? <EmptyState title="No assignment yet">Your trainer’s practice will appear here when it has been added.</EmptyState> : <>
      {activeSession && !sameEdition && <Notice title="A practice is still in progress" action="Resume" onAction={onResume}>Your earlier assignment edition is saved. You can return to it before starting this one.</Notice>}
      <section className="qt-assignment-card">
        <div className="qt-assignment-art" aria-hidden="true"><div className="qt-assignment-pitch"><i /><span /></div><Icon name="ball" size={48} /><span className="qt-art-caption">Focus on the next touch</span></div>
        <div className="qt-assignment-body"><div className="qt-card-meta"><Badge tone="active">Current assignment</Badge><span>{assignment.dateLabel || assignment.assignedOn || ''}</span></div><h2>{assignment.title}</h2><p className="qt-assignment-description">{assignment.description || 'Watch each drill, follow the instructions, and work through the sets at your own pace.'}</p>
          <div className="qt-assignment-facts"><span><Icon name="ball" size={18} />{countLabel(assignment.drills.length, 'drill')}</span><span><Icon name="video" size={18} />Demonstrations with each drill</span></div>
          <div className="qt-drill-list" aria-label="Drills in this assignment">{assignment.drills.map((drill, index) => <button type="button" className="qt-drill-row" key={drill.id} onClick={() => onOpenDrill?.(drill, index)} disabled={!onOpenDrill}><span className="qt-drill-number">{index + 1}</span><span className="qt-drill-copy"><strong>{drill.title}</strong><small>{prescriptionLabel(drill)}</small></span><Icon name="arrow" size={18} /></button>)}</div>
          <Button icon="play" className="qt-assignment-start" disabled={sameEdition ? !onResume : !onStart} onClick={sameEdition ? onResume : onStart}>{sameEdition ? 'Resume practice' : 'Start practice'}</Button>
          {sample && <p className="qt-fine-print">Sample assignment · quantities are examples, not training advice.</p>}
        </div>
      </section>
      <div className="qt-next-note"><Icon name="info" size={18} /><p>Starting opens the first drill. Your set begins only when you choose <strong>Start set</strong>.</p></div>
    </>}
  </div>
}
