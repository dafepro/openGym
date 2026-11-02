# Experimental camera tracking qualification

## Current status

This candidate implements browser-local sampled-color tracking and counts
observed alternating target arrivals. It does not identify feet, sole contact,
touches, completed technique, travel distance or correct repetitions. Confidence
is a heuristic for the colored region's shape; it is not a calibrated accuracy
probability or a coaching score.

The intended used multicolor Dribbleup ball and mat are not available for this
implementation. No physical ball/phone trial has been completed. Generated test
images demonstrate deterministic algorithm behavior, not performance on that
equipment. All camera feedback remains experimental for controlled home use.
Timed instructions and separately labeled manual counts remain the fallback.

## Pixel observations

`sampleBallColor(imageData, {x,y})` accepts normalized image coordinates and
returns a serializable v1 profile. It samples a square patch with radius the
greater of 2 pixels and 1.8% of the shorter image dimension. At least 70% of
the patch must have alpha >= 200, HSV saturation >= 0.30 and value >= 0.16;
at least 70% must agree within 0.055 hue turns of a dominant hue. Invalid,
dark, gray or mixed samples produce actionable errors. Sample the center of
one bright colored panel, not the ball's black/white seams or a panel boundary.

The profile uses a hue tolerance of 0.065 turns; its saturation floor is the
greater of 0.25 and half the sample saturation, and its value floor is the
greater of 0.12 and 35% of sample value. Color segmentation is followed by
8-connected component analysis. A candidate needs at least 9 pixels and 0.04%
of frame area, at most 18% of frame area, a bounding box at least 3 pixels in
each direction, width/height between 0.5 and 2, and >= 40% box occupancy.
Components touching the image edge are rejected. Pixels with alpha < 200 do
not contribute. Inputs are limited to 2 million pixels; the camera experience
should downscale frames before calling these functions.

Centroid x/y are normalized by image width/height respectively, using pixel
centers. Radius is the equivalent-area radius of the matching colored region,
divided by image width. On a patterned ball this can be a panel, and the
reported radius need not equal the full ball radius. No dimensions or markings
of a particular brand's ball/mat are assumed.

Confidence combines bounding-box aspect and occupancy. Candidates are ranked
by confidence minus 1.5 times their width-relative displacement from the previous
observation. When provided, a previous detection limits the next candidate to
four previous radii of displacement, clamped to 0.075–0.22 image widths, and a
radius ratio of 0.45–2.2. Vertical displacement is converted to image-width
units before comparison. Two candidates within 0.08 ranked score are ambiguous
and return null. Missing pixels, rejected geometry and continuity failures
return null, never a predicted position. Callers must clear the previous point
after null, camera/calibration changes, pauses and extended gaps.

The component shapes cannot establish that an object is a soccer ball. A
matching shoe, floor, reflection, toy or mat patch can confuse this tracker;
similar matching objects may make it refuse detection. Pattern rotation,
motion blur, shadows, occlusion and automatic exposure can fragment the sample
panel. Continuity intentionally misses abrupt motion rather than jumping to a
distant matching object. Fast genuine motion and brief occlusion may therefore
lose arrivals. These are expected qualification risks, not measured failure
rates.

## Counter rules and defaults

Targets are exactly two finite normalized centers and positive radii <= 0.5,
with radius expressed relative to image width. `validateTargets` checks square
normalized separation > 1.25 times the sum of radii. `createTargetCounter` also
checks that separation in actual image geometry and that both complete circles
fit inside the frame. This two-stage check is deliberately conservative in
portrait geometry. Invalid geometry or options throw an actionable error.
Target data is copied at construction.

`aspectRatio` is source width / source height, default 1. Circular distance is
`hypot(dx, dy / aspectRatio)`. The preview/overlay must preserve the unmirrored
source aspect ratio, and calibration must be repeated if it changes.

Counter defaults:

| Option | Default | Meaning |
| --- | --- | --- |
| `dwellMs` | 180 ms | Continuous time inside an eligible target |
| `minIntervalMs` | 350 ms | Minimum time since last arm/arrival |
| `minConfidence` | 0.65 | Minimum accepted detection confidence |
| `maxGapMs` | 250 ms | Longest interval between accepted update timestamps |

