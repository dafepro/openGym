# Training domain and persistence contract

This code is isolated from openGym stores and integrations. It adapts the inspected Focus principles (single controller owner, stable identity, actual versus target quantities, side tracking, rest independent of work) into pure soccer-session commands. No trainer content is included: `fixtures/catalog.js` is visibly synthetic software-test data. Production code must fetch real catalogs from the authenticated catalog endpoint rather than import fixtures.

## Public exports

`src/domain/index.js` exports `validateCatalog`, `validateAssignment`, `selectCurrentAssignment`, `createSession`, `reduceSession`, `getSessionView`, and `validateSession`.

A catalog has `{schemaVersion:1, revision, synthetic?, currentAssignmentId, currentAssignmentRevision?, assignments}`. Each assignment is `{id, revision, title, assignedOn?, status:'current'|'archived', drills}`. Assignment editions are unique by ID/revision pair; when the same logical ID has multiple editions the current revision must be explicit. `selectCurrentAssignment(catalog)` validates and returns a clone of the deliberately selected current edition. Old archived editions remain readable and can create a new attempt.

Each drill occurrence has its own stable `id`, `title`, `instructions`, `mode:'reps'|'time'|'watch'`, positive integer `sets`, `side:'both'|'each'`, `restSec:number|null`, and `media:{id,status:'approved'|'unavailable',path?}`. Reps requires positive integer `reps`; time requires positive `durationSec`. Watch is one review with no sides or athletic quantity. Null rest means not supplied, zero means prescribed no rest; neither invents a countdown. Approved paths must equal `/media/<media.id>` without traversal; the Worker separately checks manifest authorization. IDs do not authorize a resource. Other unsupported units must fail validation rather than be guessed/coerced. Catalog, assignment, drill and media fields are explicit allowlists: reject operator metadata and unsupported poster/caption fields instead of forwarding arbitrary URLs. Parent publication tooling must project a child-safe payload; add future poster/caption endpoint support through a reviewed schema change.

```js
const assignment = selectCurrentAssignment(catalog)
let session = createSession(assignment, { id: crypto.randomUUID(), now: Date.now() })
const view = getSessionView(session, Date.now())
session = reduceSession(session, {
  type: 'START', id: crypto.randomUUID(), sessionId: session.id,
  rowId: view.currentRow.id, now: Date.now(),
})
```

`createSession` takes a full cloned assignment snapshot. Each row is `{id,drillId,setNumber,side:null|'left'|'right',mode,target,actual:null|number,status:'pending'|'done'|'stopped',prescriptionMet:boolean}`. `each` produces independent left/right rows for each set. Repetition values are per side, not doubled totals. Changing current selection or catalog content never changes that session snapshot. `createSession` with a new ID is also the explicit repeat operation; never reuse an old session ID.

Session fields include `{schemaVersion:1,id,assignmentId,assignmentRevision,assignment,status:'active'|'completed'|'partial',startedAt,endedAt,rows,currentRowId,phase,timer,appliedCommandIds,lastCompletion,lastActionAt}`. Phase is `ready|working|review|rest|complete`. Active `complete` means all rows have a recorded outcome and the user still needs to finish/save the session. A final session is immutable; commands return it unchanged. Finishing early results in `partial`. “Done” and “prescription met” are separate: actual work below target is recorded honestly but cannot earn a fully completed prescription/session.

## Commands and ownership

All commands carry a stable unique `id`, matching `sessionId`, and finite millisecond `now`. User commands should capture `rowId` at render/action creation, not retarget a queued callback to whichever row is current later. START, DONE, STOP, ACKNOWLEDGE, CONFIRM_REVIEW, rest actions and UNDO require matching current-row identity. FINISH and clock/visibility commands are session-scoped. Unknown/stale/duplicate commands return the original object; invalid quantities throw an actionable validation error. The caller preserves the current session on failure.

