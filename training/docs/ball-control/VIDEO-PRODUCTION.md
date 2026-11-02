# QuickTrack ball-control video production

This is an executable production brief for eight original QuickTrack drills, with
sixteen planned shots. No instructional video has been generated, reviewed, or
approved. The app's `videoId` is an intended catalog identifier, not an available
URL. Guided text works while video is pending. Thirty seconds is an editable
practice-screen default, not a trainer prescription; demo clips are sixteen seconds.

Use [DRILL-PROMPTS.md](DRILL-PROMPTS.md) for the eight complete motion blocks and
separate caption copy. Use [video-production-manifest.json](video-production-manifest.json)
as a production ledger. Copy the ledger outside all Git checkouts before adding
private reference photos, output locations, permission records, or reviewer names.
Keep generated media and private reviews outside this public repository.

## What to supply once

1. A clear full-body reference of the adult demonstrator, or one approved synthetic
   adult character sheet. Use an adult to keep production independent of a child's
   likeness. Record rights/consent for any real likeness privately.
2. Front and side photos of the actual used ball and mat, plus one overhead layout
   photo on the intended indoor floor. Include a ruler privately if scale needs
   resolving. Check the mat lies flat and does not slide; clear furniture and walls
   beyond the entire movement path. Do not assume a brand's dimensions or markings.
3. One locked reference still showing the approved athlete, kit, shoes, ball, mat,
   surface and lighting. Every later shot uses it. Until equipment photos exist,
   outputs are visual studies and cannot pass equipment continuity review.

The ball/mat may be Dribbleup equipment. This is an independent QuickTrack practice
pack; no Dribbleup affiliation, trainer endorsement, subscription, or proprietary
marking calibration is claimed. Do not fabricate brand text. Preserve visible
markings only when the generator can reproduce the supplied reference consistently;
otherwise rerender/crop away an irrelevant marking without hiding contact surfaces.
Do not substitute a different ball color or mat pattern between shots.

## Fixed visual bible

- One adult demonstrator, approximately 25–35, athletic build, medium-brown skin,
  short dark hair, no jewelry. Reference identity takes precedence over these
  descriptive defaults once selected. Neutral, focused expression; no celebrity.
- Plain charcoal short-sleeve shirt, plain deep navy shorts ending above the knee,
  white ankle socks, plain light-gray **flat rubber-soled indoor soccer shoes**.
  No studs/cleats, bare feet, costume changes, loose laces, or flowing clothing.
- Actual reference ball and mat on a level matte indoor sports/vinyl floor. Mat flat
  with no curled corners. Ball inflated and spherical. Clear wall, no other people,
  mirrors, screens, loose cables, pets, or distracting signage. No added cones on
  the active mat. Keep all movement well within the observed usable surface.
- Two broad diffuse lights at roughly 45 degrees front-left and front-right, higher
  than the athlete's eyes; soft floor shadows. Fixed exposure and white balance.
  No flicker, colored light, glare on the ball, or deep shadow over feet. Use the
  same light positions throughout the batch.
- Grounded feet and natural weight transfer. A support foot carries weight whenever
  the other touches the ball. Knees softly bent; no loaded, fixed-knee twisting.
  Ball movement follows visible contact and friction; no sliding without cause,
  hovering, teleporting, sudden size changes, foot penetration, or impossible spin.
- Silent demonstration; no generated narration, music, captions, logos, arrows,
  scoreboards, timers, watermarks, or embedded text. Caption copy is added separately
  in an accessible player workflow if supported, never baked into generated pixels.

These appearance and camera decisions are production choices. A detailed prompt
cannot guarantee anatomy or biomechanics; correctness is an output review task.

## Camera recipes

Both recipes are **unmirrored**: right and left always mean the demonstrator's own
right and left. The front camera sees the athlete's right on image-left. Mark this
in the private slate/ledger, never by asking the generator to draw letters on shoes.