Dwell also requires at least three observations with strictly increasing finite
nonnegative timestamps. Options must have dwell >= 100 ms, interval >= dwell,
confidence in [0.5,1], gap in [50,1000] ms and positive finite aspect ratio.

The first stable observed target arms the counter without adding a point.
`expectedTarget` is null before arming, then 0 for A or 1 for B. The opposite
target must be reached with fresh dwell. Two consecutive visible observations
outside 1.25 times the previous target radius confirm exit. A point changes
the expected target and resets exit evidence. Remaining still, returning to
the same target or passing quickly through the expected target cannot count.
Only the detected center is tested against target circles; partial circle
overlap alone does not count.

Any null, malformed or low-confidence detection immediately discards arm,
dwell and exit evidence while preserving the earned count. The first stable
target after loss rearms with no point. A frame gap > 250 ms does the same;
an invalid, duplicate or backward timestamp returns `lost` and clears the arm.
`tracking` is `acquiring` until a target has armed, `tracking` while armed with
accepted observations, or `lost` for an unusable observation. `reset()` clears
all state, including count and timestamps. The caller updates only during
active foreground work and starts a new counter/reset on a new round or new
calibration; pauses must clear continuity/arm so hidden movement cannot score.

## Reproducible implementation checks

Run from `training/`:

```sh
npm test -- src/ball-control/vision
```

Synthetic RGBA tests cover colored discs, grayscale/dark/mixed/transparent
samples, hue wrap, lighting change, isolated noise, broad matching regions,
thin stripes, edge clipping, ambiguous objects, continuity and size jumps,
portrait/landscape pixel geometry, missing pixels and reacquisition. An
image-to-counter sequence exercises actual segmentation through a full
alternation, disappearance and an unscored reacquisition before another point.

Temporal tests cover arming at either target, stationary jitter, wrong target,
brief arrival, exit evidence, dwell duration/frame count, minimum interval,
low confidence, occlusion, frame gaps, duplicate/backward/nonfinite timestamps,
aspect ratio, invalid targets, mutation isolation and reset. These fixtures
are tests only and are not included in the production tracking modules.

## Physical qualification before accuracy claims

1. Record intended phone model, OS/browser versions, selected camera, image
   dimensions, processing frame rate and orientation. Use the actual purchased
   ball/mat and final camera setup. Do not silently substitute a plain ball.
2. With explicit owner consent, collect short local reference clips for manual
   review outside this app, or annotate a second-device recording. The app
   itself does not record or upload frames. Keep personally identifying footage
   out of source control and reports.
3. Test both supported drills across daylight and evening light, front/rear
   cameras, portrait/landscape, shoes obscuring the ball, rotating ball panels,
   slow/fast rolls, stationary boundary jitter, similar mat/floor colors and
   multiple matching objects. Repeat each scored condition three times for
   30 seconds; include at least 100 manually labeled visible target arrivals
   overall and dedicated no-score controls.
4. Annotate initial arms separately from countable alternating arrivals.
   Mark visibility loss, target entry/exit and continuous dwell independently
   of the app. Match observed counts to annotation timestamps within 300 ms;
   use one-to-one matches, reporting ambiguous annotations separately. Arrivals
   spanning loss are ineligible under the conservative counter rules.
5. Report true positives, false positives, false negatives, precision, recall,
   condition-level breakdowns, tracking availability and processing latency
   (median/p95), plus missed scheduled updates/frame rate on the intended phone.
   Do not omit fast/occluded failures from the report to improve the headline.
6. Proposed controlled-home promotion goals are >= 95% arrival precision and
   >= 90% recall on the agreed set, with zero points in deliberate stationary,
   hidden-camera, low-confidence, background and reacquisition controls. These
   goals have not been measured or achieved. Review UI responsiveness and heat
   on the actual phone as well; no mobile latency threshold has yet been agreed.
7. If the sampled-color approach misses the goals, retain its experimental
   label and guided fallback. Evaluate a local lightweight detector using the
   same footage/annotations only after assessing license, bundle and device
   performance. Re-run all conditions after algorithm, camera or framing changes.