- `START`: ready → working; the timed work timer starts only on this gesture. Reps also has an explicit working phase. Immediate DONE within 600ms is ignored to avoid Start→Done double taps.
- `DONE {actual?}`: records reps (default prescribed reps) or actual timed elapsed. An explicitly entered actual must be nonnegative and reps must be whole. Early timed Done keeps `prescriptionMet:false` where appropriate. When observed timing evidence is interrupted, DONE enters review instead of granting automatic credit.
- `ACKNOWLEDGE`: watch-only ready item → reviewed, with null athletic actual. It never creates a work timer.
- `STOP`: working/review → ready with observed partial actual and stopped status; no credit/rest. Unobserved wall time is excluded, including when stopping from review. Starting again continues observed partial elapsed toward the original target; if stored elapsed already reaches the target, Start enters explicit review rather than granting implicit credit.
- `TICK`: the single continuously mounted controller dispatches this only while visible. Healthy foreground ticks with gaps no larger than 2.5 seconds complete the timed row once at the prescribed target. A larger gap at expiry conservatively enters review. A paused rest stays frozen.
- `BACKGROUND`: dispatch at page hide; marks work unobserved. Subsequent ticks cannot restore observation.
- `RECONCILE`: dispatch after loading persisted state and on visibility return. Expired work → `review` without credit or rest. Work not yet expired resumes observation. Expired rest → ready, never starts work.
- `CLOCK_CHANGE {previousNow,clockShiftMs,clockRevision}`: the monotonic adapter supplies a finite old/new epoch relationship and the expected clock revision. Rebase the gesture guard and preserve remaining rest on backward shifts; forward sleep may expire rest. Timed work becomes review with only observed evidence, never completion credit. Optional snapshot `clockRevision` defaults to zero for older version-1 records and prevents a queued epoch change from being applied twice. Reloading without a monotonic anchor uses the last known checkpoint and never expands rest beyond its known remainder.
- `CONFIRM_REVIEW {actual}`: the user explicitly confirms actual seconds; only then record the owned row once and enter prescribed rest/next preparation. Offer timing evidence but do not silently submit wall-clock duration as actual.
- `SKIP_REST`, `PAUSE_REST`, `RESUME_REST`, `ADJUST_REST {deltaSec}`: rest only. Adjustments are bounded 0–3600 seconds. None records work. Pausing an already expired rest makes it ready.
- `UNDO`: when not working/reviewing, restore only the latest recorded row and cancel its associated rest; stale identity cannot affect another row. Starting another work set disables undo until that set has its own result.
- `FINISH`: save a final completed/partial result with end time; no confirmation UI is owned here. Opening/canceling the UI confirmation must never dispatch FINISH. An active timed row preserves only observed foreground elapsed as stopped partial actual; unobserved wall time is excluded. This starts no rest or completion credit. Unrecorded repetitions remain unrecorded.

`getSessionView(session, now)` returns `{drill,currentRow,phase,remainingSec,elapsedSec,progress:{done,total,met},allWorkRecorded,prescriptionMet,primaryAction:{type,label},canUndo}`. It does not mutate state or own callbacks. Keep media state separate. A countdown ticking is not a reason to recreate video or transition ownership. Native audio/background alarms are not promised.

## Atomic local state

`src/storage/index.js` exports `createTrainingRepository`, `emptyProgress`, `validateProgress`, `exportProgress`, `parseProgressExport`, `mergeProgress`, `ProgressConflictError`, and `DATABASE_NAME`.

The native IndexedDB database is `quicktrack-training`, version 1, store `progress`, key `state`. The one stored record is `{schemaVersion:1, revision:0, activeSession:null, sessions:[]}`. Active session/timer checkpoints are written atomically together. There is no automatic import, read, delete or migration of openGym/Uplift keys. V1 is defined directly; unknown future schemas fail safely and preserve stored bytes.

```js
const repository = createTrainingRepository() // optional { indexedDB, name } for tests
let state = await repository.load() // emptyProgress() on a fresh database
state = await repository.save({ ...state, activeSession: session }, state.revision)
// On FINISH move the final session to history and remove active in one save:
state = await repository.save({ ...state, activeSession: null, sessions: [...state.sessions, finished] })
const backup = exportProgress(state, { now: Date.now() }) // private JSON for explicit download
const imported = parseProgressExport(fileText)
state = await repository.save(mergeProgress(state, imported))
await repository.close()
```

Save resolves only after transaction completion and returns the incremented revision. A write/open/quota/validation error rejects: show save failure, retain the in-memory work for retry/export, and do not present it as saved. The per-instance queue serializes operations. Revision comparison occurs inside the write transaction across tabs; a stale writer gets `ProgressConflictError` rather than overwriting work. The UI must enter a conflict/read-only recovery state instead of repeatedly retrying stale writes. This is optimistic conflict protection, not an expiring cross-tab ownership lease; the app shell may additionally use Web Locks to enforce one active controller.

Saved history and the assignment snapshot of the same active session cannot be silently rewritten. Export contains private session snapshots and no hosted video bytes. Restore merges distinct session IDs, treats equal existing records as idempotent, and refuses conflicting history or replacement of different active work. It does not silently reset storage. Keep a user-held export before any deliberate recovery that replaces data. Parsing is bounded to 10 MiB and validates snapshots, quantities, statuses and timer ownership.

## Verification

The colocated Vitest tests cover deliberate edition selection, invalid media/quantities, snapshot isolation, reps/side/zero actuals, foreground and interrupted expiry, reload/rest readiness, early Done/Stop, stale/duplicate actions, watch review, a full synthetic multi-drill flow, native IDB round trips/concurrent stale writes, immutable history, unavailable storage, and safe export/import conflicts. They use fake-indexeddb only as an upstream-aligned test dependency. Real browser/device playback, sleep/reload behavior and touch input remain integration/device checks owned by the coordinator; these tests do not claim those gates passed.
