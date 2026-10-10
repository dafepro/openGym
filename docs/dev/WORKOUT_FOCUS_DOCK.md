# Workout focus dock

The floating target button opens a focused workout panel, inspired by Uplift's workout dock.
The button becomes Close without moving. Details, exercises, load, extra set fields and finish
each use a fixed icon in the rail; tapping the icon again closes its pane in the same place.

The main action stays at the lower right. An exercise's first visit shows its current load
and configured rest, then Start opens set entry. Editing reps or load never completes a set.
Done records only the current unfinished set or side. During recovery this position offers
Skip, then Next when ready; neither records anything. Timed sets use the existing work timer
and record elapsed time through its existing callback. Closing the panel keeps timers running.
The exercise load check is remembered for the live session across route navigation, using
ephemeral UI state. A new session (or reload) offers the check again.

The workout view and dock share the same handlers for completion, weight provenance and
cascading, unilateral sides, supersets, rest, and saving. The dock does not change the session
schema, seed loads from history, or introduce another workout controller. The floating control
on other routes returns to the saved workout and opens its panel. Historical editing and
backfill keep their existing controls.

The dock is portalled outside the animated route container. It replaces the legacy timer's
presentation only while the workout dock is mounted; the timer engine remains in `useUI`.
The open panel traps focus and makes the underlying workout inert. Escape closes an open
pane first, then the panel. Reduced motion disables panel and phase animation.

Regression coverage lives in `frontend/src/components/WorkoutFocusDock.test.jsx`. Check the
full frontend suite, production build, locale coverage, and layouts at 320px, 390px and desktop
before changing this flow.
