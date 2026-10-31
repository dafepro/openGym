import { useEffect, useMemo, useRef, useState } from 'react'
import { APP_CONFIG } from '../config.js'
import { ROUTES, useSharedPracticeToken } from '../lib/routes.js'
import { selectCurrentAssignment } from '../domain/index.js'
import { parseProgressExport } from '../storage/index.js'
import useTrainingController from '../controllers/useTrainingController.js'
import TrainingShell from '../components/TrainingShell.jsx'
import Dialog from '../components/Dialog.jsx'
import DrillDemonstration from '../components/DrillDemonstration.jsx'
import DrillMetadata from './DrillMetadata.jsx'
import { Badge, Button, EmptyState, LoadingState, Notice, prescriptionLabel, isVideoReview, isSelfPacedPractice } from '../components/ui.jsx'
import BuildPracticeView from '../views/BuildPracticeView.jsx'
import { createPractice, decodePractice, drillLibrary, practiceLink, readSavedPractices, savePractice } from '../domain/practice-builder.js'
import TodayView from '../views/TodayView.jsx'
import PracticeView from '../views/PracticeView.jsx'
import HistoryView from '../views/HistoryView.jsx'
import { AssignmentDetail, SessionDetail } from '../views/HistoryDetails.jsx'

export default function TrainingExperience(props) {
  return props.controller ? <TrainingExperienceView {...props} /> : <ManagedTrainingExperience {...props} />
}

function ManagedTrainingExperience(props) {
  const controller = useTrainingController({ databaseName: props.databaseName || 'quicktrack-training', suspended: props.suspended })
  return <TrainingExperienceView {...props} controller={controller} />
}

