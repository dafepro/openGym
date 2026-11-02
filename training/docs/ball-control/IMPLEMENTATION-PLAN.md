# Ball control for QuickTrack Training

Owner: Codex coordinator. Requested 2026-11-01. Target: `train.quicktrack.cc` in
`dafepro/openGym`, inside the existing `training/` application.

## Outcome and first delivery boundary

Create a subscription-free home ball-control practice mode. A player chooses a
drill, reads concise instructions or watches an approved demonstration, sets a
practice duration, and practices with optional camera feedback. Saved results
distinguish elapsed practice, manually entered repetitions, and camera-observed
target arrivals. The app never equates ball location with verified technique.

The first deliverable is a reviewable deployment candidate with guided drills,
an experimental camera tracker, meaningful tests, mobile browser verification,
and a video-production package. Stop before production promotion and report the
candidate, evidence, limitations, and exact equipment/content checks needed.
Generated instructional videos and real-device tracking qualification cannot be
completed until the owner supplies those outputs/equipment. The guided mode must
remain usable without either.

## Verified starting point

- Local `gh` account switched to `dafepro`; `gh api user --jq .login` returned
  `dafepro`. Use this CLI identity for every GitHub operation; do not substitute
  a connected GitHub app or use the other locally configured accounts.
- Fork: `https://github.com/dafepro/openGym`, upstream `DuarteSantos8/openGym`.
- Current production pointer in `dafepro/deploy`: source
  `008e8a5155fa90af4df7a9b27acd10994988ff6f`, verified through `gh`.
- Development branch: `codex/ball-control-training`, based on that exact source.
- Existing app: React/Vite, hash routing, device-local practice storage,
  guided practice/player, first-party catalog/media Worker, independent release
  producer and private central deployment repository. Preserve these contracts.
- Production currently forbids camera through Permissions-Policy. Enable only
  same-origin camera access; microphone and geolocation remain disabled.

## Product and technical decisions

1. Add a distinct Ball control destination. Existing assigned practices and their
   records keep their semantics. Block a new ball-control session while another
   assigned practice is active, with a link to resume that practice.
2. Reuse the existing dark/lime visual language, shared buttons and video player.
   Keep instructions brief and primary practice controls large at 320px width.
3. Ship original text instructions and simple diagrams. Unproduced videos are
   explicitly unavailable; never use invented video URLs or a synthetic test
   clip as an instructional demonstration. Resolve approved videos only from the
   existing catalog, through its existing first-party media contract.
4. Run camera processing entirely in the browser. No recording, upload, remote
   inference, microphone request, or mandatory paid service. Request access only
   after a deliberate Enable camera action. Release tracks on leaving, hiding,
   stopping the camera, switching cameras, and failure. Handle late permission
   resolution after teardown without retaining a live stream.
5. Begin with a sampled-color tracker using downscaled camera frames, connected
   regions, shape/size checks and continuity. A colored Dribbleup ball is a useful
   candidate, but its pattern is not assumed to guarantee detection. The printed
   mat supplies visual landmarks; we do not depend on brand-specific dimensions.
6. Park the ball at each endpoint and calibrate its visible center directly in
   the camera image, rather than the floor contact point. No unsupported 3D
   distance, foot identification, or exact-touch claim. Keep the preview and
   overlay in the same unmirrored coordinate system. Recalibrate after camera or
   orientation changes. Label targets A/B to avoid player-versus-camera left/right.
7. Score only supported alternating-target drills, with dwell, confidence,
   minimum interval, exit/re-entry and reacquisition rules. Occlusion cannot earn
   points. Unsupported drills use timed guidance/manual counts.
8. Save bounded, versioned summaries in a separate device-local namespace derived
   from the current application/demo database. Keep raw frames out of storage.
   Save only on explicit confirmation; expose failure, avoid duplicate saves,
   and provide export and confirmed clearing. History is local to this browser.
9. Browser backgrounding pauses the round. No hidden elapsed time or automatic
   completed workout; resume requires a deliberate action. Active practice and
   demonstration playback have independent controls.

## Vertical slices and acceptance

### Slice 1 — A complete guided round

Deliver a drill library, drill detail with setup/cues, adjustable duration,
start/pause/resume/finish, summary and persisted history. Include a small useful
library of eight ball-control drills. A player can finish a round without camera
permission and without an available video. Timers use a monotonic clock and
do not count background time. A partial round is represented honestly.

Acceptance: choose drill → start → pause → finish → save → reload → see saved
result; no changes to existing session records. Missing media and storage failure
have usable states. Manual counts remain labeled manual.

### Slice 2 — Camera setup and honest detection

Deliver camera permission/retry/disable, front/rear selection, positioning help,
live preview, ball color sampling, two-target calibration, detected-ball overlay
and visible tracking status. Use native browser APIs and plain JavaScript first,
without adding a large inference runtime before measurements justify it.

