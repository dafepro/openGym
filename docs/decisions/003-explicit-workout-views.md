# 003 — Explicit workout views and a shared header

Accepted 2026-10-10. Updates Finish placement from the earlier Focus bottom rail.

Keep the existing workout header: session name, elapsed time, set count, options, Finish and
progress. Replace the target icon with an additional full-width segmented control immediately
below the progress line. Its two equal buttons read “Workout details” and “Focused”, indicate
selection visually and through aria-pressed, and remain in the same position in either view.
Use the existing Uplift sliding selection animation and reduced-motion behavior.

Workout details returns to the most recently selected Cards, List or Compact layout; the Layout
menu remains available for choosing those presentations. Pin the header in every live layout
so Finish and the view switch remain available while scrolling. Saved-workout editing keeps its
existing Close and Save controls; backfilled workouts do not offer Focus.

Focus Finish belongs to the shared header, opening the existing finish/discard sheet without
a duplicate in the bottom rail.
The Focus bottom rail retains its exercise overview and current next action, plus nearby phase
controls for warm-up skipping, timed work and rest. Switching layouts changes presentation only:
it closes Focus disclosures without logging sets, moving the cursor, resetting preparation or
skipped warm-ups, stopping timers, or changing their completion callbacks.

No schema, storage, sync or workout-history changes. Regression checks cover the remembered
details layouts, single header Finish, running timed-set ownership, and paused rest with skipped
warm-ups and preparation preserved across view changes.
