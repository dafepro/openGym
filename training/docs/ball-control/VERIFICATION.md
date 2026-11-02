# Ball-control candidate verification

Verified locally 2026-11-01 (America/Chicago). Production base:
`008e8a5155fa90af4df7a9b27acd10994988ff6f`. Candidate branch:
`codex/ball-control-training`. This document records candidate evidence, not a
production deployment or physical-device accuracy claim.

## Delivered

- Eight original guided drills, adjustable duration, manual counts, explicit
  partial/full-duration review, save/export and bounded local history.
- Opt-in camera, front/rear selection, sampled color, projected ball-center
  endpoint calibration, observed-pixel overlay and conservative target arrivals
  for two sole-roll drills. No camera uploads or video recording.
- Retained paused rounds across navigation, background pause, stopped camera
  tracks, fresh calibration on return and assigned-practice conflict handling.
- Same-origin-only camera Permissions-Policy. Other origins, microphone and
  geolocation remain unavailable. No new runtime dependency or model download.
- Master video prompt, visual bible, eight chronological drill scripts, sixteen
  planned shots, separate caption copy, production ledger and ingestion workflow.

## Automated checks

`npm --prefix training run test:all` passed:

| Scope | Tests |
| --- | ---: |
| App/domain/storage/vision | 231 |
| Worker/media/access | 21 |
| Content preparation | 4 |
| Private preview | 6 |
| Release packaging/publication contract (Python) | 10 |
| Source notice | 2 |
| **Total** | **274** |

The app count includes 45 ball-control tests. Synthetic image/trajectory tests
cover segmentation, ambiguity, continuity, target geometry, stationary jitter,
occlusion/rearming and image-to-counter scoring. State tests cover late metrics,
clock boundaries, duplicate saves, corrupted storage, exact metric provenance,
late camera permission, muted/ended tracks and frozen presentation frames.

Default and explicit sample builds plus `check:build` passed. The new mode is
lazy loaded: approximately 40.8 kB JavaScript / 13.6 kB gzip plus 6.4 kB CSS /
1.9 kB gzip at verification. Default output excludes sample/private-preview
content and source maps. `git diff --check` passed. Only `training/` is changed;
no Uplift runtime, package lock or deployment-resource configuration changes.

## Browser evidence

Isolated Chromium 151 headless contexts with reduced motion, separate sample
storage and generated camera fixtures were used. No user's webcam, footage or
production progress was accessed. Twelve browser checks passed with no page errors:

1. Layout at 320px, four navigation destinations, no horizontal overflow.
2. Same at 390px.
3. Same at 1280px.
4. Navigation retains unfinished work, paused without additional elapsed time.
5. Partial round saves manual count; camera is unmeasured; sample storage isolated.
6. History survives reload and exports the saved record.
7. History deletion needs confirmation; cancellation preserves it.
8. Existing assigned practice blocks starting a competing ball-control round.
9. Unsupported camera leaves guided practice enabled.
10. Synthetic camera enables, samples color and calibrates two targets.
11. A stationary observed ball produces zero target arrivals.
12. Leaving ends all tracks; returning keeps the paused round and requires setup.

Four further checks passed using a moving synthetic camera video:

- Video → actual browser frame processing → tracker → target counter → UI → saved
  record produced two observed arrivals. Manual repetitions remained null and
  the saved metric source was `experimental-camera`.
- A synthetic visibility event paused work and ended all camera tracks.
- The hidden interval added neither elapsed practice nor arrivals.
- The result retained camera provenance independently from manual counts.

This demonstrates pipeline wiring, not accuracy on a patterned ball or a real
phone. Local QA scripts, logs, screenshots and generated camera fixtures are
retained in the task workspace and `/tmp/ball-control-qa`; none are instructional
media or production catalogs. For repetition: run the demo on a free localhost
port, use isolated browser storage, follow the twelve steps above, and use
Chromium fake-video-capture for synthetic camera evidence. Physical qualification
must instead follow [VISION-QUALIFICATION.md](VISION-QUALIFICATION.md).

## Independent review and polish

Three GPT-6.1 Sol agents at high reasoning implemented vision, experience and
curriculum. The vision author then independently reviewed the experience. Findings
fixed and retested: post-deadline scoring, inconsistent history/source metadata,
repeated frozen frames, off-route/background demonstration playback, and a
submillisecond partial-round serialization boundary. Mobile polish added jump
links, consistent navigation, static diagrams for untracked drills and visible
ball-center calibration instructions to avoid floor-plane parallax.

## Release and remaining acceptance

The candidate is suitable for a guided-practice preview with camera clearly
experimental. Publish/promote only through the existing training source and
central-deploy flow. Keep the current selected catalog; missing new demonstrations
are handled explicitly. Revert to the prior selected source for rollback; new
ball-control history is separately namespaced and existing assignments are intact.

Before calling camera feedback dependable, test the actual phone/browser, used
ball and mat in the intended lighting. Calibrate on visible ball centers at each
endpoint. If endpoints overlap in the image, raise/re-angle the camera; do not
stretch farther than comfortable just to separate targets. No real-device
latency, recall, precision, Safari or Android browser result is claimed here.

No instructional videos have been generated or approved. Begin with the two
front-view pilot prompts, inspect technique and contact, then produce alternate
views and remaining drills. The production pack's pending assets must never be
treated as published video URLs.
