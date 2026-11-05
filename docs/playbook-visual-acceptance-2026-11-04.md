# Playbook visual acceptance

Status: **scoped browser and visual review passed** on 2026-11-04. Reference:
the approved Concept C `concept-v2.png` in the workspace design folder. The
original four-video assignment and populated profile charts were visually
reviewed in isolated headless browsers with explicit user authorization.

## Executed evidence

- Final browser matrix: 64 active cases passed; 8 inapplicable stress/project
  combinations deliberately skipped. Includes 36 user-flow cases, 12 real-frame
  motion checks, 12 native-media/recovery cases, and 4 layout-stress cases.
- Chromium and WebKit, mobile and desktop, 320×740 compact, 844×390 landscape,
  reduced motion; additional 320×568 boundaries and 200% desktop CSS zoom.
- Actual private-video harness: 35 screenshot states across 390×844, 320×740,
  844×390 and 1280×900. No positive horizontal overflow. Active help clears the
  landscape dock by 12px, both with and without Undo controls.
- Visually reviewed assigned plan, whole-practice chooser, organizer/player
  preview, compact active drill and dock, muted video, repeat handles, random
  mix, personal-drill setup/recording/recap, populated Me/skill mix, and calendar.
- Screenshots and a size-switching gallery remain outside Git at workspace
  `docs/quality/playbook-2026-11-04/`. Browser report and raw motion/media samples
  are in `training/.playwright/` (ignored by Git).
- 258 app tests, 21 worker tests, 4 content tests, 6 private-preview tests and 12
  release/source tests passed. Production build/boundary/no-sample checks passed.

## Review changes

The browser pass fixed valid fast Finish taps being ignored, Pause persistence
on immediate reload, and Back→Resume during a delayed write. Visual refinement
added a custom pitch-and-route mark/favicon, quiet paper shadows and highlights,
inset row rules, refined controls, compact form spacing and an upper landscape
video layout with full repeat controls. Random Start moved before its drill list.

The following checklist documents the reviewed intent. Hardware phone behavior,
OS text scaling, and actual browser-menu zoom were not exercised; the 200% fixture
is specifically CSS zoom stress. Screenshot captures establish layout; the
separate native-video, hit-testing and frame-sampling cases establish behavior.

## Review fixtures

Used the original four-video practice and a temporary 12-drill boundary fixture.
The boundary fixture includes 240-character titles and a 500-character parent
note with unbroken words. Browser cases exercise 10,000 reps and a 24-hour target
(`1440:00`, or 86,400 seconds). Actual screenshots include an empty profile and
labeled personal-drill history. Synthetic user-flow cases also preserve actual
reps, timed work, and immutable earlier instructions.

## Viewports

| Configuration | Acceptance focus |
| --- | --- |
| 390 × 844 portrait | Assigned tab touches the paper outline; Start appears before the note and numbered drills. Compact QuickTrack/Organizer header. Drill titles, 64 × 48 thumbnails, and orange action form a clear hierarchy. Practice/Me remains fixed without covering content. |
| 320 × 568 compact | No body overflow. Title and thumbnail remain separate and readable. Numeric field shows all five digits; plus/minus remain 44 px targets. `1440:00` does not collide with Start/Pause; the readiness hint may wrap beneath it. Random setup, own-drill saved-row actions, and organizer controls stay usable. |
| 844 × 390 landscape | Dock uses its two-column arrangement, keeps timer and exit/advance visible, and leaves scrollable instructions above it. Video dialog keeps all controls reachable. Long drill rail scrolls internally, never the page. |
| 1280 × 900 desktop | Content remains centered at 640 px maximum; warm full-width bottom navigation has a centered inner region. Active dock centers independently. Hover/focus states remain visible and there are no legacy dark panels outside the video canvas and dock's center strip. |
| Large layout | The executed 200% desktop CSS-zoom fixture keeps numeric fields and essential dock actions reachable. Actual browser-menu zoom and OS text scaling remain outside this review; no claim is made for those settings. |
| Reduced motion | Repeat Practice ↔ Me, practice start/exit, next/back drill, all disclosures, and video open/close. State changes remain immediate and usable; page slides, shimmer, icon transitions, and disclosure motion stop. |

## Shared visual gates

- **Whole practice versus drills:** My practices lists whole sessions. A selected session encloses its numbered drills. Add/Swap drills appears only while arranging a practice. Surprise me and My own drill stay secondary to the assigned Start action.
- **Active work:** the serif drill title and small help thumbnail lead; setup, instructions, targets, and set progress remain readable. The work dock stays in place through ready, working, paused, rest, review, and complete states. Exit is red on the left; advance is green on the right; play/pause is on the right of the readout.
- **Long content:** Start remains ahead of the 500-character note. Full note text wraps without horizontal scrolling. A rail over six drills scrolls internally and reveals the current drill. Long practice/skill names do not widen cards or hide neighboring controls.
- **Motion and layers:** capture navigation at start/middle/end. Visible-to-visible tab changes keep the same bar visible; entering/exiting active work slides it cleanly. No duplicate interactive layers, flashing final state, stale modal backdrop, or dead tap regions. Rapid reversal and repeated open/close remain safe.
- **Video:** thumbnail starts the intended video muted, in a stable modal. Custom mute, play/pause, fullscreen, scrubber, and repeat handles are usable. Closing returns to the same drill and scroll position. No instruction content shifts when opening help.
- **Profile/history:** populated week bars, calendar, skill mix, and history remain visible and correctly colored. Empty/unlabeled history retains its time/history entries without an empty skill panel. Tapping chart days, history, and delete confirmation works repeatedly.
- **States:** loading shimmer is warm and quiet; errors have a clear retry action. Preview, empty, unavailable-video, saved, disabled, and keyboard-focus states share the paper palette and avoid bright text on bright orange.

## Evidence to retain

Capture assigned practice, active timer, active reps at 10,000, random setup/proposal, own-drill tracking, organizer with disclosure open, and populated Me. Add compact and landscape examples. Record short transition clips or a sequence of frames for tab switching, drill forward/back, disclosure closing, and navigation disappearing/reappearing. Mark failures with viewport, state, and reproduction steps; screenshots alone do not establish tap or motion correctness.

## Source fixes applied before browser review

- Repetition/confirmed-seconds field now uses six character widths instead of an 80 px input inside a 66 px label; +/- targets retain their width.
- Readout hints may wrap beneath long timer values; captions may grow beyond a fixed 18 px line.
- Parent note stays after Start and wraps long text; organizer note field has separate spacing.
- New own-drill row actions stay compact; delete action uses subdued danger text. Profile charts remain intact.