| Recipe | Position and framing | Purpose |
| --- | --- | --- |
| `front` | Tripod centered in front of athlete; start about 3–4 m away and 1.1–1.3 m high, optical axis slightly downward. Adjust distance for full head, hands, both shoes, entire mat, both endpoints and a visible floor margin. No lens wider than needed; normal-perspective 35–50 mm equivalent is a starting point. | Primary app demonstration; lateral paths and alternating feet. |
| `oblique45` | Move camera only to athlete's front-right at 45 degrees, same height and comparable subject scale; athlete/ball/mat/light positions stay fixed. Keep both floor endpoints and rear heel area visible. | Alternate review of fore/aft travel, sole release, and ball clearance behind support heel. |

The dimensions above are starting camera placements, not measurements of the
unbought mat. Reframe physically to avoid cropped feet. Do not zoom, orbit, pan,
track, change focal length, or cut during a take. For the L pull, inspect the
oblique view for the complete path behind the support leg. Brief natural overlap
in the front view is acceptable only if the alternate view reveals the contact;
reject footage that uses an occluded interval to hide an impossible transition.

Prefer a 16:9, 1920×1080 delivery at a genuine constant 30 fps. If the generator
supports only another native rate, keep that truth in the ledger and review its
actual frames before a compatible delivery transcode. Do not claim that interpolated
frames are evidence of correct motion. Keep the entire athlete legible at phone size.

## Pasteable master prompt

Paste this block followed by exactly one complete drill block from DRILL-PROMPTS.
Attach the locked reference still and ball/mat photos using the generator's own
reference-image controls. Set 16 seconds, 16:9, and native 30 fps when available.
Replace `SHOT_ANGLE` with `front` or `oblique45`; this is the only camera variant.
There are no model-specific weights, seeds, or API assumptions.

```text
Create one continuous, silent, realistic 16-second soccer footwork demonstration.
Use the same adult as the supplied locked reference: athletic adult, short dark
hair, medium-brown skin, charcoal plain shirt, navy above-knee shorts, white ankle
socks and light-gray FLAT rubber-soled indoor soccer shoes. No cleats. Preserve
adult identity, wardrobe, body proportions and handedness across every frame.
Use exactly the supplied ball, flat mat and indoor floor reference. Do not invent
brand names or new printed mat targets. The ball/mat/floor scale and orientation
stay constant. Clear neutral room, no other people or objects in the movement area.
Two diffuse elevated front-side lights give steady soft shadows, no glare/flicker.
SHOT_ANGLE camera: for front, fixed centered front tripod at about waist height,
slightly down; for oblique45, fixed tripod 45 degrees to the athlete's front-right
at the same height. Adjust distance to show the full adult, both feet, entire mat,
all ball endpoints and floor margin at all times. Unmirrored normal perspective.
Lock camera, exposure and focus; no cut, zoom, orbit, pan, camera shake or slow-motion.
Right/left always mean the athlete's anatomical right/left, never the viewer's.
At 0–2 seconds hold the drill's start pose, balanced with both feet on the floor.
At 2–14 seconds perform only the exact chronological drill script below at a
controlled teaching pace. Every ball displacement must follow visible shoe-ball
contact, credible rolling and floor friction. Support the body on the floor foot;
soft knees and small natural adjustment steps, no twisting on a locked knee.
At 14–16 seconds hold the specified finish pose; ball fully settled on the floor.
Keep all limbs distinct with exactly two legs/two feet, stable shoe soles and
spherical ball. No foot-ball interpenetration, duplicate limbs, limb morphing,
teleporting ball, floating feet, magnetic ball, invisible resets or unexplained
bounces. Do not hide an action with a blur or occlusion. Preserve floor shadows.
No text, captions, arrows, labels, timers, logos, scoreboards, watermarks, speech,
music, narration or coaching endorsement. Output only the continuous demonstration.
The following drill script overrides any generic soccer move. Do not improvise.
```

