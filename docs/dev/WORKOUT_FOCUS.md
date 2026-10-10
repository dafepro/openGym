# Workout focus workspace

The focus workspace uses openGym's live workout controller and set rows. It changes
presentation and navigation without introducing a second workout model or a new
storage format. The controller stays mounted across app routes so a hold started in
the workout can be completed from Home with the same owner and elapsed time.

## Rail and navigation

- Left: **Workout / Live** switches two flat views.
- Center: the current **Start / Done / Pause / Resume / Next set** action stays in
  the same slot, including while an editor or Workout view is open.
- Right: **Focus / Minimize** opens and closes the workspace at the same coordinates.
- Details, load, effort and last-set correction expand inline. The same button closes
  its disclosure. The timer remains pinned above the scrolling content.
- Browser Back, Android Back and Escape unwind a disclosure, then Workout to Live,
  then minimize focus. A sheet owns Back before any focus layer does. After a session
  finishes, spent focus and sheet markers are skipped rather than creating empty Back steps.
- Finish lives in Workout and opens openGym's existing finish sheet. That sheet
  temporarily hides the entire focus workspace and returns ownership when dismissed.

## Review findings addressed

| Finding | Implementation |
| --- | --- |
| Rest blocked useful edits and offered no undo | Next-set load and duration remain editable during rest. Last set corrects the completed row, including optional effort, with explicit Undo. Only that row's rest is stopped by Undo. |
| Load and prescription meanings were lost | Added, Each and Both labels use the existing load rules. Side rows, Max, drops and rest-pause bursts retain their existing fields and calculations. |
| Back bypassed focus | A same-URL history entry owns the workspace; native Back uses the same UI dismissal hierarchy. Sheet rewinds and fast reopen are covered by regression tests. |
| Opening and closing moved the anchor | One persistent right-hand toggle replaces the former separate launcher. Opening from Home keeps the route. Rest no longer changes the rail's bottom offset. |
| Detail views removed the next action and timer | Inline disclosures and Workout keep the center rail action. The countdown and real progress bar remain above the scroll area. |
| Load appeared static; rep ring implied false progress | The load row has an icon, disclosure chevron and expanded state. Reps are an editable number with direct steppers. Timer progress represents actual remaining time. |
| Preparation showed the wrong rest | Preparation and Details use the same pyramid, warm-up and superset rest helpers as the workout controller. |
| Narrow rail was crowded | Three controls, 48px or larger targets, generous separation and secondary Finish in Workout. The rail has been inspected at 320px. |
| Transitions lost ownership and continuity | Incoming and outgoing content crossfade for 180ms; disclosures expand and collapse for 200ms. The rail button DOM persists. Reduced motion disables transitions. Outgoing snapshots are inert and do not retain duplicate IDs. |

## Data and validation

Edits call existing entry handlers, including weight-origin tracking and cascades.
Logging, rest, advancement and timed completion use the existing controller. Optional
effort remains absent until entered; zero reps and zero RIR remain meaningful values.
Editors validate session, exercise, row and completion identity before writing. An
open last-set editor does not silently retarget when another set completes.

Regression coverage includes side completion, effort zero/clearing, rest preservation,
undo, stale and duplicate taps, intensifiers, warm-up/pyramid rest, sheet/history
ownership, keyboard focus and timed holds completed after navigating to Home.

Browser checks cover the rail at 320px and 390px, inline editing during paused rest,
real Back navigation, finish-sheet dismissal, timed Stop/Done and opening on Home.
Physical iOS/Android keyboard animation and frame pacing still need device testing.
