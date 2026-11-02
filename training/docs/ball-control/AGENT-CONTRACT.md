# Implementation contracts

All paths below are relative to `training/`. No new runtime dependency needed.
Coordinator owns existing files outside `src/ball-control/`.

## Curriculum

`src/ball-control/curriculum.js` exports `BALL_CONTROL_DRILLS`, an array of:

```js
{ id: 'bc-side-roll', title: 'Side-to-side sole rolls', summary: '...',
  setup: ['...'], instructions: ['...'], cues: ['...'], commonMistakes: ['...'],
  tracking: { kind: 'alternating-zones', axis: 'horizontal', metricLabel: 'Target arrivals' },
  suggestedSeconds: 30, videoId: 'bc-side-roll-front-v1', promptId: 'bc-side-roll' }
```

Eight stable IDs: `bc-side-roll`, `bc-push-pull`, `bc-toe-taps`,
`bc-inside-touches`, `bc-v-pull`, `bc-l-pull`, `bc-inside-outside`, `bc-stepover`.
Only first two have `alternating-zones` (second axis `vertical`); other drills use
`{ kind: 'none', metricLabel: 'Manual repetitions' }`. Suggested 30 seconds is an
editable app default, not a coach prescription. Media is pending unless resolved
as approved from the existing catalog. Do not include public video URLs.

## Vision (pure functions, no DOM)

`src/ball-control/vision/tracker.js`:

- `sampleBallColor(imageData, point)` where point `{x,y}` is normalized 0..1.
  Returns a serializable color profile or throws an actionable Error for invalid
  or unsuitable color. The vision agent owns the profile internals.
- `detectBall(imageData, profile, previous = null)` returns `null` or
  `{x,y,radius,confidence}` with normalized image coordinates (radius relative to
  image width), confidence 0..1. Never return predicted-only points as detections.

`src/ball-control/vision/targets.js`:

- `validateTargets(targets)` returns boolean. Exactly two separated targets
  `[{x,y,radius}, {x,y,radius}]`, normalized; radius relative to image width.
- `createTargetCounter(targets, options = {})` returns `{update, reset}`.
- `update(detection, timestampMs)` returns `{count, expectedTarget, tracking}`.
  Tracking is `tracking`, `lost` or `acquiring`. First stable observed target arms
  the counter; the next opposite-target arrival earns the first count. Dwell,
  exit, confidence and loss handling prevent phantom points. Caller calls update
  only during active work; `reset()` clears all state on a new round/calibration.
- Coordinate note: y is normalized by image height; target distance uses the
  supplied `options.aspectRatio` (width/height, default 1) for circular geometry.

Pure tests use generated small image buffers and trajectories, never import
synthetic fixtures into production. Document exact defaults and loss behavior.

## Experience

`src/ball-control/BallControlExperience.jsx` default export accepts:

```jsx
<BallControlExperience
  routeActive={route === 'ball'}
  storageKey="quicktrack-training:ball-control-v1"
  catalog={catalog}
  practiceActive={Boolean(active)}
  onResumePractice={() => navigate('practice')}
  disabled={readOnly}
/>
```

Mount inside existing TrainingShell/TrainingExperience on first visit to `route === 'ball'`.
Keep mounted in a hidden wrapper after navigation; `routeActive` defaults true.
When false, pause the round and unmount camera UI/release tracks. Return with the
round paused and calibration reset, so navigation does not discard unsaved work.
Do not render a second main landmark or app navigation. Agent owns CSS import
inside its module. Use existing shared components if helpful. Round history is
separate from the existing assignment controller, with explicit metric source.
Existing `catalog.assignments[].drills[].media` contains approved first-party
media entries; inspect domain code rather than guessing its shape. Match videoId
against approved media ids, preserve revoked status, never synthesize approval.

The camera preview must preserve source aspect ratio (no cropping/mirroring),
provide sample-ball and target-A/B calibration with pointer and keyboard access,
and invalidate calibration after camera/size changes. Stop tracks on lifecycle
exit. The UI should gracefully handle missing not-yet-written vision/curriculum
modules while developing, but remove any temporary stubs before completion.

Coordinator adds `#/ball` route and Ball control navigation, changes only camera
to `(self)` in the Worker Permissions-Policy, and owns their regression tests.