Optional separate negative-prompt field, when supported:

```text
cleats, studs, extra limbs, missing feet, fused shoes, wrong foot, mirrored action,
ball clipping through shoe, hovering ball, teleport, sliding support foot, changing
ball pattern, warped mat, offscreen contact, camera movement, jump cut, speed ramp,
heavy motion blur, hidden feet, text, watermark, music, narration, celebrity
```

Do not rely on a negative-prompt field alone. Review every candidate against the
positive motion script and acceptance checklist.

## Timing, loops and edits

Every clip has a 2-second entry hold, 12 seconds of scripted motion, and a 2-second
exit hold. Four 3-second cycles occupy 2–5, 5–8, 8–11 and 11–14 seconds. Some cycles
contain multiple contacts; the per-drill block states exactly which. Foot changes
and recovery rolls are real visible actions, not cuts. Use the same start and end
ball location and stance whenever stated, with matching shadows and scale.

Archive the intact sixteen-second master. The 2–14 second movement segment is only
a **candidate** loop. Approve a loop only if end/start ball position, support-foot
phase, body velocity and contact phase agree. A pose match with a velocity jump is
not seamless. If that fails, play the full clip with its holds; do not crossfade
feet or hide a discontinuity. The player can repeat a clip separately from the
practice timer. Never extend elapsed practice by interpreting clip length as a set.

No generated pixels are currently supplied. If a generator has a shorter maximum,
render one full 3-second cycle with at least 1 second of hold on either side as a
pilot, record the actual duration, and review it independently. Do not stitch
unreviewed fragments into an apparent continuous correct take. The preferred
sixteen-second pack remains pending until genuine continuous takes are available.

## Pilot, batch and shot list

First generate **only** `bc-side-roll-front-v1` and `bc-push-pull-front-v1`.
These reveal identity drift, sole contact, floor friction and forward/back readability.
Review at native speed and frame by frame. Then generate their oblique alternates.
Approve the visual bible only after those four outputs survive review and match
the actual equipment photos. Reuse the exact prompt prefix, refs and settings for
the remaining drills. Log generator name/version/settings and reference revision
privately so failures can be reproduced. A model change requires a new pilot.

| Drill / prompt ID | Front media ID / filename | Alternate media ID / filename |
| --- | --- | --- |
| `bc-side-roll` | `bc-side-roll-front-v1.mp4` | `bc-side-roll-oblique45-v1.mp4` |
| `bc-push-pull` | `bc-push-pull-front-v1.mp4` | `bc-push-pull-oblique45-v1.mp4` |
| `bc-toe-taps` | `bc-toe-taps-front-v1.mp4` | `bc-toe-taps-oblique45-v1.mp4` |
| `bc-inside-touches` | `bc-inside-touches-front-v1.mp4` | `bc-inside-touches-oblique45-v1.mp4` |
| `bc-v-pull` | `bc-v-pull-front-v1.mp4` | `bc-v-pull-oblique45-v1.mp4` |
| `bc-l-pull` | `bc-l-pull-front-v1.mp4` | `bc-l-pull-oblique45-v1.mp4` |
| `bc-inside-outside` | `bc-inside-outside-front-v1.mp4` | `bc-inside-outside-oblique45-v1.mp4` |
| `bc-stepover` | `bc-stepover-front-v1.mp4` | `bc-stepover-oblique45-v1.mp4` |

The filename without `.mp4` is the prospective media ID. Keep rejected generation
attempts under private attempt names, e.g. `bc-v-pull-front-v1-attempt-003.mp4`.
Select one candidate per immutable ID before publication. Any change to published
bytes, including captions baked in later or a transcode, requires a new media ID
and catalog revision; update the curriculum's primary video ID through a code
review if choosing v2. Oblique alternates are planned review/optional future player
assets; the current curriculum resolves only the front IDs.

## Human acceptance and status transitions

