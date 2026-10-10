# Workout Focus layout

Focus is the live workout page's current-step layout. It uses openGym's existing
`workoutView: 'focus'` preference and session override. Cards, List and Compact remain
available. The header layout toggle enters Focus and returns to the preceding layout;
Workout options → Layout and the saved workout settings offer the same choice.
Historical editing and backfill retain their detailed set controls.

## Navigation and action ownership

The app's bottom tabs stay visible on the workout page. Home, Plan, Stats and Exercises
leave the page without ending the session; the center Workout/Resume tab returns to it.
The center tab turns blue only during a running or paused rest. A smooth ring shows
actual rest progress and freezes while paused. Lifting, timed work and rest completion
restore the original orange active-session pulse. An idle tab, historical editing and
backfill keep the normal appearance; the tab always keeps its Workout/Resume label.
Reduced motion suppresses the pulse.
There is no top Minimize button, floating launcher, scrim or modal focus trap.

The current action occupies one fixed position above the app tabs. It changes through
load check → set entry → rest → the next pending set or completion. Timed sets retain
Start, Done and Stop with their existing elapsed-time semantics. Rest retains explicit
adjustment and skip controls and never records a set. Skip rest is the primary action;
Pause/Resume stays between the time adjustments in the same press position.
Warm-up bypass, Pause/Resume, time adjustments, Stop and Undo are grouped directly
above the primary action in the bottom thumb rail. Workout/Live, the current action
and Finish occupy three fixed positions when secondary actions change.
Workout/Live toggles the exercise overview from the same position, while the current
action and timer remain available.
Finish stays visible at the right of the rail throughout preparation, sets, timed work,
rest, disclosures, overview and completion. It opens the existing finish confirmation;
opening or canceling it never logs a row or stops an active timer. Sheets retain their
own action ownership. Completion makes Add exercise the main action while keeping
the same Finish anchor, without duplicate Finish controls.

Details, load, effort and last-set correction expand inline from their own buttons.
Details grows below its fixed header anchor instead of recentering the whole page.
Closing uses the same trigger; there is no second X or Back control. Browser/Android
Back and Escape close a disclosure or overview first. The base Focus layout is the
workout route and does not create a separate history entry. Sheets own Back before
inline details, and spent sheet/detail history entries are skipped automatically.

## Existing review improvements preserved

- During rest, edit the next load/duration or correct and undo the previous set without
  restarting rest or checking another row. Undo stops only its own set's rest.
- Added/Each/Both load meanings, independent sides, Max, drops and rest-pause bursts
  use the existing workout fields and training helpers.
- Preparation shows the actual warm-up, pyramid or superset rest. It is acknowledged
  once per exercise/session in presentation state; a reload offers it again.
- Warm-up preparation and pending warm-ups offer Skip warm-ups. It bypasses the
  remaining warm-ups for Focus navigation, including superset and completion decisions.
  Original rows, completed warm-ups and earned rest are untouched. The bypass is
  presentation state for this session and can be offered again after reload. Cards/List
  still show the original unrecorded rows; no warm-up is fabricated in history.
- Centered, larger accent-colored reps and a subtle breathing spotlight distinguish
  Focus. The spotlight is decorative; reduced motion freezes it.
- Load is an explicit disclosure; reps are editable with direct steppers. Only actual
  countdowns have progress indicators. Redundant target copy is omitted.
- The main action persists through overview/disclosure changes. Secondary details
  disappear until requested; preparation contains only the load check and rest.
- Incoming/outgoing content crossfades for 180ms. Disclosures expand and collapse;
  outgoing content is inert, inaccessible and has no duplicate IDs. Reduced motion
  removes the animation. Timer ticks do not restart a phase transition.

## Data and validation

The workout controller remains mounted across routes, preserving the original owner
of timed callbacks. Focus is mounted only while its layout is visible. Other routes
and layouts use the existing rest bar. Logging, load provenance/cascades, rest,
advancement and saving share the normal workout handlers; no storage schema changes
or historical load seeding are introduced.

Editors validate session, exercise, row and completion identity before writing. An
open last-set editor does not silently retarget when another set completes. Optional
effort remains absent until entered; zero reps and zero RIR remain meaningful. Short
activation guards prevent Start→Done, rest→Done and superset double-tap accidents.

Regression checks cover current-step logging, sides, intensifiers, optional effort,
rest editing/undo, stale and duplicate taps, prep/rest calculations, keyboard phases,
warm-up bypass and advancement, navigation timer/pause progress, active-session tab
signals, persistent Finish access and cancellation, layout switching, Back/sheet ownership
and timed holds across Home/Resume navigation.
The older detailed Focus tests apply to historical/backfill workflows. Browser QA uses
an isolated guest profile and checks phone/desktop layout, fixed tab positions,
inline disclosure anchoring, rest correction and Back navigation. Physical phone
keyboard behavior and animation frame pacing still need device testing.