Acceptance: denied/unsupported/insecure camera leaves guided mode usable; tracks
are released for every lifecycle exit; tap coordinates match the image; invalid
or low-color samples get actionable feedback; frames are never persisted/sent.

### Slice 3 — Two meaningful camera challenges

Enable horizontal sole rolls and forward/back sole rolls with calibrated targets.
Count target arrivals, not touches or correct repetitions. Start the counter only
during active work. Repeated stationary frames, low confidence, brief occlusion,
calibration transitions and hidden/paused sessions cannot create arrivals.

Acceptance: deterministic synthetic-image/trajectory tests cover valid movement,
stationary jitter, missing frames, noise, wrong target, invalid target geometry
and recovery. Actual ball/phone accuracy is a separate physical acceptance check.

### Slice 4 — Production and app integration

Integrate the new route and navigation, lazy loading where useful, existing media
resolution, same-origin camera policy, persistence isolation and regression tests.
Keep deployment configuration, existing catalog, domain ownership and release
gates intact. Run default/demo build guards and release tooling tests. Prepare a
branch/PR against the established training release branch without triggering its
production release or merging it.

Acceptance: no unrelated Uplift code/config changes; no new external origins in
CSP; all training tests pass; default build excludes demo/private content. The
candidate retains the current app's source/license notices.

### Slice 5 — Repeatable instructional-video production

Deliver a model-neutral master prompt, fixed visual bible, front/oblique camera
recipes, per-drill motion scripts, negative prompts, shot IDs, filenames, caption
copy, generation manifest and frame-by-frame acceptance checklist. Cover athlete
appearance, footwear, ball/mat references, surface, lighting, framing, timing,
starting/ending poses and player-foot terminology.

Acceptance: eight drills have ready-to-paste prompts with explicit foot contact,
ball path and timing. No generated text, fake branded markings, camera cuts or
hidden feet. Clips remain pending until a human verifies anatomy, contact,
friction and technique. The app never treats generated footage as a test of its
real-camera accuracy. Include the existing content preparation/import procedure.

## Revision and polish passes

1. **Contract/integration pass:** connect modules and review all scoring, timer,
   media, storage and route boundaries. Resolve integration failures before UI QA.
2. **Adversarial correctness pass:** independently review rapid repeated actions,
   background/foreground, camera permission races, calibration reset, unknown
   storage, duplicate saves and tracking loss. Fix identified issues with focused
   regression tests. Do not infer camera quality from synthetic trajectories.
3. **Interaction pass:** test phone widths 320/390 and a desktop width; keyboard,
   readable instructions, focus, reduced motion, disabled states, empty/history
   views and primary action reach. Remove overlap and layout jumps.
4. **Release pass:** run all existing training checks once after final changes,
   verify default and explicit demo builds, inspect diff/secrets and document
   source SHA, browser evidence and outstanding real-device/content checks.

## Delegation and ownership

Use GPT-6.1 Sol with high reasoning, as explicitly requested.

- Vision agent: `src/ball-control/vision/` pure detection/scoring and meaningful
  tests; document algorithms, limits and real-footage qualification protocol.
- Experience agent: `src/ball-control/` experience, camera lifecycle/UI,
  round state/storage, CSS and tests, excluding vision and curriculum files.
- Curriculum agent: `src/ball-control/curriculum.js`, its tests, and video
  production/drill docs. Original instructions and verified reference links.
- Coordinator: contracts, existing app/Worker integration, release notes, browser
  QA and final integration. Shared files have one owner. Agents do not push,
  deploy, alter credentials, or commit another agent's changes.

## Follow-on revisions after equipment arrives

Measure on the intended phone with the used ball/mat, including daylight,
evening light, fast rolls, shoes occluding the ball, similar floor/mat colors,
front/rear cameras and orientation changes. Manually annotate target arrivals
for comparison; record missed/false arrivals and processing latency. Suggested
promotion gate: at least 95% arrival precision and 90% recall on the agreed
controlled-home test set, with no scores during deliberate loss of visibility.
These are proposed acceptance goals, not current performance claims.

If color tracking fails that gate, evaluate a local lightweight ball detector
against the same recorded test set. Select model/runtime after measuring device
performance and license/bundle requirements. Keep color-only feedback experimental
until it passes; guided practice remains available throughout. Pose/foot scoring,
multi-device sync and a large adaptive curriculum are later separately scoped
work, not promises in this candidate.

## Owner handoff needs

At the candidate boundary: intended phone/browser, ball and mat reference photos
once purchased, and generated output from the prompt pack. Prefer an initial
small two-drill video batch for visual/technique review before producing all
angles. Real demonstration approval and physical-camera trials precede claims
of dependable automatic coaching. No further account credential is currently
needed; local dafepro CLI access has been verified.