Use an adult reviewer who can assess soccer footwork; record who reviewed, when,
which exact file hash, and any limits privately. A generator's own assessment is
not approval. Review at normal speed first, then every native frame around each
contact, release, foot placement, occlusion and reset. Use a frame viewer or export
frames into a private folder, for example:

```sh
ffmpeg -i candidate.mp4 -vsync 0 /private/quicktrack/review/frames/frame-%05d.png
```

- [ ] Two legs/two feet at every frame; no fused knees, changing shoe geometry,
  extra toes, impossible joint bends, floor penetration or floating support foot.
- [ ] Correct anatomical foot and correct surface at each scripted phase. Ball
  begins changing velocity only after contact. Sole lifts before inside contact.
- [ ] Ball remains spherical and grounded; markings rotate with rolling, with no
  frozen texture, sudden spin reversal or unmotivated acceleration. Support foot
  grips the floor; mat does not slide or deform with the athlete.
- [ ] Ball follows the named path and fully clears the support heel for L pulls.
  Toe taps/stepovers keep the ball approximately still. No fake skill hidden in a
  front-view overlap; cross-check the corresponding oblique output independently.
- [ ] Controlled balance, small range, soft knees and visible recoveries. No frame
  encourages standing with full weight on the ball or twisting a locked knee.
- [ ] Identity, clothing, ball, mat, floor, lighting and handedness match the bible.
  Contact zones stay readable, in frame, sharp and unmirrored throughout.
- [ ] Holds/timing match the script; no cuts, time warps, offscreen resets, embedded
  text or fabricated endorsement. Caption copy describes this exact variant.
- [ ] Rights/permission evidence exists; final H.264/yuv420p MP4 plays and seeks on
  intended phone/browser; file hash matches the reviewed delivery bytes.

Ledger flow: `planned` → `generated` → `in-review` → `approved`, or `rejected`.
Keep `approved: false` until **all** technique, anatomy/contact, continuity,
rights and playback reviews pass on the exact hashed delivery. Regeneration or
byte changes reset approval and reviews. `approved` in this ledger does not expose
an asset; the separate private selected catalog controls application availability.
The checked-in manifest stays a truthful all-planned template and tests enforce
that no future asset is accidentally presented as approved by source code.

Generated demonstrations cannot qualify real camera detection or scoring. Even a
perfect-looking render has invented pixels, occlusions and contact; it is unsuitable
as evidence for actual phone/ball arrival precision, recall or biomechanical
coaching. Use the real-device protocol in the implementation plan with the actual
phone, floor, ball, mat and human player. The app observes target arrivals, not
verified touches, exercise repetitions, foot identity or correct technique.

## Existing private ingestion procedure

This section follows the inspected implementation in
[`prepare-catalog.mjs`](../../scripts/prepare-catalog.mjs),
[`content.js`](../../src/domain/content.js),
[CONTENT-WORKFLOW.md](../CONTENT-WORKFLOW.md) and
[PRIVATE-HOSTING.md](../PRIVATE-HOSTING.md). There is no new upload API here.

1. Keep reference images, permission evidence, chosen MP4s, catalog input and
   output directories outside **all Git checkouts**, including symlink targets.
   Retain the generator's usage terms and any likeness/brand permission review
   privately. A permission reference is evidence linkage, not proof by itself.
2. If necessary, create a compatible derivative privately, then review **that
   derivative** before approving it. The preparation script inspects, copies and
   hashes; it does not transcode. Example (choose an unused output filename):

   ```sh
   ffmpeg -i /private/quicktrack/source.mp4 -an -c:v libx264 -pix_fmt yuv420p -movflags +faststart /private/quicktrack/bc-side-roll-front-v1.mp4
   ```

