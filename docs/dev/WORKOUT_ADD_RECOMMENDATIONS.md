# Workout Add recommendations — verification

Implemented against the synced fork at `38e0fed` (ADR 010). Ranking and prescription are pure
domain modules; the sheet invokes the existing mounted workout controller. No store, schema,
backend or watch protocol was added. All verification data is synthetic.

The default Add path requires no filter. Another walks the existing ranking without rescanning
history, excludes every previously shown ID for that visit, and offers an explicit restart at
exhaustion. The optional muscle filter requires a primary-muscle match. Equipment profiles,
bench/pull-up accessories, existing exercises and high estimated fatigue constrain eligibility;
empty results never silently relax them. Commonness is an editorial movement/equipment prior.

Prescriptions use saved settings and recent target-bearing app sessions, including chosen
progression overrides, units, logged effort, available loads and rest. Imports, old records,
future records, excluded progression sessions and historical-best caches cannot seed a load.
Unknown load opens configuration; reviewed values alone build the entry. Optional sets are
capped at two (one near the hour, with high effort or elevated fatigue). Rest is resolved through
the existing controller and never shortened for time. Bodyweight added load, each/combined
dumbbells, assistance direction, partial limbs and disabled default rest retain their meanings.

Regression coverage:

- Pure ranking: cold start, deterministic ties, completed versus skipped/unrecorded/warm-up
  work, zero reps, timed/partial unilateral work, recency, fatigue, planned volume, equipment,
  primary-muscle filters, exclusions and no mutation. Old workout payloads outside the recovery
  pool are never traversed.
- Prescription: saved/current-routine preference, actual recent load, stale/unknown/imported
  inputs, kg/lb and dumbbell conversion, added bodyweight load, plate inventories, assistance,
  exercise progression overrides, RIR/RPE/misses, rest inheritance and late-workout volume.
- Real components/controller: alternatives, exhaustion/restart, muscle selection, live equipment
  changes, unknown-weight configuration, details/Browse, stale-session rejection, details and
  Focus insertion, intact supersets, current selection, unchanged prior rows/routines/history,
  preserved rest deadline/owner, transactional local saves, backup reading, Drive exclusion of
  live sessions and ordinary completed-record/watch serialization.

Local validation on 2026-10-22: all 5,261 frontend tests in 428 files passed; all nine Worker
tests passed. The existing fatigue probe passed 108,000 monotonic comparisons plus 1,800 latest
deletion comparisons. Production Worker build, locale parity (18 languages) and strict source
string coverage passed. Build retains the existing chunk/dynamic-import warnings.

Browser checks used Chrome with 390 × 730 and 320 × 730 frames, dark/light/custom accent,
a long custom exercise name, explanations, alternatives and a real Add commit. No horizontal
overflow; Add/Another stayed at y=599 with 50px targets when switching matches/explanations.
DevTools reduced-motion emulation reported `reduce` and computed `animation-name: none`.
These are desktop-browser viewport checks, not a physical-device performance measurement.

Run the reproducible synthetic benchmark from the repository root:

```sh
node frontend/scripts/benchmark-exercise-recommendations.mjs
```

With Node 22.22.0, 5,632 catalogue exercises and 4,000 workouts (six exercises × three sets),
one measured run took 47.71 ms cold; warm median 8.72 ms / p95 12.31 ms over 30 runs.
Thirty alternatives had median 0.11 ms / p95 0.19 ms. These timings describe the development
desktop, not a phone SLA; the script is intentionally outside timing-sensitive CI assertions.

Recovery, spacing thresholds and the 21-day load-evidence window remain coaching heuristics.
They do not measure physiological recovery or establish medical suitability. No private files,
notes, analytics, network calls or persistent dismissal history feed the engine.

## Performed-work setup follow-up (ADR 011)

The owner reported a front raise opening at 2 × 10, zero load and default rest. The original
prescription ignored imports, target-less sessions, optional work excluded from progression,
and today's completed sets. It also left Browse additions on generic defaults. ADR 011
replaces that evidence restriction for a reviewed proposal; old records and historic-best
caches remain excluded, and imports/optional/live work never earn progression increases.

Focused checks now cover recent imported actual reps/load, missing plan fields, current work,
held progression exclusions, cold isolation/compound/hold defaults, unit stamps, bodyweight
added load, exact exercise identity, narrow same-movement estimates, ambiguous bell meanings,
single/two-bell conversion, legacy unilateral totals, and the configuration/commit seam.
All 34 focused checks passed after the final domain changes; the full frontend suite passed
before the two added unilateral regressions. Nine Worker tests, production build, locale
parity and strict source-string checks passed. No backup/storage/protocol format changed.

A Chrome check with synthetic recent imported front raises opened the real configuration
sheet at **2 × 12, 15 lb, 1:30 rest**, then committed two rows with exactly those values.
The same controller coverage verifies suggestion quick-add and preserves existing rows/timers.
No personal workout data was used. The temporary preview files were removed before building.

Latest synthetic desktop benchmark (5,632 exercises / 4,000 workouts): cold 48.64 ms, warm
median 9.18 ms / p95 12.86 ms, alternatives median 0.13 ms / p95 0.32 ms. No phone SLA is implied.
