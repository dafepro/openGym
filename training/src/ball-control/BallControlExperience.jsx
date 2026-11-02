import { useCallback, useEffect, useRef, useState } from 'react'
import { BALL_CONTROL_DRILLS } from './curriculum.js'
import { Button, PageHeading, formatClock } from '../components/ui.jsx'
import DrillDemonstration from '../components/DrillDemonstration.jsx'
import CameraPractice from './CameraPractice.jsx'
import { createRound, elapsedMs, observeRound, ROUND_SECONDS, summarizeRound, transitionRound } from './round.js'
import { clearHistory, exportHistory, readHistory, rawHistoryBackup, saveHistory } from './history.js'
import { resolveDemonstration } from './media.js'
import './ball-control.css'

function DrillDiagram({ drill }) {
  const vertical = drill.tracking.axis === 'vertical'
  return <div className="bc-diagram" aria-hidden="true"><span className="bc-diagram-foot">L</span><svg viewBox="0 0 220 112"><rect x="10" y="8" width="200" height="96" rx="16" className="bc-mat" />{drill.tracking.kind === 'alternating-zones' && <path d={vertical ? 'M110 30V82 M104 38l6-8 6 8 M104 74l6 8 6-8' : 'M48 56H172 M56 50l-8 6 8 6 M164 50l8 6-8 6'} />}<circle cx="110" cy="56" r="14" className="bc-diagram-ball" /><path d="m110 46 8 6-3 10h-10l-3-10z" className="bc-ball-panel" /></svg><span className="bc-diagram-foot">R</span></div>
}
const now = () => performance.now()
const titleFor = id => BALL_CONTROL_DRILLS.find(drill => drill.id === id)?.title || 'Ball-control round'