3. Author an input JSON with `{catalog, media}`. Preserve existing assignment
   editions and current assignment selection. The ball-control resolver discovers
   approved IDs in `catalog.assignments[].drills[].media`; add an appropriate
   review/watch library edition rather than silently rewriting a trainer workout.
   Example valid **drill occurrence** inside a valid assignment:

   ```json
   {
     "id": "bc-side-roll-demo-v1",
     "title": "Side-to-side sole rolls demonstration",
     "instructions": "Watch the independent QuickTrack demonstration. Choose your own comfortable practice duration in Ball control.",
     "mode": "watch", "sets": 1, "side": "both", "restSec": null,
     "media": {"id": "bc-side-roll-front-v1", "status": "approved", "path": "/media/bc-side-roll-front-v1"}
   }
   ```

   Include an inventory entry:

   ```json
   {"id":"bc-side-roll-front-v1","file":"./bc-side-roll-front-v1.mp4","permission":{"status":"approved","reference":"private-rights-review-record-id"}}
   ```

   These fragments are not a complete publishable catalog. A valid catalog needs
   `schemaVersion:1`, stable `revision`, `currentAssignmentId`, current assignment
   edition, assignment status and drills. Use the existing domain contract. Every
   approved ID in the entire catalog must appear exactly once in the inventory;
   unavailable IDs must not appear there. Do not add unreferenced oblique assets
   merely because they were generated. No private source URL enters child content.
4. From the repository root run:

   ```sh
   node training/scripts/prepare-catalog.mjs /private/quicktrack/input.json /private/quicktrack/new-edition
   ```

   The parent output folder must exist; `new-edition` must not. This validates
   catalog shape, permission references and MP4 streams; writes `media/<id>`,
   `catalogs/<revision>.json` and a private `publication-report.json`; prints
   `CATALOG_REVISION`/`CATALOG_SHA256`; and reports `prepared-not-published`.
   A failed partial output is not eligible for publication. Do not upload the report.
5. Publication and selection remain the existing separate reviewed operator step:
   immutable media objects first, verify lengths/hash/MIME metadata, upload exact
   catalog envelope bytes, then select matching catalog revision/hash through
   deploy. Never overwrite published bytes. Keep prior selection for rollback
   without reviving withdrawn media. This production pack performs no upload,
   deployment, catalog selection, or release promotion.
6. Qualify authenticated playback, seek/range support, unavailable/revoked state and
   phone display through the existing first-party player. A prepared file is not
   proof of playback or of a successfully published catalog. Keep all eight front
   IDs unavailable until that content path and human reviews are complete.

## Coaching basis and limits

Instructions and timed scripts are original, small-space QuickTrack adaptations,
not reproduced training prescriptions. References were inspected on 2026-11-01.
Names vary between coaching programs; the explicit foot contacts define our variant.

- [FIFA: Mastering ball control](https://www.fifatrainingcentre.com/en/practice/elite-sessions/in-possession/mastering-ball-control.php)
  supports close control, inside-to-inside and sole-to-sole changes. It is the
  technical basis for our side-roll and inside-touch contact choices, not our timing.
- [FIFA: Training technique](https://www.fifatrainingcentre.com/en/practice/grassroots/8-to-12/training-technique.php)
  supports starting slowly, using both feet, and alternating inside/outside surfaces.
  Our stationary inside/outside lane and cadence are production adaptations.
- [Northern Suburbs Football Association: Inspire Ball Mastery](https://nsfa.asn.au/wp-content/uploads/2018/07/Inspire-Ball-Mastery.pdf)
  identifies alternating forefoot sole touches, sole draw-backs, a changed-angle V,
  a behind-support-leg L, and inward/outward step-over variants. Our toe taps,
  V/L sequences and inward step-over preparation use those contact concepts.
  Their conventional pull-push uses laces on the forward phase; our camera drill
  deliberately uses the sole in both directions and is titled forward/back sole
  rolls to distinguish it. Our step-over stops at a reset rather than accelerating.

These organizations have not reviewed or endorsed QuickTrack or generated outputs.
An animation prompt provides production intent; human technique review remains
necessary before anyone relies on a clip for instruction.
