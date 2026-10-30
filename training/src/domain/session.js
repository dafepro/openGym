import { clone, quantity, requireId, validateAssignment } from './content.js'

const OBSERVED_GAP_MS = 2500
const GUARD_MS = 600
const phases = ['ready', 'working', 'review', 'rest', 'complete']
const at = value => {
  if (!Number.isFinite(value) || value < 0) throw new Error('A valid timestamp is required')
  return value
}
const current = session => session.rows.find(row => row.id === session.currentRowId)
const drillFor = (session, row) => session.assignment.drills.find(drill => drill.id === row?.drillId)
const elapsed = (timer, now) => Math.max(0, timer.elapsedBefore + (now - timer.startedAt) / 1000)
const observedElapsed = (timer, now) => Math.min(86400, elapsed(timer, timer.observed && now - timer.observedAt <= OBSERVED_GAP_MS ? now : timer.observedAt))
const pending = row => row.status !== 'done'
export function createSession(assignment, { id, now }) {
  const snapshot = validateAssignment(assignment)
  requireId(id, 'Session ID'); at(now)
  const rows = snapshot.drills.flatMap(drill => Array.from({ length: drill.sets }, (_, i) =>
    (drill.side === 'each' ? ['left', 'right'] : [null]).map(side => ({
      id: `${drill.id}.${i + 1}.${side || 'both'}`, drillId: drill.id, setNumber: i + 1,
      side, mode: drill.mode, target: drill.mode === 'time' ? drill.durationSec : drill.mode === 'reps' ? drill.reps : null,
      actual: null, status: 'pending', prescriptionMet: false,
    })))).flat()
  return {
    schemaVersion: 1, id, assignmentId: snapshot.id, assignmentRevision: snapshot.revision,
    assignment: snapshot, status: 'active', startedAt: now, endedAt: null,
    rows, currentRowId: rows[0].id, phase: 'ready', timer: null,
    appliedCommandIds: [], lastCompletion: null, lastActionAt: null,
  }
}
function advance(session) {
  const next = session.rows.find(pending)
  session.currentRowId = next?.id || null
  session.phase = next ? 'ready' : 'complete'
  session.timer = null
}
function record(session, row, actual, now) {
  const before = clone(row)
  row.actual = actual; row.status = 'done'
  row.prescriptionMet = row.mode === 'watch' || actual >= row.target
  session.lastCompletion = { rowId: row.id, before }
  session.lastActionAt = now
  const restSec = drillFor(session, row).restSec
  advance(session)
  if (session.currentRowId && restSec > 0) {
    session.phase = 'rest'
    session.timer = { kind: 'rest', ownerRowId: row.id, deadline: now + restSec * 1000, remainingSec: restSec, paused: false }
  }
}
function reconcile(session, now, foreground) {
  const timer = session.timer
  if (!timer) return
  if (timer.kind === 'rest') {
    if (!timer.paused && now >= timer.deadline) { session.timer = null; session.phase = session.currentRowId ? 'ready' : 'complete' }
    return
  }
  if (now >= timer.deadline) {
    if (foreground && timer.observed && now - timer.observedAt <= OBSERVED_GAP_MS) record(session, current(session), timer.target, now)
    else { session.phase = 'review'; timer.observed = false; timer.reviewElapsed = elapsed(timer, now) }
  } else if (foreground && timer.observed) { timer.observedAt = now }
}
export function reduceSession(original, command) {
  if (!original || original.status !== 'active' || command.sessionId !== original.id) return original
  requireId(command.id, 'Command ID'); at(command.now)
  if (original.appliedCommandIds.includes(command.id)) return original
  if (['START', 'DONE', 'STOP', 'ACKNOWLEDGE', 'CONFIRM_REVIEW', 'SKIP_REST', 'PAUSE_REST', 'RESUME_REST', 'ADJUST_REST', 'UNDO'].includes(command.type) && command.rowId !== original.currentRowId) return original
  if (command.rowId != null && command.rowId !== original.currentRowId) return original
  const session = clone(original)
  const row = current(session)
  const now = command.now
  const work = session.timer?.kind === 'work' ? session.timer : null
  let changed = true
  switch (command.type) {
    case 'START':
      if (session.phase !== 'ready' || !row || row.mode === 'watch') return original
      session.phase = 'working'; session.lastActionAt = now; session.lastCompletion = null
      if (row.mode === 'time') {
        const elapsedBefore = row.actual || 0
        session.timer = { kind: 'work', ownerRowId: row.id, startedAt: now, elapsedBefore, target: row.target,
          deadline: now + Math.max(0, row.target - elapsedBefore) * 1000, observed: true, observedAt: now }
        if (elapsedBefore >= row.target) { session.phase = 'review'; session.timer.observed = false; session.timer.reviewElapsed = elapsedBefore }
      }
      break
    case 'DONE':
      if (session.phase !== 'working' || now - session.lastActionAt < GUARD_MS) return original
      if (row.mode === 'time' && (!work.observed || now - work.observedAt > OBSERVED_GAP_MS)) {
        session.phase = 'review'; work.reviewElapsed = elapsed(work, now); work.observed = false
        break
      }
      { const actual = command.actual ?? (work ? elapsed(work, now) : row.target)
        quantity(actual, 'Actual work', row.mode === 'reps' ? 10000 : 86400)
        if (row.mode === 'reps' && !Number.isInteger(actual)) throw new Error('Actual repetitions must be whole')
        record(session, row, actual, now) }
      break
    case 'ACKNOWLEDGE':
      if (session.phase !== 'ready' || row?.mode !== 'watch') return original
      record(session, row, null, now)
      break
    case 'STOP':
      if (session.phase !== 'working' && session.phase !== 'review') return original
      if (work) row.actual = observedElapsed(work, now)
      row.status = 'stopped'; row.prescriptionMet = false
      session.phase = 'ready'; session.timer = null
      break
    case 'TICK':
      if (session.phase === 'review') return original
      reconcile(session, now, true)
      changed = !!original.timer
      break
    case 'RECONCILE':
      if (session.phase === 'review') return original
      reconcile(session, now, false)
      if (session.timer?.kind === 'work' && session.phase === 'working') { session.timer.observed = true; session.timer.observedAt = now }
      changed = !!original.timer
      break
    case 'BACKGROUND':
      if (!work) return original
      if (work.observed && now - work.observedAt <= OBSERVED_GAP_MS) work.observedAt = now
      work.observed = false
      break
    case 'CONFIRM_REVIEW':
      if (session.phase !== 'review' || !work) return original
      quantity(command.actual, 'Confirmed actual seconds')
      record(session, row, command.actual, now)
      break
    case 'SKIP_REST':
      if (session.phase !== 'rest') return original
      session.phase = session.currentRowId ? 'ready' : 'complete'; session.timer = null
      break
    case 'PAUSE_REST':
      if (session.phase !== 'rest' || session.timer.paused) return original
      if (now >= session.timer.deadline) { session.phase = session.currentRowId ? 'ready' : 'complete'; session.timer = null; break }
      session.timer.remainingSec = Math.max(0, (session.timer.deadline - now) / 1000)
      session.timer.paused = true
      break
    case 'RESUME_REST':
      if (session.phase !== 'rest' || !session.timer.paused) return original
      session.timer.deadline = now + session.timer.remainingSec * 1000; session.timer.paused = false
      break
    case 'ADJUST_REST':
      if (session.phase !== 'rest' || !Number.isFinite(command.deltaSec)) return original
      { const remaining = session.timer.paused ? session.timer.remainingSec : (session.timer.deadline - now) / 1000
        const adjusted = Math.max(0, Math.min(3600, remaining + command.deltaSec))
        session.timer.remainingSec = adjusted; session.timer.deadline = now + adjusted * 1000 }
      break
    case 'UNDO':
      if (session.phase === 'working' || session.phase === 'review' || !session.lastCompletion) return original
      { const previous = session.lastCompletion
        const index = session.rows.findIndex(item => item.id === previous.rowId)
        session.rows[index] = clone(previous.before)
        session.currentRowId = previous.rowId; session.phase = 'ready'; session.timer = null; session.lastCompletion = null }
      break
    case 'FINISH':
      if (work) { row.actual = observedElapsed(work, now); row.status = 'stopped'; row.prescriptionMet = false }
      session.status = session.rows.every(item => item.status === 'done' && item.prescriptionMet) ? 'completed' : 'partial'
      session.endedAt = now; session.phase = 'complete'; session.timer = null
      break
    default: return original
  }
  if (!changed) return original
  if (!['TICK', 'RECONCILE', 'BACKGROUND'].includes(command.type)) session.appliedCommandIds.push(command.id)
  return session
}
export function getSessionView(session, now) {
  at(now)
  const row = current(session)
  const drill = drillFor(session, row)
  const timer = session.timer
  const remainingSec = timer?.kind === 'work' ? Math.max(0, (timer.deadline - now) / 1000)
    : timer?.kind === 'rest' ? Math.max(0, timer.paused ? timer.remainingSec : (timer.deadline - now) / 1000) : null
  const types = { ready: row?.mode === 'watch' ? ['ACKNOWLEDGE', 'Mark reviewed'] : ['START', 'Start set'], working: ['DONE', 'Set done'],
    review: ['CONFIRM_REVIEW', 'Confirm elapsed set'], rest: ['SKIP_REST', 'Skip rest'], complete: ['FINISH', 'Finish session'] }
  const [type, label] = types[session.phase]
  return { drill, currentRow: row || null, phase: session.phase, remainingSec,
    elapsedSec: timer?.kind === 'work' ? elapsed(timer, now) : row?.actual ?? 0,
    progress: { done: session.rows.filter(item => item.status === 'done').length, total: session.rows.length, met: session.rows.filter(item => item.prescriptionMet).length },
    allWorkRecorded: session.rows.every(item => item.status === 'done'), prescriptionMet: session.rows.every(item => item.prescriptionMet),
    primaryAction: { type, label }, canUndo: !!session.lastCompletion && !['working', 'review'].includes(session.phase) && session.status === 'active',
  }
}
export function validateSession(session) {
  if (!session || session.schemaVersion !== 1) throw new Error('Unsupported session schema')
  requireId(session.id, 'Session ID'); at(session.startedAt)
  const expected = createSession(session.assignment, { id: session.id, now: session.startedAt })
  if (session.assignmentId !== expected.assignmentId || session.assignmentRevision !== expected.assignmentRevision) throw new Error('Session assignment identity is inconsistent')
  if (!Array.isArray(session.rows) || session.rows.length !== expected.rows.length) throw new Error('Session rows do not match its snapshot')
  session.rows.forEach((row, index) => {
    const target = expected.rows[index]
    for (const key of ['id', 'drillId', 'setNumber', 'side', 'mode', 'target']) if (row[key] !== target[key]) throw new Error('Session row prescription changed')
    if (!['pending', 'done', 'stopped'].includes(row.status) || typeof row.prescriptionMet !== 'boolean') throw new Error('Invalid row result')
    if (row.actual !== null) quantity(row.actual, 'Actual result', row.mode === 'reps' ? 10000 : 86400)
    if (row.mode === 'reps' && row.actual !== null && !Number.isInteger(row.actual)) throw new Error('Actual reps must be whole')
    if (row.status === 'done' && row.mode !== 'watch' && row.actual === null) throw new Error('Completed work needs actual quantity')
    if (row.prescriptionMet !== (row.status === 'done' && (row.mode === 'watch' || row.actual >= row.target))) throw new Error('Prescription completion is inconsistent')
  })
  if (!phases.includes(session.phase) || !['active', 'completed', 'partial'].includes(session.status)) throw new Error('Invalid session state')
  if (session.currentRowId !== null && !session.rows.some(row => row.id === session.currentRowId)) throw new Error('Unknown active row')
  if (!Array.isArray(session.appliedCommandIds) || session.appliedCommandIds.length > 100000 || session.appliedCommandIds.some(id => typeof id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(id))) throw new Error('Invalid command history')
  if (session.lastActionAt !== null) at(session.lastActionAt)
  if (session.status === 'active') {
    if (session.endedAt !== null) throw new Error('Active work cannot have an end time')
    const next = session.rows.find(pending)
    if (session.currentRowId !== (next?.id || null) || (session.phase === 'complete') !== !next) throw new Error('Active row and phase do not match unfinished work')
  }
  if (session.lastCompletion) {
    const saved = session.lastCompletion
    const expectedRow = expected.rows.find(row => row.id === saved.rowId)
    if (!expectedRow || !saved.before || !['pending', 'stopped'].includes(saved.before.status)) throw new Error('Invalid undo checkpoint')
    for (const key of ['id', 'drillId', 'setNumber', 'side', 'mode', 'target']) if (saved.before[key] !== expectedRow[key]) throw new Error('Undo checkpoint prescription changed')
    if (saved.before.prescriptionMet !== false) throw new Error('Undo checkpoint cannot fabricate work')
    if (session.rows.find(row => row.id === saved.rowId)?.status !== 'done') throw new Error('Undo checkpoint must reference recorded work')
    if (saved.before.actual !== null) {
      quantity(saved.before.actual, 'Undo actual', expectedRow.mode === 'reps' ? 10000 : 86400)
      if (expectedRow.mode === 'reps' && !Number.isInteger(saved.before.actual)) throw new Error('Undo actual reps must be whole')
    }
    if (saved.before.status === 'pending' && saved.before.actual !== null || expectedRow.mode === 'watch' && (saved.before.status !== 'pending' || saved.before.actual !== null)) throw new Error('Undo checkpoint result is inconsistent')
  }
  if (session.status !== 'active') {
    at(session.endedAt)
    if (session.timer !== null || session.phase !== 'complete') throw new Error('Finished session cannot keep a timer')
    if (session.status === 'completed' && !session.rows.every(row => row.prescriptionMet)) throw new Error('Partial work cannot claim completion')
  }
  if (session.timer) {
    const timer = session.timer
    if (!['work', 'rest'].includes(timer.kind) || !session.rows.some(row => row.id === timer.ownerRowId)) throw new Error('Invalid timer owner')
    at(timer.deadline)
    if (timer.kind === 'work') {
      if (!['working', 'review'].includes(session.phase) || timer.ownerRowId !== session.currentRowId || current(session).mode !== 'time') throw new Error('Work timer must own current timed row')
      at(timer.startedAt); at(timer.observedAt); quantity(timer.elapsedBefore, 'Elapsed checkpoint')
      if (timer.deadline !== timer.startedAt + Math.max(0, timer.target - timer.elapsedBefore) * 1000) throw new Error('Work deadline is inconsistent')
      if (timer.target !== current(session).target || typeof timer.observed !== 'boolean') throw new Error('Invalid work timer')
    } else {
      if (session.phase !== 'rest' || typeof timer.paused !== 'boolean') throw new Error('Rest timer needs rest phase')
      quantity(timer.remainingSec, 'Remaining rest', 3600)
      if (session.rows.find(row => row.id === timer.ownerRowId).status !== 'done') throw new Error('Rest must belong to recorded work')
    }
  } else if (session.phase === 'rest' || session.phase === 'review' || session.phase === 'working' && current(session)?.mode === 'time') throw new Error('Timer phase needs a checkpoint')
  return clone(session)
}
