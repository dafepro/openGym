import { useEffect, useMemo, useRef, useState } from 'react'
import { APP_CONFIG } from '../config.js'
import { transitionView } from '../lib/motion.js'
import { ROUTES, useSharedPracticeToken } from '../lib/routes.js'
import { selectCurrentAssignment } from '../domain/index.js'
import { parseProgressExport } from '../storage/index.js'
import useTrainingController from '../controllers/useTrainingController.js'
import TrainingShell from '../components/TrainingShell.jsx'
import Dialog from '../components/Dialog.jsx'
import Icon from './Icon.jsx'
import DrillPreview from './DrillPreview.jsx'
import { Button, EmptyState, LoadingState, Notice, isVideoReview, isSelfPacedPractice } from '../components/ui.jsx'
import BuildPracticeView from '../views/BuildPracticeView.jsx'
import { createPractice, decodePractice, drillLibrary, practiceLink, readSavedPractices, savePractice } from '../domain/practice-builder.js'
import TodayView from '../views/TodayView.jsx'
import PracticeView from '../views/PracticeView.jsx'
import MeView from '../views/MeView.jsx'
import { standardDrills } from '../domain/standard-workouts.js'
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
  const [finishingSession, setFinishingSession] = useState(null)
  const [actual, setActual] = useState('')
  const [removalPending, setRemovalPending] = useState(false)
  const [removalError, setRemovalError] = useState('')
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
  const library = useMemo(() => [...drillLibrary(catalog), ...standardDrills()], [catalog])
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
    const offered = view.phase === 'review' ? Math.max(view.currentRow.actual || 0, Math.min(view.currentRow.target, Math.floor(view.elapsedSec))) : view.currentRow.mode === 'reps' ? view.currentRow.actual || 0 : view.currentRow.target
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
    setFinishingSession({ session: active, view })
    const next = await controller.command('FINISH', {}, { sessionId })
    const result = next?.sessions.find(session => session.id === sessionId)
    if (result) transitionView(() => { setFinished(result); setFinishingSession(null); setDialog(null); navigate('practice') })
    else setFinishingSession(null)
  }
  const primary = () => {
    if (!view) return
    if (view.primaryAction.type === 'FINISH') { void finish(); return }
    const fields = view.phase === 'review' || view.phase === 'working' && view.currentRow?.mode === 'reps' ? { actual: Number(actual) } : {}
    void send(view.primaryAction.type, fields)
  }
  const removeSession = async (kind, session) => {
    if (!session || readOnly || removalPending) return
    setRemovalPending(true); setRemovalError('')
    try {
      const next = await controller[kind](session.id)
      if (!next) { setRemovalError('The session could not be removed. Check the storage message and try again.'); return }
      transitionView(() => { setDialog(null); setFinished(null); setFinishingSession(null); setMessage(kind === 'discardActive' ? 'Practice discarded without saving.' : 'Session deleted.'); if (kind === 'discardActive') navigate('today') })
    } catch (failure) { setRemovalError(failure.message) }
    finally { setRemovalPending(false) }
  }
  const requestDelete = session => { setRemovalError(''); setDialog({ type: 'delete-session', session }) }
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
  const visualActive = active || finishingSession?.session
  const visualView = view || finishingSession?.view
  const shown = finished || visualActive
  const reviewOnly = isVideoReview(shown?.assignment || currentAssignment)
  const selfPaced = isSelfPacedPractice(shown?.assignment || currentAssignment)
  const drill = visualView?.drill || visualActive?.assignment.drills.at(-1)
  const drillRows = visualActive?.rows.filter(row => row.drillId === drill?.id) || []
  const currentSetIndex = Math.max(0, drillRows.findIndex(row => row.id === visualActive?.currentRowId))
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
      {route === 'build' && <BuildPracticeView draft={draft} onChange={setDraft} library={library} saved={savedLibrary.practices} history={progress.sessions} activeSession={active} onSave={() => useDraft(persistPractice)} onStart={() => useDraft(begin)} onShare={() => useDraft(share)} onLoad={assignment => draft.drills.length ? setDialog({ type: 'load-practice', assignment }) : loadPractice(assignment)} onNew={() => setDialog({ type: 'new-practice' })} onPreview={previewDrill} onStartTemplate={begin} onCustomizeTemplate={assignment => { const copy = { ...assignment, id: null, drills: structuredClone(assignment.drills) }; if (draft.drills.length) setDialog({ type: 'load-practice', assignment: copy }); else loadPractice(copy) }} disabled={readOnly} />}
      {route === 'shared' && (shared?.assignment ? <TodayView assignment={shared.assignment} kind="shared" activeSession={active} onStart={readOnly ? undefined : () => begin(shared.assignment)} onResume={() => navigate('practice')} onBuild={copyShared} onOpenDrill={previewDrill} /> : <Notice title="Practice link unavailable" tone="error" action="Browse practices" onAction={() => navigate('build')}>{shared?.error || 'Ask for the complete practice link.'}</Notice>)}
      {(route === 'me' || route === 'history') && <MeView databaseName={databaseName} assignments={catalog.assignments} sessions={[...(active ? [active] : []), ...progress.sessions.slice().reverse()]} onOpenSession={session => setDialog({ type: 'session', session })} onResume={() => { setFinished(null); navigate('practice') }} onExport={download} onRestore={readOnly ? undefined : () => importInput.current?.click()} />}
      {route === 'practice' && <PracticeView assignment={shown?.assignment} drill={drill} drillIndex={visualActive ? Math.max(0, visualActive.assignment.drills.findIndex(item => item.id === drill?.id)) : 0} drillCount={visualActive?.assignment.drills.length} sets={drillRows} currentSetIndex={currentSetIndex} phase={visualView?.phase} practiceSeconds={visualView?.practiceSeconds || 0} practicePaused={visualView?.practicePaused} onTogglePracticePause={readOnly ? undefined : () => send(view?.practicePaused ? 'RESUME_PRACTICE' : 'PAUSE_PRACTICE')} remainingSeconds={visualView?.remainingSec || 0} totalSeconds={active?.timer?.target || active?.assignment.drills.find(item => item.id === active.rows.find(row => row.id === active.timer?.ownerRowId)?.drillId)?.restSec || 0} restPaused={!!active?.timer?.paused} primaryLabel={reviewOnly && view?.phase === 'complete' ? 'Save review' : view?.primaryAction.label} onPrimary={readOnly ? undefined : primary} onPauseRest={readOnly ? undefined : () => send('PAUSE_REST')} onResumeRest={readOnly ? undefined : () => send('RESUME_REST')} onAdjustRest={readOnly ? undefined : deltaSec => send('ADJUST_REST', { deltaSec })} onStop={!readOnly && view?.phase === 'working' ? () => send('STOP') : undefined} onUndo={!readOnly && view?.canUndo ? () => send('UNDO') : undefined} onFinish={!readOnly && active ? () => { setRemovalError(''); setDialog({ type: 'finish', session: active }) } : undefined} onBack={() => { setFinished(null); navigate('today') }} onReviewUnfinished={readOnly ? undefined : () => send('STOP')} actualValue={actual} onActualChange={readOnly ? undefined : setActual} onMediaError={onMediaError} sample={sample} saved={!!finished} complete={finished?.status === 'completed'} completedCount={finished?.rows.filter(row => row.status === 'done').length || 0} totalCount={finished?.rows.length || 0} saveError={saveFailed ? error : undefined} disabled={readOnly || disabledActual || !!finishingSession} />}
    </>}
    {saveFailed && <Button variant="secondary" icon="download" onClick={download}>Export in-memory progress</Button>}
    {(onRenewAccess || onLogout) && <div className="qt-access-actions">{onRenewAccess && <Button variant="text" disabled={accessPending} onClick={onRenewAccess}>Renew family access</Button>}{onLogout && <Button variant="text" disabled={accessPending} onClick={onLogout}>Sign out</Button>}</div>}
    <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={readImport} />
  </TrainingShell>
    {dialog && <Dialog title={dialog.type === 'new-practice' ? 'Start a new practice?' : dialog.type === 'share' ? 'Share this practice' : dialog.type === 'load-practice' ? 'Open saved practice?' : dialog.type === 'assignment' ? dialog.assignment.title : dialog.type === 'session' ? dialog.session.assignment.title : dialog.type === 'drill' ? dialog.drill.title : dialog.type === 'delete-session' ? `Delete “${dialog.session.assignment.title}”?` : dialog.type === 'finish' ? 'Leave practice?' : dialog.type === 'restore' ? 'Restore progress?' : 'A practice is already open'} onClose={() => setDialog(null)} actions={close => dialog.type === 'new-practice' ? <Button onClick={() => { setDraft({ id: null, title: '', drills: [] }); setDialog(null); setMessage(''); window.scrollTo({ top: 0, behavior: 'instant' }) }}>New practice</Button> : dialog.type === 'load-practice' ? <Button onClick={() => loadPractice(dialog.assignment)}>Open saved practice</Button> : dialog.type === 'share' ? <Button onClick={async () => { try { await navigator.clipboard.writeText(dialog.link); setShareMessage('Link copied.') } catch { setShareMessage('Select and copy the link below.') } }}>Copy link</Button> : dialog.type === 'delete-session' ? <><Button variant="danger" disabled={removalPending || readOnly} onClick={() => removeSession('deleteSession', dialog.session)}>Delete session</Button><Button variant="secondary" disabled={removalPending} onClick={close}>Keep session</Button></> : dialog.type === 'finish' ? <><Button icon="flag" disabled={removalPending} onClick={finish}>{reviewOnly ? 'Save review' : 'Save and leave'}</Button><Button variant="danger" disabled={removalPending || readOnly} onClick={() => removeSession('discardActive', dialog.session)}>Discard without saving</Button><Button variant="secondary" disabled={removalPending} onClick={close}>{reviewOnly ? 'Keep reviewing' : 'Keep practicing'}</Button></> : dialog.type === 'assignment' ? <Button icon="play" disabled={readOnly} onClick={() => begin(dialog.assignment)}>{isVideoReview(dialog.assignment) ? 'Review these videos' : 'Practice this assignment'}</Button> : dialog.type === 'existing' ? <Button icon="play" onClick={() => { setFinished(null); navigate('practice') }}>Resume open practice</Button> : dialog.type === 'restore' ? <><Button disabled={readOnly} onClick={restore}>Merge backup</Button><Button variant="secondary" onClick={close}>Cancel</Button></> : undefined}>
      {dialog.type === 'new-practice' && <p>Save your current draft first if you want to keep it. Your saved practices and history will stay available.</p>}
      {dialog.type === 'share' && <><p>Anyone with this link can open the practice and its videos. It contains the drills and targets; your progress stays on your device.</p><label className="qt-field qt-share-link">Practice link<input readOnly value={dialog.link} onFocus={event => event.target.select()} /></label><p role="status">{shareMessage}</p></>}
      {dialog.type === 'load-practice' && <p>This opens “{dialog.assignment.title}” in the builder. Save your current draft first if you want to keep it.</p>}
      {dialog.type === 'assignment' && <AssignmentDetail assignment={dialog.assignment} current={isCurrent(dialog.assignment)} />}
      {dialog.type === 'session' && <SessionDetail session={dialog.session} onDelete={readOnly ? undefined : requestDelete} />}
      {dialog.type === 'drill' && <DrillPreview key={dialog.drill.id} drill={dialog.drill} sample={sample} onPlaybackError={onMediaError} />}
      {dialog.type === 'finish' && <div className="qt-exit-summary"><p>{dialog.session?.assignment.title}</p><strong>{view?.progress.done || 0} <span>/ {view?.progress.total || 0} {reviewOnly ? 'videos reviewed' : selfPaced ? 'drills practiced' : 'sets recorded'}</span></strong><p>{reviewOnly ? 'Only video review is saved; no athletic work.' : view?.prescriptionMet ? 'All planned work is complete.' : 'Saving keeps your work as a partial session.'}</p>{view?.phase === 'working' && (drill?.mode === 'time' || drill?.mode === 'practice' && !view?.practicePaused) || view?.phase === 'rest' && !active?.timer?.paused ? <p className="qt-exit-timer"><Icon name="clock" size={14}/>Timer is still running.</p> : null}</div>}
      {dialog.type === 'delete-session' && <p>Remove this saved session from this device and its history charts? This cannot be undone here.</p>}
      {['finish', 'delete-session'].includes(dialog.type) && removalError && <Notice title="Could not remove session" tone="error">{removalError}</Notice>}
      {dialog.type === 'existing' && <p>Resume or finish the existing practice before starting a new one. Its assignment snapshot and progress are preserved.</p>}
      {dialog.type === 'restore' && <><p>The backup contains {dialog.data.sessions.length} saved sessions{dialog.data.activeSession ? ' and an active practice' : ''}. Existing history will be preserved. Conflicting work is refused.</p><Button variant="text" icon="download" onClick={download}>Export current progress first</Button></>}
    </Dialog>}
  </div>
}
