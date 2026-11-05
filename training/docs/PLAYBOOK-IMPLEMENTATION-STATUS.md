# Playbook implementation checkpoint — 2026-11-04

Branch: `codex/playbook-practice-flows`. Local implementation only; no push,
remote workflow run, or deployment has occurred.

## Implemented

- Approved Concept C direction: warm paper, serif practice titles, enclosed
  whole-practice plans, numbered drill strips, compact media thumbnails, and
  persistent Practice / Me navigation.
- Assigned session starts the first drill and its work clock in one action.
  Explicit Resume resumes work and navigates in one action. Demo/exit/back pause
  work. Actual time and reps are preserved; final manual completion saves once.
- Rectangular two-row work dock with right-side Play/Pause, left Exit, right
  state-aware forward, timer or actual-rep control, rest and correction actions.
- Contextual Add / Swap drill catalog, whole Saved / Recent practice choices,
  organizer targets/reordering/removal Undo, optional player note, exact player
  preview, and versioned practice sharing.
- Setup-aware random practice with history reinforcement, coverage, shuffle,
  video filtering, and explicit handling of unlisted space requirements.
- Reusable personal drills: elapsed time, timed sets, reps, setup, instructions,
  canonical/freeform labels, edit/cancel/delete, and immutable recorded history.
  Recording means athletic-work tracking; filming/upload is not implemented.
- Continuous incoming/outgoing content motion, persistent navigation, animated
  disclosures in both directions, play/pause icon transitions, row reordering,
  reduced-motion support, and nested-dialog scroll/focus cleanup.

## Checks actually executed

- `npm run test:all`: passed. 255 app tests in 29 files, including 12 connected
  React/controller/storage journeys; 21 worker tests, 4 content tests, 6 private
  preview tests, and 12 release/source-notice tests also passed.
- Production build and no-sample-content check: passed.
- `git diff --check`: passed.
- Browser suite collection: 36 cases across Chromium mobile/desktop, WebKit
  mobile, reduced motion, 320px compact and short landscape. Collection passed.
- GitHub Actions validation workflow parsed; browser job is read-only, uses
  synthetic fixtures, and retains review screenshots/traces. Not run remotely.

## Still required before visual sign-off

Browser execution and actual screenshots have not happened. The computer-use
surface reports `Local browser use is disabled in Work settings`; the Mac was
also locked. An explicit choice to enable that surface or use isolated headless
Playwright browsers is pending. Virtual-DOM tests are not a substitute for real
layout, hit testing, muted playback, or animation verification.

Use `../../docs/playbook-visual-acceptance-2026-11-04.md` for the visual matrix.
Run and inspect the E2E suite, then inspect the real four-video assignment at the
same portrait/compact/landscape sizes. Pay particular attention to the active
help sheet leaving the work dock visible, fast route reversals, modal cleanup,
long titles/notes, five-digit counts, large text, and all navigation visibility
transitions. Correct and rerun affected checks before presenting screenshots.

The existing private local preview uses port 4183; its bundle stays outside the
Git checkout. No private footage, access data, or trainer content is committed.
Deployment still requires the user's go-ahead after review.