export default function BallControlExperience({ storageKey = 'quicktrack-training:ball-control-v1', catalog, practiceActive = false, onResumePractice, disabled = false, routeActive = true }) {
  const [selected, setSelected] = useState(BALL_CONTROL_DRILLS[0].id)
  const [duration, setDuration] = useState(BALL_CONTROL_DRILLS[0].suggestedSeconds)
  const [round, setRound] = useState(null)
  const [clock, setClock] = useState(0)
  const [history, setHistory] = useState([])
  const [storageError, setStorageError] = useState('')
  const [saved, setSaved] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [notice, setNotice] = useState('')
  const current = useRef(null), savedId = useRef(null), summary = useRef(null), demoPlayer = useRef(null)
  const drill = BALL_CONTROL_DRILLS.find(item => item.id === selected) || BALL_CONTROL_DRILLS[0]
  const working = round?.phase === 'working'
  const inProgress = ['working', 'paused'].includes(round?.phase)
  const unsaved = round && !saved
  const commit = useCallback(next => { current.current = next; setRound(next); return next }, [])
  const action = useCallback(type => {
    const active = current.current
    if (!active) return
    commit(transitionRound(active, type, now())); setClock(now())
  }, [commit])
  useEffect(() => {
    commit(null); setSaved(false); savedId.current = null; setConfirmClear(false); setConfirmDiscard(false); setStorageError('')
    try { setHistory(readHistory(window.localStorage, storageKey)) } catch (issue) { setHistory([]); setStorageError(issue.message || 'Local history is unavailable in this browser.') }
  }, [storageKey, commit])
  useEffect(() => {
    const pause = () => {
      if (current.current?.phase === 'working') { action('pause'); setNotice('Round paused. Resume when you are ready. Camera setup must be checked again after returning.') }
    }
    const hidden = () => { if (document.visibilityState === 'hidden') { pause(); demoPlayer.current?.pause() } }
    const leave = () => { pause(); demoPlayer.current?.pause() }
    document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', leave)
    return () => { document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', leave) }
  }, [action])
  useEffect(() => {
    if (disabled || practiceActive || !routeActive) action('pause')
  }, [disabled, practiceActive, routeActive, action])
  useEffect(() => {
    if (!working) return
    const timer = window.setInterval(() => {
      const value = now(); setClock(value)
      if (current.current?.phase === 'working' && elapsedMs(current.current, value) >= current.current.durationSeconds * 1000) action('finish')
    }, 100)
    return () => window.clearInterval(timer)
  }, [working, action])
  useEffect(() => {
    if (routeActive && round?.phase === 'finished') summary.current?.focus()
  }, [round?.phase, routeActive])
  useEffect(() => {
    if (!unsaved) return
    const warn = event => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [unsaved])
  const start = () => {
    if (disabled || practiceActive || !routeActive || current.current) return
    const next = createRound({ id: crypto.randomUUID(), drillId: drill.id, durationSeconds: duration })
    commit(transitionRound(next, 'start', now())); setClock(now()); setSaved(false); savedId.current = null; setNotice('')
  }
  const arrivals = useCallback(increment => {
    const value = current.current
    if (value) commit(observeRound(value, { arrivalIncrement: increment }, now()))
  }, [commit])
  const cameraObserved = useCallback(() => {
    const value = current.current
    if (value) commit(observeRound(value, { cameraObserved: true }, now()))
  }, [commit])
  const manual = value => {
    if (!current.current || disabled || saved) return
    const count = value === '' ? null : Number(value)
    if (count !== null && (!Number.isInteger(count) || count < 0 || count > 99999)) return
    commit({ ...current.current, manualRepetitions: count })
  }
  const save = () => {
    const active = current.current
    if (disabled || active?.phase !== 'finished' || savedId.current === active.id) return
    try {
      const records = saveHistory(window.localStorage, storageKey, summarizeRound(active))
      savedId.current = active.id; setSaved(true); setHistory(records); setStorageError(''); setNotice('Round saved on this browser.')
    } catch (issue) { setStorageError(`Round not saved. ${issue.message || 'Device storage is unavailable. Try again.'}`) }
  }
  const reset = () => { commit(null); setSaved(false); savedId.current = null; setConfirmDiscard(false); setNotice('') }
  const download = () => {
    try {
      const records = readHistory(window.localStorage, storageKey)
      const blob = new Blob([exportHistory(records)], { type: 'application/json' })
      const url = URL.createObjectURL(blob), link = document.createElement('a')
      link.href = url; link.download = 'quicktrack-ball-control-history.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice('History export prepared.')
    } catch (issue) { setStorageError(issue.message || 'History could not be exported.') }
  }
  const backup = () => {
    try {
      const blob = new Blob([rawHistoryBackup(window.localStorage, storageKey)], { type: 'text/plain' })
      const url = URL.createObjectURL(blob), link = document.createElement('a')
      link.href = url; link.download = 'quicktrack-ball-control-raw-backup.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice('Raw backup prepared. This file is unvalidated local data, not a verified practice report.')
    } catch (issue) { setStorageError(issue.message || 'Local data could not be backed up.') }
  }
  const clear = () => {
    if (disabled) return
    try { clearHistory(window.localStorage, storageKey); setHistory([]); setStorageError(''); setConfirmClear(false); setNotice('Ball-control history cleared from this browser.') }
    catch { setStorageError('History could not be cleared. Device storage is unavailable.') }
  }
  const spent = round ? elapsedMs(round, clock) / 1000 : 0
  const demonstration = resolveDemonstration(catalog, drill.videoId)
  return <div className="bc-experience">
    <PageHeading eyebrow="Your ball. Your pace." title="Ball control">A little space, a ball and a few focused minutes. Guided practice is always ready; camera feedback is optional.</PageHeading>
    {disabled && <p className="bc-notice" role="status">Read-only view. You can explore drills; practice, camera and history changes are disabled.</p>}
    {practiceActive && <div className="bc-notice"><p>An assigned practice is already active. Resume it before starting a ball-control round.</p><Button variant="secondary" onClick={onResumePractice}>Resume assigned practice</Button></div>}
    {notice && <p className="bc-notice" role="status">{notice}</p>}
    <section className="bc-library" aria-labelledby="bc-library-title"><div className="bc-section-heading"><h2 id="bc-library-title">Pick your movement</h2><span className="bc-muted">8 drills</span></div><div className="bc-drill-grid">{BALL_CONTROL_DRILLS.map((item, index) => <button key={item.id} type="button" className="bc-drill-option" aria-pressed={selected === item.id} disabled={!!round} onClick={() => { setSelected(item.id); setDuration(item.suggestedSeconds) }}><span className="bc-drill-number">{String(index + 1).padStart(2, '0')}</span><span><strong>{item.title}</strong><small>{item.tracking.kind === 'alternating-zones' ? 'Optional target arrivals' : 'Timed + manual count'}</small></span></button>)}</div>{round && <p className="bc-muted">Finish this round and choose “Choose another round” to change movements.</p>}</section>
    <section className="bc-card bc-drill-detail" aria-labelledby="bc-drill-title"><p className="qt-eyebrow">{drill.tracking.kind === 'alternating-zones' ? 'Guided + optional camera challenge' : 'Guided movement'}</p><h2 id="bc-drill-title">{drill.title}</h2><p className="bc-muted">{drill.summary}</p><div className="bc-jump-links"><a href="#bc-round" onClick={event => { event.preventDefault(); document.getElementById('bc-round')?.scrollIntoView({ block: 'start' }); document.getElementById('bc-round-title')?.focus() }}>Go to round</a><a href="#bc-camera-title" onClick={event => { event.preventDefault(); document.getElementById('bc-camera-title')?.scrollIntoView({ block: 'start' }); document.getElementById('bc-camera-title')?.focus() }}>Camera setup</a></div><DrillDiagram drill={drill} />
      {demonstration.status === 'approved' && routeActive ? <DrillDemonstration playerRef={demoPlayer} media={demonstration} title={drill.title} /> : <p className="bc-media-pending">{demonstration.status === 'revoked' ? 'This demonstration is no longer available.' : 'Demonstration coming later.'} Use the setup, movement steps and cues below.</p>}
      <div className="bc-instructions"><div><h3>Set up</h3><ul>{drill.setup.map(text => <li key={text}>{text}</li>)}</ul></div><div><h3>The movement</h3><ol>{drill.instructions.map(text => <li key={text}>{text}</li>)}</ol></div><div className="bc-cues"><h3>Keep in mind</h3><ul>{drill.cues.map(text => <li key={text}>{text}</li>)}</ul></div></div>
      <details className="bc-details"><summary>Common mistakes</summary><ul>{drill.commonMistakes.map(text => <li key={text}>{text}</li>)}</ul></details>
    </section>
    <section id="bc-round" className="bc-card bc-round" aria-labelledby="bc-round-title"><div className="bc-section-heading"><h2 id="bc-round-title" tabIndex={-1}>Your round</h2><span className="bc-pill">{round ? round.phase === 'working' ? 'Practicing' : round.phase === 'paused' ? 'Paused' : 'Finished · review' : 'Ready when you are'}</span></div>
      {!round ? <><label className="bc-field">Round duration<select disabled={disabled} value={duration} onChange={event => setDuration(Number(event.target.value))}>{ROUND_SECONDS.map(seconds => <option key={seconds} value={seconds}>{seconds} seconds</option>)}</select></label><p className="bc-muted">Choose a comfortable pace. If using the camera, set it up before starting. The timer does not assess technique.</p><Button disabled={disabled || practiceActive} onClick={start}>Start {duration}-second round</Button></> : <>
        <div className="bc-clock"><strong aria-label={`${Math.ceil(Math.max(0, round.durationSeconds - spent))} seconds remaining`}>{formatClock(round.durationSeconds - spent)}</strong><span>{formatClock(spent)} practiced · {round.durationSeconds}s planned</span><progress max={round.durationSeconds} value={spent} aria-label="Round elapsed time" /></div>
        {inProgress && <div className="bc-actions"><Button disabled={disabled || practiceActive} onClick={() => action(working ? 'pause' : 'resume')}>{working ? 'Pause round' : 'Resume round'}</Button><Button variant="secondary" disabled={disabled} onClick={() => action('finish')}>Finish round</Button></div>}
        <label className="bc-field">Manual repetitions <span className="bc-muted">Optional · enter your own count</span><input type="number" min="0" max="99999" step="1" inputMode="numeric" value={round.manualRepetitions ?? ''} placeholder="Not counted" disabled={disabled || saved} onChange={event => manual(event.target.value)} /></label>
        {drill.tracking.kind === 'alternating-zones' && <p className="bc-arrival-count"><strong>{round.cameraUsed ? round.targetArrivals : '—'}</strong> camera target arrivals <span>Experimental · separate from manual repetitions</span></p>}
        {round.phase === 'finished' && <div className="bc-summary"><h3 ref={summary} tabIndex={-1}>Round summary</h3><p>{round.elapsedMs >= round.durationSeconds * 1000 ? 'Planned duration reached.' : 'Partial round.'} {spent.toFixed(1)} seconds practiced of {round.durationSeconds} planned.</p><p>Manual repetitions: {round.manualRepetitions === null ? 'not entered' : round.manualRepetitions}. Camera target arrivals: {round.cameraUsed ? round.targetArrivals : 'not measured'}.</p><p className="bc-muted">Neither count verifies correct technique. Save only if you want this round in your local history.</p><Button disabled={disabled || saved} onClick={save}>{saved ? 'Saved on this browser' : 'Save round to history'}</Button><Button variant="secondary" onClick={() => saved ? reset() : setConfirmDiscard(true)}>Choose another round</Button>{confirmDiscard && <div className="bc-confirm" role="group" aria-label="Discard unsaved round"><p>This round has not been saved. Discard it and choose another?</p><Button variant="secondary" onClick={reset}>Discard unsaved round</Button><Button variant="text" onClick={() => setConfirmDiscard(false)}>Keep summary</Button></div>}</div>}
        <p className="bc-muted">Rounds are saved only when you choose Save. Leaving Ball control pauses the round; return here to resume or save it.</p>
      </>}
    </section>
    {routeActive && <CameraPractice working={working && !disabled && !practiceActive} disabled={disabled} roundKey={round?.id} supportsScoring={drill.tracking.kind === 'alternating-zones'} onArrivals={arrivals} onObservation={cameraObserved} />}
    <section className="bc-card bc-history" aria-labelledby="bc-history-title"><div className="bc-section-heading"><div><p className="qt-eyebrow">On this browser only</p><h2 id="bc-history-title">Practice history</h2></div><span className="bc-muted">{history.length} / 100</span></div><p className="bc-muted">Your latest 100 saved rounds. Clearing browser data removes them; export a copy to keep them.</p>
      {storageError && <div className="bc-error"><p role="alert">{storageError}</p><Button variant="secondary" onClick={backup}>Export raw local backup</Button><p>This backup preserves the stored text; its results have not been validated.</p></div>}
      {!history.length && <p className="bc-history-empty">Your first saved round will appear here.</p>}
      <ul className="bc-history-list">{history.map(row => <li key={row.id}><strong>{titleFor(row.drillId)}</strong><time dateTime={row.date}>{new Date(row.date).toLocaleString()}</time><span>{row.practiceSeconds.toFixed(1)}s / {row.plannedSeconds}s · {row.completedDuration ? 'duration reached' : 'partial round'}</span><span>Manual: {row.manualRepetitions ?? 'not entered'} · Camera arrivals: {row.cameraUsed ? row.targetArrivals : 'not measured'}</span></li>)}</ul>
      <div className="bc-actions"><Button variant="secondary" disabled={!history.length} onClick={download}>Export history</Button><Button variant="secondary" disabled={disabled || !history.length && !storageError} onClick={() => setConfirmClear(true)}>Clear history</Button></div>
      {confirmClear && <div className="bc-confirm" role="group" aria-label="Confirm clear history"><p>Delete all ball-control history in this browser? This cannot be undone. Assigned practice records are separate.</p><Button variant="secondary" onClick={clear}>Yes, clear ball-control history</Button><Button variant="text" onClick={() => setConfirmClear(false)}>Keep history</Button></div>}
    </section>
  </div>
}
