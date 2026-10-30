import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createSession, getSessionView, reduceSession } from '../domain/index.js'
import { createTrainingRepository, emptyProgress, exportProgress, mergeProgress, ProgressConflictError } from '../storage/index.js'
import { createObservedClock } from './observed-clock.js'

// One durable controller lives above the routes. Views never own work clocks or writes.
export default function useTrainingController({ databaseName }) {
  const repository = useMemo(() => createTrainingRepository({ name: databaseName }), [databaseName])
  const clock = useMemo(() => createObservedClock(), [])
  const [progress, setProgress] = useState(emptyProgress)
  const current = useRef(progress)
  const queue = useRef(Promise.resolve())
  const canWrite = useRef(false)
  const saveFailure = useRef(null)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [readOnly, setReadOnly] = useState(false)
  const [now, setNow] = useState(clock.now)
  const publish = useCallback(next => { current.current = next; setProgress(next); setNow(clock.now()) }, [clock])

  const persist = useCallback(async next => {
    setSaving(true)
    try {
      const saved = await repository.save(next, next.revision)
      publish(saved); saveFailure.current = null; setError(null)
    } catch (failure) {
      saveFailure.current = failure; setError(failure.message)
      if (failure instanceof ProgressConflictError) { canWrite.current = false; setReadOnly(true) }
    } finally { setSaving(false) }
  }, [publish, repository])

  const change = useCallback(transform => {
    const operation = queue.current.catch(() => {}).then(async () => {
      if (!canWrite.current) return null
      try {
        const next = transform(current.current)
        if (next === current.current) return null
        publish(next)
        if (!saveFailure.current) await persist(next)
        return next
      } catch (failure) { setError(failure.message); return null }
    })
    queue.current = operation
    return operation
  }, [persist, publish])

  const command = useCallback((type, fields = {}, owner) => {
    const active = current.current.activeSession
    if (!active) return Promise.resolve(null)
    const input = { type, id: crypto.randomUUID(), sessionId: owner?.sessionId || active.id, now: clock.now(), ...fields }
    if (owner && 'rowId' in owner) input.rowId = owner.rowId
    return change(state => {
      if (!state.activeSession) return state
      const session = reduceSession(state.activeSession, input)
      if (session === state.activeSession) return state
      return session.status === 'active'
        ? { ...state, activeSession: session }
        : { ...state, activeSession: null, sessions: [...state.sessions, session] }
    })
  }, [change, clock])

  useEffect(() => {
    let disposed = false
    let release
    const load = async owned => {
      try {
        const stored = await repository.load()
        if (disposed) return
        publish(stored)
        canWrite.current = owned
        if (owned && stored.activeSession) {
          const reconciled = reduceSession(stored.activeSession, { type: 'RECONCILE', id: crypto.randomUUID(), sessionId: stored.activeSession.id, now: clock.reconcileTime(stored.activeSession).now })
          if (reconciled !== stored.activeSession) { const next = { ...stored, activeSession: reconciled }; publish(next); await persist(next) }
        }
      } catch (failure) { if (!disposed) { setError(failure.message); canWrite.current = false; setReadOnly(true) } }
      finally { if (!disposed) setReady(true) }
    }
    if (!navigator.locks?.request) {
      setReadOnly(true); setError('This browser cannot protect an active practice across tabs. Open this preview in a browser with Web Locks support.')
      void load(false)
    } else {
      // Deferral lets React's development setup/cleanup probe cancel before acquiring a lock.
      Promise.resolve().then(() => disposed ? undefined : navigator.locks.request(`${databaseName}-controller`, { mode: 'exclusive', ifAvailable: true }, async lock => {
        if (disposed) return
        if (!lock) { setReadOnly(true); setError('Another tab owns this practice. Close that tab, then reload here to resume.'); await load(false); return }
        setReadOnly(false); setError(null)
        await load(true)
        if (!disposed) await new Promise(resolve => { release = resolve })
      })).catch(failure => { if (!disposed) { setReadOnly(true); setError(failure.message); setReady(true) } })
    }
    return () => { disposed = true; canWrite.current = false; release?.() }
  }, [clock, databaseName, persist, publish, repository])

  useEffect(() => {
    if (!ready || readOnly) return
    const refresh = () => {
      setNow(clock.now())
      if (document.visibilityState === 'visible') {
        const check = clock.reconcileTime(current.current.activeSession)
        if (current.current.activeSession?.timer) void command(check.clockChanged ? 'RECONCILE' : 'TICK', { now: check.now })
      }
    }
    const interval = window.setInterval(refresh, 1000)
    const visibility = () => {
      setNow(clock.now())
      void command(document.visibilityState === 'hidden' ? 'BACKGROUND' : 'RECONCILE', document.visibilityState === 'hidden' ? {} : { now: clock.reconcileTime(current.current.activeSession).now })
    }
    const pageHide = () => { void command('BACKGROUND') }
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', pageHide)
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', pageHide) }
  }, [clock, command, ready, readOnly])

  const start = assignment => change(state => {
    if (state.activeSession) throw new Error('A practice is already in progress. Resume or finish it before starting another.')
    return { ...state, activeSession: createSession(assignment, { id: crypto.randomUUID(), now: clock.now() }) }
  })
  const retrySave = () => {
    queue.current = queue.current.catch(() => {}).then(() => canWrite.current ? persist(current.current) : null)
    return queue.current
  }
  const restore = imported => change(state => mergeProgress(state, imported))
  const active = progress.activeSession
  return { progress, active, view: active ? getSessionView(active, now) : null, ready, saving, error, saveFailed: !!saveFailure.current, readOnly, command, start, retrySave, restore, exportData: () => exportProgress(current.current, { now: Date.now() }) }
}
