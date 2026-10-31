# Optional soccer drill recommendation core

This adapts the fork's existing **Add exercise** pattern into a small pure training-domain service. The inspected references are `frontend/src/lib/exercise-recommendations.js`, `recommendation-profile.js`, their relevant tests, and `components/WorkoutExerciseSuggestion.jsx`: explicit filtering, deterministic ranking, inspectable breakdowns, performed-history familiarity, and separate pending-session coverage. The soccer implementation imports no gym store, equipment catalogue, muscle/recovery model, strength-load prescription, or UI component.

Scope is **suggestions among supplied drills**, not a whole-workout optimizer, a training plan generator, a technique assessment, a medical/recovery model, or measured mastery. It never inserts a drill, changes an assignment/session, invents sets/reps/rest, transfers loads, or treats a suggestion as permission to change a trainer's prescription. Upcoming optional-session work must establish its own explicit identity and review before any insertion UI. Trainer assignments and their saved session snapshots stay immutable.

## Optional metadata schema (v1)

Existing drills without `metadata` remain valid. If present, only these fields are accepted:

This is an additive field in the first, unreleased catalog schema. Builds predating
the metadata extension reject snapshots that contain it. Once metadata-bearing
content is published, the retained rollback build must include this extension;
older builds are not compatible rollback candidates. Rejection preserves stored
data but does not make an old build able to resume it. Include this boundary in
the first hosted rollback/export-restore rehearsal.

```js
metadata: {
  version: 1,
  registryVersion: 1,
  tags: ['futbol:first-touch', 'Coach blue'], // optional, at most 32
  requirements: {                         // optional; missing fields are unknown
    settings: ['outdoor'],                 // optional, at most 8; alternatives
    equipment: ['ball', 'cones'],          // optional, at most 16; all required
    participants: { min: 2, max: 3, roles: ['passer'] },
    space: { lengthM: 10, widthM: 5 },
  },
  physicalEmphasis: ['coordination'],      // optional, at most 16; descriptive only
}
```

Labels contain 1–64 printable characters, normalize case/whitespace for matching, and remain child-facing bounded metadata. Participant counts are integers 1–64; optional maximum cannot be below minimum. `roles` is a required explicit list within a supplied participant requirement, at most 16. Roles mean available named roles, not inferred identities: a required partner must also be reflected in minimum participant count. Dimensions are finite 0–200 metres; space must fit both dimensions, allowing rectangle rotation. Unknown fields, unsupported versions, URLs in fields that are not defined, and invalid quantities are rejected. No private permission/provenance fields are added to this child payload.

An empty `equipment` list explicitly means no kit required. Empty `settings` means no setting restriction. `{min:1,max:1,roles:[]}` explicitly supports one participant. A known zero-by-zero minimum means no minimum space requirement. Omitting any such declaration does **not** assert those facts. Metadata tags such as “solo”, “no equipment”, or an exercise title cannot establish feasibility.

`physicalEmphasis` is optional editorial description. It has no automatic scoring or physiological inference. The engine does not derive it from text, skill tags or video, and does not apply a muscle-spacing or fatigue penalty.

`metadata.js` exports `validateDrillMetadata`, `validateTrainingContext`, `drillFeasibility`, `normalizeTrainingTag`, `normalizeTrainingTags`, `canonicalSkillTags`, `SKILL_REGISTRY_VERSION`, and the frozen `SKILL_REGISTRY`.

## Versioned skill vocabulary

Registry version **1** recognizes the following canonical labels and only its explicit aliases. Matching is case-insensitive; aliases map to the canonical string. Examples: `futbol:receiving` → `futbol:first-touch`, `futbol:ball-mastery` → `futbol:ball-control`, `futbol:finishing` → `futbol:shooting`.

| Canonical skill | Aliases |
| --- | --- |
| `futbol:ball-control` | `futbol:control`, `futbol:ball-mastery` |
| `futbol:dribbling` | `futbol:dribble` |
| `futbol:first-touch` | `futbol:receiving`, `futbol:first_touch` |
| `futbol:passing` | `futbol:pass` |
| `futbol:shooting` | `futbol:finishing`, `futbol:shoot` |
| `futbol:defending` | `futbol:defence`, `futbol:defense` |
| `futbol:scanning` | `futbol:awareness` |
| `futbol:weak-foot` | `futbol:weak_foot` |
| `futbol:goalkeeping` | `futbol:goalkeeper` |
| `futbol:aerial-control` | `futbol:aerial` |
| `futbol:change-of-direction` | `futbol:turning` |

Free-form labels, including unregistered `futbol:*` strings, can be exact tag filters but create no new skill relationship, mastery estimate, equipment claim or scoring category. Unknown requested focus labels appear in `ignoredFocusTags` and award no focus score. Future vocabulary/semantic changes require an explicit registry version update and compatible snapshot handling, not reinterpreting old labels silently.

## Pure ranking API

Import `rankTrainingDrills` from `src/domain/recommendations.js`:

```js
const suggestions = rankTrainingDrills(candidates, {
  now: Date.now(),                        // required explicit time, milliseconds
  history: savedFinishedSessions,         // default []
  activeSession,                          // default null, only for exposure/plan coverage
  context: {
    setting: 'outdoor',
    equipment: ['ball', 'cones'],
    participants: { count: 2, roles: ['passer'] },
    space: { lengthM: 12, widthM: 8 },
  },
  focusSkills: ['futbol:first-touch'],     // optional soft focus, at most 32
  requiredTags: ['Coach blue'],            // optional AND filters, at most 32
  excludedIds: [],                        // candidate IDs already seen/planned/declined
  strategy: 'balanced',                   // balanced | reinforce | diversify
  includeIneligible: false,               // true for review/debugging reasons
})
```

