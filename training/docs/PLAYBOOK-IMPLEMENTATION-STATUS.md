# Playbook implementation — 2026-11-04

Branch: `codex/playbook-practice-flows`. Local implementation and browser review;
no push, remote workflow run, or deployment has occurred.

## Implemented

- Approved Concept C direction: warm paper, serif practice titles, enclosed
  whole-practice plans, numbered drill strips, compact media thumbnails, and
  persistent Practice / Me navigation.
- Assigned practice starts the first drill and its work clock in one action.
  Explicit Resume resolves against the controller's serialized state. Demo,
  exit, and Back pause work. Actual time and reps are preserved; final manual
  completion saves once.
- Rectangular two-row work dock: right Play/Pause, left Exit, right state-aware
  forward, timer or actual-rep control, rest and correction actions.
- Contextual Add / Swap catalog, whole Saved / Recent practice choices,
  organizer targets/reordering/removal Undo, optional player note, exact player
  preview, and versioned practice sharing without an access password.
- Setup-aware random practice with history reinforcement, coverage, shuffle,
  video filtering, and explicit handling of unlisted space requirements.
  Start appears before the proposal's drill list, including compact screens.
- Reusable personal drills: elapsed time, timed sets, reps, setup, instructions,
  canonical/freeform labels, edit/cancel/delete, and immutable recorded history.
  Recording means athletic-work tracking; filming/upload is not implemented.
- Continuous incoming/outgoing content motion, persistent navigation, animated
  disclosures in both directions, play/pause and mute icon transitions,
  reduced-motion support, and nested-dialog scroll/focus cleanup.
- Muted autoplay on thumbnail activation, custom media controls, repeat handles,
  and a stable help overlay that does not move the drill instructions.

## Browser-discovered fixes

- Removed a hidden 600ms completion guard that silently ignored valid quick
  Finish taps. Session/row ownership, command IDs, and an immediate UI guard
  retain duplicate-completion protection.
- Successful Pause UI is published after IndexedDB commits, so immediately
  reloading a visibly paused drill does not restore a running clock.
- Back followed quickly by Resume now waits for the pending pause write and
  resumes the latest committed state; it no longer consults a stale render.
- Filled the dock status strip vertically; widened landscape help footage and
  reserved space for Undo/rest controls; tightened form/organizer spacing.
- Added the custom pitch-and-route brand mark/favicon, warm browser theme color,
  subtle paper/control shadows,
  consistent card edges, inset row dividers, and a proper practice-link icon.
  The header keeps its original height; the active context title is capped at
  two lines while the full drill instructions remain available.

## Validation

Isolated headless browsers were explicitly authorized and used. Chromium and
WebKit ran with fresh browser storage, synthetic API/media fixtures, and mobile,
desktop, compact, landscape, and reduced-motion configurations. This does not
claim physical-device testing. The final E2E totals are recorded in the visual
acceptance report and browser HTML report.

- 264 app tests in 30 files, including 15 connected React/controller/storage
  journeys; 21 worker tests; 4 content tests; 6 private-preview tests; 12 release and
  source-notice tests passed. The private-preview suite requires loopback access.
- Production build, dependency-boundary validation, and no-sample-content build
  check passed.
- Final browser run: 64 active cases passed (36 user flows, 12 motion, 12 media
  and recovery, 4 layout stress). Eight inapplicable stress/project combinations
  are deliberately skipped. Actual browser screenshots were visually reviewed.
- Browser tests cover muted real playback, actual reps/time, personal drill
  persistence/edit/delete, immutable history, sharing into a fresh context,
  setup-compatible random mixes, active discard, completed deletion, nested
  dialogs, and repeated navigation/tap responsiveness.
- Motion samples verify intermediate nav translation on show/hide; persistent
  navigation during tab changes; overlapping forward/back drill transitions;
  stable dock identity/opacity; inert outgoing visuals; and complete cleanup.

Actual screenshots use the original four-video private bundle in isolated
browser contexts. They are retained outside the Git checkout in the workspace's
`docs/quality/playbook-2026-11-04/screenshots` folder. No private footage, catalog,
access data, or trainer content is committed. The screenshot harness accepts an
explicit approved local bundle and output path via environment variables.

The user approved deployment. Release checks must pass before the reviewed source
is published and selected through the existing GitHub Actions deployment flow.

Release validation also covers preserving explicit mute intent through native
rate/seek resets and retaining native fullscreen audio controls. The test browser
is pinned to Playwright 1.63.0 while the Linux 1.64.1 rendering regression is avoided.
