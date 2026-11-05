import PracticeReview from './PracticeReview.jsx'
import PracticeShare from './PracticeShare.jsx'
import PracticeImport from './PracticeImport.jsx'
import { readPracticeCode } from '../domain/practice-code.js'
import { practiceKey, readFavorites, toggleFavorite } from '../domain/practice-favorites.js'
import { isDrillSelected, toggleDrillSelection, draftMatchesPractice } from '../domain/drill-selection.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import DrillDemonstration from './DrillDemonstration.jsx'
import MyPracticesView from '../views/MyPracticesView.jsx'
import RandomPracticeView from '../views/RandomPracticeView.jsx'
import OwnDrillView, { initialOwnDrill } from '../views/OwnDrillView.jsx'
import { createCustomDrill, customDrillFields, readCustomDrills, saveCustomDrill, removeCustomDrill } from '../domain/custom-drills.js'
import { SKILL_REGISTRY } from '../domain/metadata.js'
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
import { createPractice, reusableDrills, readSavedPractices, savePractice } from '../domain/practice-builder.js'
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
  const [browseState, setBrowseState] = useState({ section: 'drills', limit: 12, search: '', focus: '', setting: '', strategy: 'balanced', videoOnly: false, videoOrder: 'first' })
  const [draft, setDraft] = useState({ id: null, title: '', note: '', drills: [] })
  const draftCreated = useRef(false)
  const [libraryView, setLibraryView] = useState({ tab: null, selected: null, query: '' })
  const [savedLibrary, setSavedLibrary] = useState({ practices: [], source: null, error: null, ready: false })
  const [favorites, setFavorites] = useState({ keys: [], source: null, error: null, ready: false })
  const favoriteKey = `${databaseName}:practice-stars-v1`
  const [workspace, updateWorkspace] = useState('library')
  const setWorkspace = next => { if (route === 'build') transitionView(() => updateWorkspace(next), next === 'library' || next === 'organizer' && workspace === 'preview' ? 'back' : 'forward'); else updateWorkspace(next) }
  const [workspaceOrigin, setWorkspaceOrigin] = useState({ route: 'today', workspace: 'library' })
  const [previewAssignment, setPreviewAssignment] = useState(null)
  const [starting, setStarting] = useState(false)
  const [recordPending, setRecordPending] = useState(false)
  const recording = useRef(false)
  const [ownAdding, setOwnAdding] = useState(false)
  const [ownSwapId, setOwnSwapId] = useState(null)
  const [ownDraft, setOwnDraft] = useState(initialOwnDrill)
  const [ownEditingId, setOwnEditingId] = useState(null)
  const [ownDeletePending, setOwnDeletePending] = useState(false)
  const [ownDeleteError, setOwnDeleteError] = useState('')
  const [customLibrary, setCustomLibrary] = useState({ drills: [], source: null, error: null, ready: false })
  const mediaPlayer = useRef(null)
  const customKey = `${databaseName}:custom-drills-v1`
  const changeDraft = next => { draftCreated.current = true; setDraft(next); setMessage('') }
  const draftSaved = savedLibrary.practices.some(practice => draftMatchesPractice(draft, practice))
  const libraryKey = `${databaseName}:saved-practices-v1`
  const sharedToken = useSharedPracticeToken()
  const [shared, setShared] = useState(null)
  useEffect(() => {
    let live = true
    setShared(sharedToken === null ? null : { token: sharedToken, loading: true })
    if (sharedToken !== null) readPracticeCode(sharedToken, catalog).then(assignment => { if (live) setShared({ token: sharedToken, assignment }) }, failure => { if (live) setShared({ token: sharedToken, error: failure.message }) })
    return () => { live = false }
  }, [sharedToken, catalog])
  useEffect(() => {
    try { const source = window.localStorage.getItem(favoriteKey); setFavorites({ source, keys: readFavorites(source), ready: true, error: null }) }
    catch (failure) { setFavorites({ keys: [], source: null, ready: true, error: failure.message }) }
  }, [favoriteKey])
  const library = useMemo(() => reusableDrills(catalog, [...standardDrills(), ...customLibrary.drills], savedLibrary.practices), [catalog, customLibrary.drills, savedLibrary.practices])
  useEffect(() => {
    try {
      const source = window.localStorage.getItem(libraryKey)
      setSavedLibrary({ source, practices: readSavedPractices(source), error: null, ready: true })
    } catch (failure) { setSavedLibrary({ source: null, practices: [], error: failure.message, ready: true }) }
  }, [libraryKey])
  useEffect(() => {
    try { const source = window.localStorage.getItem(customKey); setCustomLibrary({ source, drills: readCustomDrills(source), error: null, ready: true }) }
    catch (failure) { setCustomLibrary({ source: null, drills: [], error: failure.message, ready: true }) }
  }, [customKey])
  const assignmentFromDraft = () => createPractice(draft.title, draft.drills, { id: draft.id || `practice-${crypto.randomUUID()}`, revision: `edition-${crypto.randomUUID()}`, note: draft.note })
  const share = (assignment, fromReview = false) => setDialog({ type: 'share', fromReview, assignment })
  const useDraft = action => {
    try { action(assignmentFromDraft()) } catch (failure) { setMessage(failure.message) }
  }
  const isSaved = assignment => savedLibrary.practices.some(item => practiceKey(item) === practiceKey(assignment))
  const isStarred = assignment => favorites.keys.includes(practiceKey(assignment))
  const storePractice = assignment => {
    if (!savedLibrary.ready || savedLibrary.error) throw new Error(savedLibrary.error || 'Saved practices are still loading.')
    if (isSaved(assignment)) return
    let saved
    try { saved = savePractice(window.localStorage, libraryKey, savedLibrary.source, assignment) }
    catch (failure) { if (failure.name === 'QuotaExceededError') throw new Error('This device is out of storage. Keep the practice link, then free some space before saving.'); throw failure }
    setSavedLibrary({ ...saved, error: null, ready: true })
  }
  const keepPractice = assignment => {
    try { storePractice(assignment); setLibraryView({ tab: 'saved', selected: practiceKey(assignment), query: '' }); setMessage(''); return true }
    catch (failure) { setMessage(failure.message); return false }
  }
  const starPractice = assignment => {
    try {
      if (!favorites.ready || favorites.error) throw new Error(favorites.error || 'Stars are still loading.')
      if (!isStarred(assignment)) storePractice(assignment)
      setFavorites({ ...toggleFavorite(window.localStorage, favoriteKey, favorites.source, assignment), ready: true, error: null })
      setMessage('')
    } catch (failure) { setMessage(failure.message) }
  }
  const persistPractice = assignment => {
    try { storePractice(assignment); setLibraryView({ tab: 'saved', selected: practiceKey(assignment), query: '' }); setDraft({ id: assignment.id, title: assignment.title, note: assignment.note || '', drills: assignment.drills }); setMessage('') }
    catch (failure) { setMessage(failure.message) }
  }
  const loadPractice = assignment => { draftCreated.current = true; setDraft({ id: null, title: assignment.title, note: assignment.note || '', drills: structuredClone(assignment.drills) }); setWorkspace('organizer'); navigate('build'); setMessage('') }
  const adaptPractice = assignment => draft.drills.length && !draftSaved && (draft.title !== assignment.title || (draft.note || '') !== (assignment.note || '') || JSON.stringify(draft.drills) !== JSON.stringify(assignment.drills)) ? setDialog({ type: 'load-practice', assignment }) : loadPractice(assignment)
  const copyShared = () => adaptPractice(shared.assignment)
  const previewDrill = (drill, index, returnTo = null) => setDialog({ type: 'drill', drill, index, standalone: true, returnTo })
  const watchDrill = (drill, index) => { flushSync(() => setDialog({ type: 'video', drill, index })); mediaPlayer.current?.play()?.catch(() => {}) }
  const openWorkspace = next => { setWorkspaceOrigin({ route, workspace }); setWorkspace(next); navigate('build') }
  const openOrganizer = () => { if (!draftCreated.current) { draftCreated.current = true; setDraft({ id: null, title: currentAssignment.title, note: currentAssignment.note || '', drills: structuredClone(currentAssignment.drills) }) } openWorkspace('organizer') }
  const openOwn = (adding = false) => { setOwnAdding(adding); setOwnSwapId(adding ? dialog?.swapId || null : null); openWorkspace('own') }
  const backWorkspace = () => {
    if (workspace === 'own' && ownEditingId) cancelOwnEdit()
    if (workspace === 'preview') { setWorkspace('organizer'); return }
    if (workspace === 'organizer') { setWorkspace('library'); navigate('today'); return }
    if (workspace === 'library') { navigate('today'); return }
    setWorkspace(workspaceOrigin.workspace)
    navigate(workspaceOrigin.route === 'practice' ? 'today' : workspaceOrigin.route)
  }
  const newPractice = () => {
    if (draft.drills.length && !draftSaved) { setDialog({ type: 'new-practice' }); return }
    changeDraft({ id: null, title: '', note: '', drills: [] }); setWorkspace('organizer'); navigate('build')
  }
  const previewPractice = () => useDraft(assignment => { setPreviewAssignment(assignment); setWorkspace('preview'); setMessage('') })
  const addOwnToPractice = drill => { changeDraft(current => ownSwapId ? { ...current, drills: current.drills.map(item => item.id === ownSwapId ? { ...structuredClone(drill), id: item.id } : item) } : isDrillSelected(current, drill) ? current : toggleDrillSelection(current, drill)); setOwnSwapId(null); setWorkspace('organizer'); setDialog(null); navigate('build') }
  const startOwn = drill => begin(createPractice(drill.title, [drill], { id: `practice-${crypto.randomUUID()}`, revision: `edition-${crypto.randomUUID()}` }))
  const cancelOwnEdit = () => { setOwnEditingId(null); setOwnDraft(initialOwnDrill); setMessage('') }
  const loadOwnForEdit = drill => {
    if (readOnly || saving || ownDeletePending) return
    try {
      const { tags, ...fields } = customDrillFields(drill)
      const skill = tags.find(tag => Object.hasOwn(SKILL_REGISTRY, tag)) || ''
      setOwnDraft({ ...initialOwnDrill, ...fields, skill, extraTags: tags.filter(tag => tag !== skill).join(', ') })
      setOwnEditingId(drill.id); setMessage(''); setDialog(null)
    } catch (failure) { setMessage(failure.message) }
  }
  const editOwn = drill => {
    if (readOnly || saving || ownDeletePending || ownEditingId === drill.id) return
    if (JSON.stringify(ownDraft) !== JSON.stringify(initialOwnDrill)) setDialog({ type: 'edit-own', drill })
    else loadOwnForEdit(drill)
  }
  const deleteOwn = () => {
    if (readOnly || saving || ownDeletePending || !ownEditingId) return
    setOwnDeletePending(true); setOwnDeleteError('')
    try {
      const saved = removeCustomDrill(window.localStorage, customKey, customLibrary.source, ownEditingId)
      setCustomLibrary({ ...saved, error: null, ready: true }); cancelOwnEdit(); setDialog(null)
      setMessage('Drill removed. Your saved practices and history are unchanged.')
    } catch (failure) { setOwnDeleteError(failure.message) }
    finally { setOwnDeletePending(false) }
  }
  const saveOwn = async (fields, intent) => {
    if (readOnly || saving || ownDeletePending) throw new Error('Please wait until your current work has saved.')
    if (!customLibrary.ready || customLibrary.error) throw new Error(customLibrary.error || 'Your drills are still loading.')
    const drill = createCustomDrill(fields, ownEditingId ? { id: ownEditingId } : undefined)
    const saved = saveCustomDrill(window.localStorage, customKey, customLibrary.source, drill)
    setCustomLibrary({ ...saved, error: null, ready: true }); setOwnDraft(initialOwnDrill); setOwnEditingId(null)
    if (intent === 'start') await startOwn(drill)
    else if (intent === 'add') addOwnToPractice(drill)
    else if (intent === 'update') setMessage(`“${drill.title}” updated.`)
    else { backWorkspace(); setMessage(`“${drill.title}” saved to My own drill.`) }
  }
  const chooseReplacement = replacement => {
    const targetId = dialog.swapId
    changeDraft(current => ({ ...current, drills: current.drills.map(item => item.id === targetId ? { ...structuredClone(replacement), id: item.id } : item) }))
    setDialog(null)
  }

  useEffect(() => { setDialog(null) }, [route, sharedToken])
  const navigate = (page, keepMessage = false) => { if (!keepMessage) setMessage(''); setDialog(null); window.location.hash = ROUTES[page] }
  useEffect(() => { document.getElementById('training-main')?.focus({ preventScroll: true }); window.scrollTo(0, 0) }, [route, workspace, finished?.id])
  useEffect(() => {
    if (!view?.currentRow) return
    const offered = view.phase === 'review' ? Math.max(view.currentRow.actual || 0, Math.min(view.currentRow.target, Math.floor(view.elapsedSec))) : view.currentRow.mode === 'reps' ? view.currentRow.actual || 0 : view.currentRow.target
    setActual(offered ?? '')
  }, [view?.currentRow?.id, view?.phase])

  const begin = async assignment => {
    if (readOnly || starting) return
    setMessage('')
    if (active) { setDialog({ type: 'existing' }); return }
    setStarting(true)
    try { const next = await controller.start(assignment); if (next?.activeSession) { setFinished(null); navigate('practice') } }
    finally { setStarting(false) }
  }
  const owner = active ? { sessionId: active.id, rowId: active.currentRowId } : null
  const send = (type, fields) => controller.command(type, fields, owner)
  const finishSession = async (session, sessionView) => {
    if (!session) return
    const sessionId = session.id
    setFinishingSession({ session, view: sessionView })
    const next = await controller.command('FINISH', {}, { sessionId })
    const result = next?.sessions.find(item => item.id === sessionId)
    if (result) transitionView(() => { setFinished(result); setFinishingSession(null); setDialog(null); navigate('practice') })
    else setFinishingSession(null)
  }
  const finish = () => finishSession(active, view)
  const recordWork = async (type, fields = {}) => {
    if (!active || recording.current) return
    const requestOwner = { sessionId: active.id, rowId: active.currentRowId }
    recording.current = true; setRecordPending(true)
    try {
      const next = await controller.command(type, fields, requestOwner)
      const recorded = next?.activeSession
      // Only the player's explicit record action can save a final row. Timer
      // reconciliation must never mark a session complete on its own.
      if (['DONE', 'CONFIRM_REVIEW'].includes(type) && recorded?.id === requestOwner.sessionId && recorded.phase === 'complete') await finishSession(recorded, { ...view, phase: 'complete' })
    } finally { recording.current = false; setRecordPending(false) }
  }
  const primary = () => {
    if (!view || recording.current) return
    if (view.primaryAction.type === 'FINISH') { void finish(); return }
    const fields = view.phase === 'review' || view.phase === 'working' && view.currentRow?.mode === 'reps' ? { actual: Number(actual) } : {}
    void recordWork(view.primaryAction.type, fields)
  }
  const removeSession = async (kind, session) => {
    if (!session || readOnly || removalPending) return
    setRemovalPending(true); setRemovalError('')
    try {
      const next = await controller[kind](session.id)
      if (!next) { setRemovalError('The session could not be removed. Check the storage message and try again.'); return }
      transitionView(() => { setDialog(null); setFinished(null); setFinishingSession(null); setMessage(kind === 'discardActive' ? 'Practice discarded without saving.' : 'Session deleted.'); if (kind === 'discardActive') navigate('today', true) })
    } catch (failure) { setRemovalError(failure.message) }
    finally { setRemovalPending(false) }
  }
  const requestLeave = async () => {
    if (!active) return
    if (view?.phase === 'working') {
      if (drill?.mode === 'practice' && !view.practicePaused) await send('PAUSE_PRACTICE')
      else if (drill?.mode === 'time') await send('STOP')
    } else if (view?.phase === 'rest' && !active.timer?.paused) await send('PAUSE_REST')
    setRemovalError(''); setDialog({ type: 'finish', session: active })
  }
  const resumePausedWork = async () => {
    if (readOnly || !active) return
    await controller.resume(active.id)
  }
  const resumeFromExit = async close => { await resumePausedWork(); close() }
  const resumePractice = async () => { await resumePausedWork(); setFinished(null); navigate('practice') }
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
  const disabledActual = (view?.phase === 'review' || view?.phase === 'working' && view?.currentRow?.mode === 'reps') && (actual === '' || !Number.isFinite(Number(actual)) || Number(actual) < 0 || Number(actual) > (view?.phase === 'review' ? 86400 : 10000) || view?.currentRow?.mode === 'reps' && !Number.isInteger(Number(actual)))
  const completedDrillIds = visualActive?.assignment.drills
    .filter(item => !visualActive.rows.some(row => row.drillId === item.id && row.status !== 'done'))
    .map(item => item.id)
  const selectDrill = drillId => {
    if (readOnly || recording.current || finishingSession || disabledActual && view?.currentRow?.mode === 'reps') return
    const fields = view?.phase === 'working' && view.currentRow.mode === 'reps' ? { drillId, actual: Number(actual) } : { drillId }
    void recordWork('SELECT_DRILL', fields)
  }
  const phaseAnnouncement = view ? `${view.drill?.title || 'Practice'}: ${view.phase === 'review' ? 'Review elapsed set. Confirm completed work.' : view.phase === 'rest' ? active.timer?.paused ? 'Rest paused.' : 'Rest started.' : view.phase === 'ready' ? reviewOnly ? 'Ready to review this video.' : selfPaced ? 'Ready. Start the next drill when you are ready.' : 'Ready. Start the next set when you are ready.' : view.phase === 'complete' ? reviewOnly ? 'All videos reviewed. Save your review.' : selfPaced ? 'All drills practiced. Finish to save the session.' : 'All sets recorded. Finish to save the session.' : selfPaced ? 'Drill started.' : 'Set started.'}` : ''

  if (suspended) return accessPanel
  return <div><TrainingShell page={route} practice={route === 'practice' && !finished} builder sample={sample} localPreview={localPreview} sourceUrl={APP_CONFIG.sourceUrl} onNavigate={navigate} onOrganize={openOrganizer}>
    <span className="qt-live-status" role="status" aria-live="polite">{phaseAnnouncement}</span>
    {accessNotice && <Notice title="Family access" tone="warning">{accessNotice}</Notice>}
    {error && <Notice title={readOnly ? 'Practice is read only' : saveFailed ? 'Progress is not saved' : 'Practice needs attention'} tone="error" action={readOnly ? 'Reload' : saveFailed ? 'Retry save' : undefined} onAction={readOnly ? () => window.location.reload() : controller.retrySave}>{error}{saveFailed ? ' Your work is still in memory. Retry or export a backup before closing this tab.' : ''}</Notice>}
    {message && <Notice title="Training">{message}</Notice>}
    {!ready ? <LoadingState label={sample ? 'Opening local sample progress' : 'Opening local progress'} /> : <>
      {(readOnly || saveFailed) && <p className="qt-save-status">{readOnly ? 'Read-only view · no changes will be recorded' : saveFailed ? 'Not saved · export a backup or retry' : saving ? 'Saving on this device…' : sample ? 'Sample progress saved on this device' : 'Progress saved on this device'}</p>}
      {route === 'today' && <><MyPracticesView value={libraryView} onChange={setLibraryView} saved={savedLibrary.practices} history={progress.sessions} favorites={favorites.keys} onStart={begin} onAdapt={adaptPractice} onNew={newPractice} onImport={() => setDialog({ type: 'import-practice' })} onShare={share} onStar={starPractice} onRandom={() => openWorkspace('random')} onOwnDrill={() => openOwn(false)} onOpenDrill={previewDrill} onWatchDrill={watchDrill} disabled={readOnly || starting} featured={<TodayView compact onStar={() => starPractice(currentAssignment)} starred={isStarred(currentAssignment)} assignment={currentAssignment} activeSession={active} sample={sample} disabled={readOnly || starting} onStart={readOnly ? undefined : () => begin(currentAssignment)} onResume={resumePractice} onOpenDrill={previewDrill} onWatchDrill={watchDrill}/>}/>
        {savedLibrary.error && <Notice title="Saved practices unavailable" tone="error">{savedLibrary.error}</Notice>}
        {favorites.error && <Notice title="Stars unavailable" tone="error">{favorites.error}</Notice>}
        {sample && <details className="qt-state-gallery"><summary>Sample interface states</summary><p className="qt-fine-print">Visual examples only. These controls do not change your practice.</p><div className="qt-state-gallery-buttons">{['loading', 'empty', 'offline', 'save error'].map(state => <button type="button" key={state} aria-pressed={gallery === state} onClick={() => setGallery(state)}>{state}</button>)}</div><div className="qt-state-gallery-content">{gallery === 'loading' ? <LoadingState /> : gallery === 'empty' ? <EmptyState title="No assignment yet">Trainer content will appear when published.</EmptyState> : <Notice title={gallery === 'offline' ? 'Offline example' : 'Save error example'} tone={gallery === 'offline' ? 'warning' : 'error'}>{gallery === 'offline' ? 'The instructions may be available while the video still needs a connection.' : 'Work remains in memory until it can be saved or exported.'}</Notice>}</div></details>}
      </>}
      {route === 'build' && <div className={`qt-view pb-workspace pb-workspace--${workspace}`}>
        <div className="pb-workspace-back"><Button variant="text" icon="back" onClick={backWorkspace}>{workspace === 'preview' ? 'Back to organizer' : workspace === 'organizer' ? 'My practices' : 'Back'}</Button>{workspace === 'preview' && <span>Preview only · nothing is being recorded</span>}</div>
        {savedLibrary.error && <Notice title="Saved practices unavailable" tone="error">{savedLibrary.error}</Notice>}
        {workspace === 'library' && <MyPracticesView value={libraryView} onChange={setLibraryView} favorites={favorites.keys} onImport={() => setDialog({ type: 'import-practice' })} onShare={share} onStar={starPractice} saved={savedLibrary.practices} history={progress.sessions} onStart={begin} onAdapt={adaptPractice} onNew={newPractice} onRandom={() => openWorkspace('random')} onOwnDrill={() => openOwn(false)} onOpenDrill={previewDrill} onWatchDrill={watchDrill} disabled={readOnly || starting}/>}
        {workspace === 'organizer' && <section className="pb-organizer"><header className="pb-view-heading"><div><p className="qt-eyebrow">Organizer</p><h1>Arrange a practice</h1></div><span>{draft.drills.length} drills</span></header><PracticeReview draft={draft} onChange={changeDraft} disabled={readOnly} saved={draftSaved} onNew={() => setDialog({ type: 'new-practice' })} onAdd={() => setDialog({ type: 'pick-drills' })} onSwap={drill => setDialog({ type: 'pick-drills', swapId: drill.id })} onPreview={previewDrill} onWatchDrill={watchDrill}/><div className="pb-editor-actions"><Button icon="arrow" disabled={!draft.drills.length || readOnly} onClick={previewPractice}>Preview as player</Button><div className="qt-field-grid"><Button variant="secondary" disabled={!draft.drills.length || readOnly || draftSaved} onClick={() => useDraft(persistPractice)} icon={draftSaved ? 'check' : undefined}>{draftSaved ? 'Saved' : 'Save practice'}</Button><Button variant="secondary" disabled={!draft.drills.length || readOnly || starting} onClick={() => useDraft(begin)}>Start practice</Button></div><Button variant="text" icon="share" disabled={!draft.drills.length || readOnly} onClick={() => useDraft(share)}>Share practice</Button></div></section>}
        {workspace === 'preview' && previewAssignment && <><TodayView assignment={previewAssignment} preview kind="personal" onOpenDrill={previewDrill} onWatchDrill={watchDrill}/><div className="pb-editor-actions"><Button icon="share" onClick={() => share(previewAssignment, true)}>Create practice link</Button><p className="qt-fine-print">Anyone with the link can open this practice. Your recorded work stays on this device.</p></div></>}
        {workspace === 'random' && <><header className="pb-view-heading"><div><p className="qt-eyebrow">Practice your way</p><h1>Surprise me</h1></div><Icon name="shuffle" size={26}/></header><RandomPracticeView library={library} history={progress.sessions} onStart={begin} onOpenDrill={previewDrill} onWatchDrill={watchDrill} disabled={readOnly || starting}/></>}
        {workspace === 'own' && <><header className="pb-view-heading"><div><p className="qt-eyebrow">Practice your way</p><h1>My own drill</h1></div><Icon name="pencil" size={26}/></header><OwnDrillView value={ownDraft} onChange={setOwnDraft} savedDrills={customLibrary.drills} editingId={ownEditingId} onEditSaved={editOwn} onCancelEdit={cancelOwnEdit} onDelete={() => { setOwnDeleteError(''); setDialog({ type: 'delete-own' }) }} onSubmit={saveOwn} onStartSaved={startOwn} onAddSaved={addOwnToPractice} adding={ownAdding} disabled={readOnly || saving || starting || ownDeletePending || !customLibrary.ready} storageError={customLibrary.error}/></>}
      </div>}
      {route === 'shared' && (shared?.loading || !shared || shared.token !== sharedToken ? <LoadingState label="Opening practice pass"/> : shared.assignment ? <><Button variant="text" icon="back" onClick={() => navigate('today')}>My practices</Button><TodayView assignment={shared.assignment} kind="shared" activeSession={active} disabled={readOnly || starting} onStart={readOnly ? undefined : () => { if (keepPractice(shared.assignment)) void begin(shared.assignment) }} onResume={resumePractice} onBuild={copyShared} onSave={() => keepPractice(shared.assignment)} saved={isSaved(shared.assignment)} onStar={() => starPractice(shared.assignment)} starred={isStarred(shared.assignment)} onOpenDrill={previewDrill} onWatchDrill={watchDrill} /></> : <Notice title="Practice link unavailable" tone="error" action="My practices" onAction={() => navigate('today')}>{shared.error || 'Ask for the complete practice link.'}</Notice>)}
      {(route === 'me' || route === 'history') && <MeView databaseName={databaseName} assignments={catalog.assignments} sessions={[...(active ? [active] : []), ...progress.sessions.slice().reverse()]} onOpenSession={session => setDialog({ type: 'session', session })} onResume={resumePractice} onExport={download} onRestore={readOnly ? undefined : () => importInput.current?.click()} />}
      {route === 'practice' && <PracticeView assignment={shown?.assignment} drill={drill} drillIndex={visualActive ? Math.max(0, visualActive.assignment.drills.findIndex(item => item.id === drill?.id)) : 0} drillCount={visualActive?.assignment.drills.length} completedDrillIds={completedDrillIds} nextDrill={visualView?.nextDrill}
        finalRow={visualView ? visualView.progress.total - visualView.progress.done === 1 : undefined}
        onSelectDrill={readOnly || recordPending || finishingSession || disabledActual && view?.currentRow?.mode === 'reps' ? undefined : selectDrill}
        onReviewDrill={recordPending || finishingSession ? undefined : previewDrill} sets={drillRows} currentSetIndex={currentSetIndex} phase={visualView?.phase} practiceSeconds={visualView?.practiceSeconds || 0} practicePaused={visualView?.practicePaused} onTogglePracticePause={readOnly ? undefined : () => send(view?.practicePaused ? 'RESUME_PRACTICE' : 'PAUSE_PRACTICE')} remainingSeconds={visualView?.remainingSec || 0} totalSeconds={active?.timer?.target || active?.assignment.drills.find(item => item.id === active.rows.find(row => row.id === active.timer?.ownerRowId)?.drillId)?.restSec || 0} restPaused={!!active?.timer?.paused} primaryLabel={reviewOnly && view?.phase === 'complete' ? 'Save review' : view?.primaryAction.label} onPrimary={readOnly ? undefined : primary} onPauseRest={readOnly ? undefined : () => send('PAUSE_REST')} onResumeRest={readOnly ? undefined : () => send('RESUME_REST')} onAdjustRest={readOnly ? undefined : deltaSec => send('ADJUST_REST', { deltaSec })} onStop={!readOnly && view?.phase === 'working' ? () => send('STOP') : undefined} onUndo={!readOnly && !recordPending && view?.canUndo ? () => send('UNDO') : undefined} onFinish={!readOnly && active && !recordPending ? requestLeave : undefined} onBack={() => { setFinished(null); navigate('today') }} onRecordStopped={readOnly ? undefined : () => recordWork('DONE')} onReviewUnfinished={readOnly ? undefined : () => send('STOP')} actualValue={actual} onActualChange={readOnly ? undefined : setActual} onMediaError={onMediaError} sample={sample} saved={!!finished} finishedSession={finished} onHistory={() => { setFinished(null); navigate('me') }} complete={finished?.status === 'completed'} completedCount={finished?.rows.filter(row => row.status === 'done').length || 0} totalCount={finished?.rows.length || 0} saveError={saveFailed ? error : undefined} disabled={readOnly || recordPending || disabledActual || !!finishingSession} />}
    </>}
    {saveFailed && <Button variant="secondary" icon="download" onClick={download}>Export in-memory progress</Button>}
    {(onRenewAccess || onLogout) && <div className="qt-access-actions">{onRenewAccess && <Button variant="text" disabled={accessPending} onClick={onRenewAccess}>Renew family access</Button>}{onLogout && <Button variant="text" disabled={accessPending} onClick={onLogout}>Sign out</Button>}</div>}
    <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={readImport} />
  </TrainingShell>
    {dialog && <Dialog className={dialog.type === 'video' ? 'qt-video-dialog' : dialog.type === 'pick-drills' ? 'qt-selection-dialog pb-picker-dialog' : ['new-practice', 'load-practice'].includes(dialog.type) || dialog.selection || dialog.fromReview ? 'qt-selection-dialog' : ''} title={dialog.type === 'import-practice' ? 'Add a practice' : dialog.type === 'delete-own' ? 'Delete this drill?' : dialog.type === 'edit-own' ? 'Replace your drill draft?' : dialog.type === 'video' ? dialog.drill.title : dialog.type === 'pick-drills' ? dialog.swapId ? 'Swap a drill' : 'Add drills to your practice' : dialog.type === 'new-practice' ? 'Clear this practice?' : dialog.type === 'share' ? 'Share this practice' : dialog.type === 'load-practice' ? 'Replace your draft?' : dialog.type === 'assignment' ? dialog.assignment.title : dialog.type === 'session' ? dialog.session.assignment.title : dialog.type === 'drill' ? dialog.drill.title : dialog.type === 'delete-session' ? `Delete “${dialog.session.assignment.title}”?` : dialog.type === 'finish' ? 'Leave practice?' : dialog.type === 'restore' ? 'Restore progress?' : 'A practice is already open'} onClose={() => setDialog(null)} actions={close => dialog.type === 'delete-own' ? <><Button variant="danger" disabled={readOnly || saving || ownDeletePending} onClick={deleteOwn}>Delete drill</Button><Button variant="secondary" disabled={ownDeletePending} onClick={close}>Keep drill</Button></> : dialog.type === 'edit-own' ? <><Button disabled={readOnly || saving} onClick={() => loadOwnForEdit(dialog.drill)}>Replace draft</Button><Button variant="secondary" onClick={close}>Keep editing</Button></> : dialog.type === 'pick-drills' ? <Button onClick={close}>Done · {draft.drills.length} drills in practice</Button> : dialog.type === 'drill' && dialog.returnTo ? <Button variant="secondary" onClick={() => setDialog(dialog.returnTo)}>Back to drill choices</Button> : dialog.type === 'new-practice' ? <Button onClick={() => { changeDraft({ id: null, title: '', note: '', drills: [] }); setWorkspace('organizer'); setDialog(null); setMessage(''); navigate('build') }}>Clear practice</Button> : dialog.type === 'load-practice' ? <Button onClick={() => loadPractice(dialog.assignment)}>Replace draft</Button> : dialog.type === 'share' && dialog.fromReview ? <Button variant="secondary" onClick={close}>Back to player preview</Button> : dialog.type === 'delete-session' ? <><Button variant="danger" disabled={removalPending || readOnly} onClick={() => removeSession('deleteSession', dialog.session)}>Delete session</Button><Button variant="secondary" disabled={removalPending} onClick={close}>Keep session</Button></> : dialog.type === 'finish' ? <><Button icon="flag" disabled={removalPending} onClick={finish}>{reviewOnly ? 'Save review' : 'Save and leave'}</Button><Button variant="danger" disabled={removalPending || readOnly} onClick={() => removeSession('discardActive', dialog.session)}>Discard without saving</Button><Button variant="secondary" disabled={removalPending} onClick={() => resumeFromExit(close)}>{reviewOnly ? 'Keep reviewing' : 'Resume practice'}</Button></> : dialog.type === 'assignment' ? <Button icon="play" disabled={readOnly} onClick={() => begin(dialog.assignment)}>{isVideoReview(dialog.assignment) ? 'Review these videos' : 'Practice this assignment'}</Button> : dialog.type === 'existing' ? <Button icon="play" onClick={resumePractice}>Resume open practice</Button> : dialog.type === 'restore' ? <><Button disabled={readOnly} onClick={restore}>Merge backup</Button><Button variant="secondary" onClick={close}>Cancel</Button></> : undefined}>
      {dialog.type === 'delete-own' && <><p>Remove this drill from My saved drills? Completed sessions and saved practices keep their original copy.</p>{ownDeleteError && <Notice title="Could not delete drill" tone="error">{ownDeleteError}</Notice>}</>}
      {dialog.type === 'edit-own' && <p>Open “{dialog.drill.title}” instead? Your current unsaved drill edits will be replaced.</p>}
      {dialog.type === 'video' && <DrillDemonstration playerRef={mediaPlayer} media={dialog.drill.media} title={dialog.drill.title} sample={sample} autoPlay onPlaybackError={onMediaError}/>}
      {dialog.type === 'pick-drills' && <BuildPracticeView browseState={browseState} onBrowseChange={setBrowseState} draft={draft} onChange={changeDraft} library={library} history={progress.sessions} activeSession={active} onSelect={dialog.swapId ? chooseReplacement : undefined} onCustom={() => openOwn(true)} onPreview={(drill, index) => previewDrill(drill, index, { ...dialog })} disabled={readOnly}/>}
      {dialog.type === 'new-practice' && <p>Remove all drills from this draft? Saved practices and history stay available.</p>}
      {dialog.type === 'share' && <PracticeShare catalog={catalog} assignment={dialog.assignment}/>}
      {dialog.type === 'import-practice' && <PracticeImport catalog={catalog} onOpen={code => { setDialog(null); window.location.hash = `#/shared/${code}` }}/>}
      {dialog.type === 'load-practice' && <p>Replace your current unsaved draft with a copy of “{dialog.assignment.title}”? Your saved practices and history stay available.</p>}
      {dialog.type === 'assignment' && <AssignmentDetail assignment={dialog.assignment} current={isCurrent(dialog.assignment)} />}
      {dialog.type === 'session' && <><div className="pb-history-practice-actions"><Button icon="forward" disabled={readOnly || starting} onClick={() => begin(dialog.session.assignment)}>Practice again</Button><Button variant="secondary" icon="star" aria-pressed={isStarred(dialog.session.assignment)} disabled={readOnly} onClick={() => starPractice(dialog.session.assignment)}>{isStarred(dialog.session.assignment) ? 'Starred' : 'Star practice'}</Button><Button variant="text" icon="share" onClick={() => share(dialog.session.assignment)}>Share practice</Button></div><SessionDetail session={dialog.session} onDelete={readOnly ? undefined : requestDelete} /></>}

      {dialog.type === 'drill' && <DrillPreview key={dialog.drill.id} drill={dialog.drill} sample={sample} onPlaybackError={onMediaError} />}
      {dialog.type === 'finish' && <div className="qt-exit-summary"><p>{dialog.session?.assignment.title}</p><strong>{view?.progress.done || 0} <span>/ {view?.progress.total || 0} {reviewOnly ? 'videos reviewed' : selfPaced ? 'drills practiced' : 'sets recorded'}</span></strong><p>{reviewOnly ? 'Only video review is saved; no athletic work.' : view?.prescriptionMet ? 'All planned work is complete.' : 'Saving keeps your work as a partial session.'}</p>{view?.phase === 'working' && (drill?.mode === 'time' || drill?.mode === 'practice' && !view?.practicePaused) || view?.phase === 'rest' && !active?.timer?.paused ? <p className="qt-exit-timer"><Icon name="clock" size={14}/>Timer is still running.</p> : null}</div>}
      {dialog.type === 'delete-session' && <p>Remove this saved session from this device and its history charts? This cannot be undone here.</p>}
      {['finish', 'delete-session'].includes(dialog.type) && removalError && <Notice title="Could not remove session" tone="error">{removalError}</Notice>}
      {dialog.type === 'existing' && <p>Resume or finish the existing practice before starting a new one. Its assignment snapshot and progress are preserved.</p>}
      {dialog.type === 'restore' && <><p>The backup contains {dialog.data.sessions.length} saved sessions{dialog.data.activeSession ? ' and an active practice' : ''}. Existing history will be preserved. Conflicting work is refused.</p><Button variant="text" icon="download" onClick={download}>Export current progress first</Button></>}
    </Dialog>}
  </div>
}