function TrainingExperienceView({ route, catalog, sample = false, localPreview = false, suspended = false, accessPanel, onMediaError, onRenewAccess, onLogout, accessNotice, accessPending = false, controller, databaseName = APP_CONFIG.storageDatabase }) {
  const currentAssignment = selectCurrentAssignment(catalog)
  const isCurrent = assignment => assignment.id === currentAssignment.id && assignment.revision === currentAssignment.revision
  const { active, view, progress, ready, error, readOnly, saving, saveFailed } = controller
  const [dialog, setDialog] = useState(null)
  const [finished, setFinished] = useState(null)
  const [actual, setActual] = useState('')
  const [message, setMessage] = useState('')
  const [gallery, setGallery] = useState('loading')
  const importInput = useRef(null)
  const [draft, setDraft] = useState({ id: null, title: '', drills: [] })
  const [savedLibrary, setSavedLibrary] = useState({ practices: [], source: null, error: null, ready: false })
  const [shareMessage, setShareMessage] = useState('')
  const libraryKey = `${databaseName}:saved-practices-v1`
  const sharedToken = useSharedPracticeToken()
  const shared = useMemo(() => {
    if (sharedToken === null) return null
    try { return { assignment: decodePractice(sharedToken, catalog) } }
    catch (failure) { return { error: failure.message } }
  }, [sharedToken, catalog])
  const library = useMemo(() => drillLibrary(catalog), [catalog])
  useEffect(() => {
    try {
      const source = window.localStorage.getItem(libraryKey)
      setSavedLibrary({ source, practices: readSavedPractices(source), error: null, ready: true })
    } catch (failure) { setSavedLibrary({ source: null, practices: [], error: failure.message, ready: true }) }
  }, [libraryKey])
  const assignmentFromDraft = () => createPractice(draft.title, draft.drills, { id: draft.id || `practice-${crypto.randomUUID()}`, revision: `edition-${crypto.randomUUID()}` })
  const share = assignment => {
    try { setShareMessage(''); setDialog({ type: 'share', link: practiceLink(assignment, window.location.origin) }) }
    catch (failure) { setMessage(failure.message) }
  }
  const useDraft = action => {
    try { action(assignmentFromDraft()) } catch (failure) { setMessage(failure.message); window.scrollTo({ top: 0, behavior: 'instant' }) }
  }
  const persistPractice = assignment => {
    if (!savedLibrary.ready || savedLibrary.error) { setMessage(savedLibrary.error || 'Saved practices are still loading.'); return }
    try {
      const saved = savePractice(window.localStorage, libraryKey, savedLibrary.source, assignment)
      setSavedLibrary({ ...saved, error: null, ready: true }); setDraft({ id: assignment.id, title: assignment.title, drills: assignment.drills })
      setMessage('Practice saved on this device.')
    } catch (failure) { setMessage(failure.message) }
  }
  const loadPractice = assignment => { setDraft({ id: assignment.id, title: assignment.title, drills: structuredClone(assignment.drills) }); navigate('build'); window.scrollTo({ top: 0, behavior: 'instant' }); document.getElementById('training-main')?.focus({ preventScroll: true }) }
  const copyShared = () => { setDraft({ id: null, title: shared.assignment.title, drills: structuredClone(shared.assignment.drills) }); navigate('build') }
  const previewDrill = (drill, index) => setDialog({ type: 'drill', drill, index, standalone: true })

  useEffect(() => { setDialog(null) }, [route, sharedToken])
  const navigate = page => { setDialog(null); window.location.hash = ROUTES[page] }
  useEffect(() => { document.getElementById('training-main')?.focus({ preventScroll: true }); window.scrollTo(0, 0) }, [route, finished?.id])
  useEffect(() => {
    if (!view?.currentRow) return
    const offered = view.phase === 'review' ? Math.max(view.currentRow.actual || 0, Math.min(view.currentRow.target, Math.floor(view.elapsedSec))) : view.currentRow.target
    setActual(offered ?? '')
  }, [view?.currentRow?.id, view?.phase])

  const begin = async assignment => {
    if (readOnly) return
    if (active) { setDialog({ type: 'existing' }); return }
    const next = await controller.start(assignment)
    if (next?.activeSession) { setFinished(null); navigate('practice') }
  }
  const owner = active ? { sessionId: active.id, rowId: active.currentRowId } : null
  const send = (type, fields) => controller.command(type, fields, owner)
  const finish = async () => {
    if (!active) return
    const sessionId = active.id
    const next = await controller.command('FINISH', {}, { sessionId })
    const result = next?.sessions.find(session => session.id === sessionId)
    if (result) { setFinished(result); setDialog(null); navigate('practice') }
  }
  const primary = () => {
    if (!view) return
    if (view.primaryAction.type === 'FINISH') { void finish(); return }
    const fields = view.phase === 'review' || view.phase === 'working' && view.currentRow?.mode === 'reps' ? { actual: Number(actual) } : {}
    void send(view.primaryAction.type, fields)
  }
  const download = () => {
    try {
      const url = URL.createObjectURL(new Blob([controller.exportData()], { type: 'application/json' }))
      const link = document.createElement('a'); link.href = url; link.download = `quicktrack-${sample ? 'sample-' : ''}progress-${new Date().toISOString().slice(0, 10)}.json`; link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage('Backup exported. It includes session records, not video files.')
    } catch (failure) { setMessage(failure.message) }
  }
  const readImport = async event => {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('This backup is too large. The limit is 10 MiB.')
      setDialog({ type: 'restore', data: parseProgressExport(await file.text()) })
    } catch (failure) { setMessage(failure.message) }
  }
  const restore = async () => {
    const next = await controller.restore(dialog.data)
    if (next) { setDialog(null); setMessage('Backup merged. Existing history has been preserved.'); setFinished(null) }
  }
  const shown = finished || active
  const reviewOnly = isVideoReview(shown?.assignment || currentAssignment)
  const selfPaced = isSelfPacedPractice(shown?.assignment || currentAssignment)
  const drill = view?.drill || active?.assignment.drills.at(-1)
  const drillRows = active?.rows.filter(row => row.drillId === drill?.id) || []
  const currentSetIndex = Math.max(0, drillRows.findIndex(row => row.id === active?.currentRowId))
  const disabledActual = (view?.phase === 'review' || view?.phase === 'working' && view?.currentRow?.mode === 'reps') && (actual === '' || !Number.isFinite(Number(actual)) || Number(actual) < 0 || view?.currentRow?.mode === 'reps' && !Number.isInteger(Number(actual)))
  const phaseAnnouncement = view ? `${view.drill?.title || 'Practice'}: ${view.phase === 'review' ? 'Review elapsed set. Confirm completed work.' : view.phase === 'rest' ? active.timer?.paused ? 'Rest paused.' : 'Rest started.' : view.phase === 'ready' ? reviewOnly ? 'Ready to review this video.' : selfPaced ? 'Ready. Start the next drill when you are ready.' : 'Ready. Start the next set when you are ready.' : view.phase === 'complete' ? reviewOnly ? 'All videos reviewed. Save your review.' : selfPaced ? 'All drills practiced. Finish to save the session.' : 'All sets recorded. Finish to save the session.' : selfPaced ? 'Drill started.' : 'Set started.'}` : ''

  if (suspended) return accessPanel
  return <div><TrainingShell page={route} practice={route === 'practice'} builder sample={sample} localPreview={localPreview} sourceUrl={APP_CONFIG.sourceUrl} onNavigate={navigate}>
    <span className="qt-live-status" role="status" aria-live="polite">{phaseAnnouncement}</span>
    {accessNotice && <Notice title="Family access" tone="warning">{accessNotice}</Notice>}
    {error && <Notice title={readOnly ? 'Practice is read only' : saveFailed ? 'Progress is not saved' : 'Practice needs attention'} tone="error" action={readOnly ? 'Reload' : saveFailed ? 'Retry save' : undefined} onAction={readOnly ? () => window.location.reload() : controller.retrySave}>{error}{saveFailed ? ' Your work is still in memory. Retry or export a backup before closing this tab.' : ''}</Notice>}
    {message && <Notice title="Training">{message}</Notice>}
    {!ready ? <LoadingState label={sample ? 'Opening local sample progress' : 'Opening local progress'} /> : <>
      {(readOnly || saveFailed) && <p className="qt-save-status">{readOnly ? 'Read-only view · no changes will be recorded' : saveFailed ? 'Not saved · export a backup or retry' : saving ? 'Saving on this device…' : sample ? 'Sample progress saved on this device' : 'Progress saved on this device'}</p>}
      {route === 'today' && <><TodayView assignment={currentAssignment} activeSession={active} sample={sample} onStart={readOnly ? undefined : () => begin(currentAssignment)} onResume={() => { setFinished(null); navigate('practice') }} onBuild={() => navigate('build')} onShare={() => share(currentAssignment)} onOpenDrill={(selected, index) => setDialog({ type: 'drill', drill: selected, index })} />
        {sample && <details className="qt-state-gallery"><summary>Sample interface states</summary><p className="qt-fine-print">Visual examples only. These controls do not change your practice.</p><div className="qt-state-gallery-buttons">{['loading', 'empty', 'offline', 'save error'].map(state => <button type="button" key={state} aria-pressed={gallery === state} onClick={() => setGallery(state)}>{state}</button>)}</div><div className="qt-state-gallery-content">{gallery === 'loading' ? <LoadingState /> : gallery === 'empty' ? <EmptyState title="No assignment yet">Trainer content will appear when published.</EmptyState> : <Notice title={gallery === 'offline' ? 'Offline example' : 'Save error example'} tone={gallery === 'offline' ? 'warning' : 'error'}>{gallery === 'offline' ? 'The instructions may be available while the video still needs a connection.' : 'Work remains in memory until it can be saved or exported.'}</Notice>}</div></details>}
      </>}
      {route === 'build' && savedLibrary.error && <Notice title="Saved practices unavailable" tone="error">{savedLibrary.error}</Notice>}
      {route === 'build' && <BuildPracticeView draft={draft} onChange={setDraft} library={library} saved={savedLibrary.practices} history={progress.sessions} activeSession={active} onSave={() => useDraft(persistPractice)} onStart={() => useDraft(begin)} onShare={() => useDraft(share)} onLoad={assignment => draft.drills.length ? setDialog({ type: 'load-practice', assignment }) : loadPractice(assignment)} onNew={() => setDialog({ type: 'new-practice' })} onPreview={previewDrill} disabled={readOnly} />}
      {route === 'shared' && (shared?.assignment ? <TodayView assignment={shared.assignment} kind="shared" activeSession={active} onStart={readOnly ? undefined : () => begin(shared.assignment)} onResume={() => navigate('practice')} onBuild={copyShared} onOpenDrill={previewDrill} /> : <Notice title="Practice link unavailable" tone="error" action="Build a practice" onAction={() => navigate('build')}>{shared?.error || 'Ask for the complete practice link.'}</Notice>)}
      {route === 'history' && <><HistoryView assignments={catalog.assignments} currentAssignmentId={catalog.currentAssignmentId} currentAssignmentRevision={catalog.currentAssignmentRevision} sessions={[...(active ? [active] : []), ...progress.sessions.slice().reverse()]} onOpenAssignment={assignment => setDialog({ type: 'assignment', assignment })} onOpenSession={session => setDialog({ type: 'session', session })} onResume={() => { setFinished(null); navigate('practice') }} onExport={download} /><Button variant="text" onClick={() => importInput.current?.click()} disabled={readOnly}>Restore a backup</Button></>}
      {route === 'practice' && <PracticeView assignment={shown?.assignment} drill={drill} drillIndex={active ? Math.max(0, active.assignment.drills.findIndex(item => item.id === drill?.id)) : 0} drillCount={active?.assignment.drills.length} sets={drillRows} currentSetIndex={currentSetIndex} phase={view?.phase} practiceSeconds={view?.practiceSeconds || 0} practicePaused={view?.practicePaused} onTogglePracticePause={readOnly ? undefined : () => send(view?.practicePaused ? 'RESUME_PRACTICE' : 'PAUSE_PRACTICE')} remainingSeconds={view?.remainingSec || 0} totalSeconds={active?.timer?.target || active?.assignment.drills.find(item => item.id === active.rows.find(row => row.id === active.timer?.ownerRowId)?.drillId)?.restSec || 0} restPaused={!!active?.timer?.paused} primaryLabel={reviewOnly && view?.phase === 'complete' ? 'Save review' : view?.primaryAction.label} onPrimary={readOnly ? undefined : primary} onPauseRest={readOnly ? undefined : () => send('PAUSE_REST')} onResumeRest={readOnly ? undefined : () => send('RESUME_REST')} onAdjustRest={readOnly ? undefined : deltaSec => send('ADJUST_REST', { deltaSec })} onStop={!readOnly && view?.phase === 'working' ? () => send('STOP') : undefined} onUndo={!readOnly && view?.canUndo ? () => send('UNDO') : undefined} onFinish={!readOnly && active ? () => setDialog({ type: 'finish' }) : undefined} onBack={() => { setFinished(null); navigate('today') }} onReviewUnfinished={readOnly ? undefined : () => send('STOP')} actualValue={actual} onActualChange={readOnly ? undefined : setActual} onMediaError={onMediaError} sample={sample} saved={!!finished} complete={finished?.status === 'completed'} completedCount={finished?.rows.filter(row => row.status === 'done').length || 0} totalCount={finished?.rows.length || 0} saveError={saveFailed ? error : undefined} disabled={readOnly || disabledActual} />}
    </>}
    {saveFailed && <Button variant="secondary" icon="download" onClick={download}>Export in-memory progress</Button>}
    {(onRenewAccess || onLogout) && <div className="qt-access-actions">{onRenewAccess && <Button variant="text" disabled={accessPending} onClick={onRenewAccess}>Renew family access</Button>}{onLogout && <Button variant="text" disabled={accessPending} onClick={onLogout}>Sign out</Button>}</div>}
    <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={readImport} />
  </TrainingShell>
    {dialog && <Dialog title={dialog.type === 'new-practice' ? 'Start a new practice?' : dialog.type === 'share' ? 'Share this practice' : dialog.type === 'load-practice' ? 'Open saved practice?' : dialog.type === 'assignment' ? dialog.assignment.title : dialog.type === 'session' ? dialog.session.assignment.title : dialog.type === 'drill' ? dialog.drill.title : dialog.type === 'finish' ? 'Finish this session?' : dialog.type === 'restore' ? 'Restore progress?' : 'A practice is already open'} onClose={() => setDialog(null)} actions={dialog.type === 'new-practice' ? <Button onClick={() => { setDraft({ id: null, title: '', drills: [] }); setDialog(null); setMessage(''); window.scrollTo({ top: 0, behavior: 'instant' }) }}>New practice</Button> : dialog.type === 'load-practice' ? <Button onClick={() => loadPractice(dialog.assignment)}>Open saved practice</Button> : dialog.type === 'share' ? <Button onClick={async () => { try { await navigator.clipboard.writeText(dialog.link); setShareMessage('Link copied.') } catch { setShareMessage('Select and copy the link below.') } }}>Copy link</Button> : dialog.type === 'finish' ? <><Button icon="flag" onClick={finish}>{reviewOnly ? 'Save review' : 'Finish and save session'}</Button><Button variant="secondary" onClick={() => setDialog(null)}>{reviewOnly ? 'Keep reviewing' : 'Keep practicing'}</Button></> : dialog.type === 'assignment' ? <Button icon="play" disabled={readOnly} onClick={() => begin(dialog.assignment)}>{isVideoReview(dialog.assignment) ? 'Review these videos' : 'Practice this assignment'}</Button> : dialog.type === 'existing' ? <Button icon="play" onClick={() => { setFinished(null); navigate('practice') }}>Resume open practice</Button> : dialog.type === 'restore' ? <><Button disabled={readOnly} onClick={restore}>Merge backup</Button><Button variant="secondary" onClick={() => setDialog(null)}>Cancel</Button></> : undefined}>
      {dialog.type === 'new-practice' && <p>Save your current draft first if you want to keep it. Your saved practices and history will stay available.</p>}
      {dialog.type === 'share' && <><p>Anyone with this link can open the practice and its videos. It contains the drills and targets; your progress stays on your device.</p><label className="qt-field qt-share-link">Practice link<input readOnly value={dialog.link} onFocus={event => event.target.select()} /></label><p role="status">{shareMessage}</p></>}
      {dialog.type === 'load-practice' && <p>This opens “{dialog.assignment.title}” in the builder. Save your current draft first if you want to keep it.</p>}
      {dialog.type === 'assignment' && <AssignmentDetail assignment={dialog.assignment} current={isCurrent(dialog.assignment)} />}
      {dialog.type === 'session' && <SessionDetail session={dialog.session} />}
      {dialog.type === 'drill' && <><Badge>{dialog.standalone ? 'Drill details' : `Drill ${dialog.index + 1} of ${currentAssignment.drills.length}`}</Badge><p>{prescriptionLabel(dialog.drill)}</p><DrillDemonstration media={dialog.drill.media} title={dialog.drill.title} sample={sample} onPlaybackError={onMediaError} /><p>{dialog.drill.instructions}</p><DrillMetadata metadata={dialog.drill.metadata} /></>}
      {dialog.type === 'finish' && (reviewOnly ? <><p>{view?.progress.done || 0} of {view?.progress.total || 0} videos reviewed. No athletic work is recorded by this review.</p><p>Unreviewed videos will stay unreviewed in the saved record.</p></> : <><p>{view?.progress.done || 0} of {view?.progress.total || 0} {selfPaced ? 'drills practiced.' : `sets recorded. ${view?.progress.met || 0} met their prescription.`}</p><p>{view?.prescriptionMet ? selfPaced ? 'All drills are complete.' : 'All prescribed work is complete.' : 'Unfinished or early-ended work will be saved as a partial session.'}{!selfPaced && ' Opening this dialog has not stopped your timer.'}</p></>)}
      {dialog.type === 'existing' && <p>Resume or finish the existing practice before starting a new one. Its assignment snapshot and progress are preserved.</p>}
      {dialog.type === 'restore' && <><p>The backup contains {dialog.data.sessions.length} saved sessions{dialog.data.activeSession ? ' and an active practice' : ''}. Existing history will be preserved. Conflicting work is refused.</p><Button variant="text" icon="download" onClick={download}>Export current progress first</Button></>}
    </Dialog>}
  </div>
}