A candidate may be a raw drill **only when its ID is unique within this call**. Drill occurrence IDs are unique only within an assignment, so a catalogue spanning assignments should use immutable reference wrappers:

```js
const candidates = catalog.assignments.flatMap(assignment => assignment.drills.map(drill => ({
  candidateId: `${assignment.id}:${assignment.revision}:${drill.id}`,
  drill,
})))
```

`candidateId` is an opaque/composite stable key, 1–384 ASCII identifier characters (`letters/digits . _ : -`, starting with a letter/digit). Use a stable digest if the composite would exceed that bound. It is returned unchanged, used in `excludedIds` and stable tie sorting, and never changes `drill.id` or the snapshot. Duplicate candidate IDs/raw local IDs throw an actionable error rather than collapse different occurrences. Candidate order cannot change ties. The caller chooses exclusions using those exact candidate references; the engine does not silently suppress unrelated assignments sharing a local drill ID.

Each result is `{candidateId,drill,eligible,issues,metadataKnown,registryVersion,score,breakdown,skills,ignoredFocusTags,exposure:{performed,recent,pending}}`. The returned drill is a clone of the supplied drill, with its original prescription. Missing quantities remain missing; publication/optional-session code must still validate a complete prescription before using it. Ranking is not content publication validation.

## Feasibility and missing context

Every context field supplied by the caller is a hard constraint. `setting` must match a declared supported setting or an explicit unrestricted declaration; all required equipment must be available; actual intended participant count must be within the declared range; required roles must be supplied; both space dimensions must fit. Missing drill requirement metadata fails that active hard constraint with an `unknown-*` reason. A partner drill cannot pass a supplied solo context or missing required role.

Without a context field, that constraint is not evaluated. Thus `eligible` means **eligible under the supplied constraints**, not independently verified feasible, appropriate or safe. `metadataKnown:false` remains visible for legacy content. The caller must supply the real setting, kit, participants and space before presenting a suggestion as available to practice. Default results omit ineligible candidates. `includeIneligible:true` includes them after every eligible candidate, with specific mismatch/unknown reasons, regardless of score. A very high focus score never overrides infeasibility.

## What history means

Read skills from the immutable exercise metadata in each session's assignment snapshot, never from a newly edited catalog. Within a session, one drill occurrence contributes at most one opportunity/exposure per canonical skill, divided evenly across its skill labels. This counts opportunities, not comparable athletic workload across seconds/reps, and not mastery.

Performed exposure requires positive finite actual reps/time and a recorded `done` or `stopped` result. Positive stopped partial work is observed effort and can reinforce a skill even though it earned no completed-prescription credit. Completed zero reps/seconds, watch-only acknowledgment, pending work, unsupported modes, invalid timestamps, and future sessions/rows contribute none. A partial session with actual effort can contribute; a fully acknowledged video cannot.

Finished sessions use their finite end time, bounded by start and `now`. Active rows have no per-row completion timestamp in the current schema: use the session start conservatively rather than claim old saved work happened just now. Recommending later does not refresh its recency. Only the latest 90 days contribute performed history; old payloads are skipped before traversing drills. Duplicate session IDs do not double count. Recent exposure decays over 14 days; exact movement familiarity over 45 days. Familiarity matches stable ID, title/instructions, supplied prescription/media identity and canonical skill set, so a same local ID with changed skill content cannot borrow familiarity. No strength/load or unrecognized-tag similarity is inferred.

Pending coverage comes only from an active session's uncompleted non-watch rows and remains separate from performed exposure, including an old resumed session. It can discourage adding already planned skills but cannot establish practice, familiarity, fatigue or mastery. A partially practiced drill may legitimately appear in both performed and pending projections; they have different meanings.

## Inspectable opportunity score

Feasibility/filtering always comes first. The additive score then uses these editorial weights:

| Component | Rule |
| --- | --- |
| `focus` | Up to 40 for fraction of requested canonical skills matched |
| `coverage` | Reward less-covered skills: mean `1/(1 + recent exposure)` × strategy weight |
| `reinforcement` | Positive reward for recent performed skills, capped at one per skill × strategy weight |
| `planned` | Up to −20 for skills already pending; separate from actual exposure |
| `familiarity` | Small positive exact-movement performed-history prior, capped at 4 |
| `variety` | Small secondary novelty bonus 2, or repeat penalty capped at 3 |

Balanced uses coverage/reinforcement weights 12/14; reinforce uses 4/24; diversify uses 24/4. These are inspectable opportunity heuristics, not an empirically calibrated training prescription. Repetition is deliberately useful for skill reinforcement instead of receiving an unconditional muscle-spacing penalty. Focus and feasibility dominate; variety remains secondary. Scores/breakdowns are rounded to four decimals and ties use candidate ID lexical order, independent of locale or input order.

Tests cover optional backward-compatible schema, aliases/custom tags, bounded requirements, missing kit/partner/roles/space, unknown metadata, feasibility-before-focus, stable composite identity, strategy tradeoffs, separate pending coverage, zero/watch/future exclusion, observed partial exposure, conservative active recency, immutable snapshots, and no prescription invention or input mutation. This task adds no recommendation UI or assignment mutation route.
