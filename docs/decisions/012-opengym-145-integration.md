# 012 — Integrate openGym 1.4.5 through shared domain boundaries

Accepted 2026-11-16 for the owner's request to sync the fork with current upstream.
Merge upstream `e4a68a94c42a3c17cbd560d66ce2e46a7048ab99` into Uplift, preserving
fork ancestry and the existing production source branch. This imports 2,005 upstream
commits since `e348fc17`, including per-exercise units, gym inventories, multi-reading
weigh-ins, session targets, circuits, imports and native/watch work. Synchronizing
source and publishing a build do not promote a production release in `dafepro/deploy`.

Retain ADR 009's adapters: one mounted workout controller and transactional store,
Uplift Focus presentation, Drive snapshots and the existing narrow Garmin relay
protocol. Do not add a parallel workout engine. Adapt at the following boundaries:

- Focus reads upstream exercise-unit views and session gym inventories; the controller
  converts edits back to profile units. Last-set editing must use that station's own
  units. Reviewed additions build on the appropriate equipment/unit grid and remain
  optional/non-progressing. Recent-work and unfamiliar-load estimates retain ADR 011.
- Both phone and relay finish through the same record/commit functions. Circuit
  programme advancement and one-session target consumption belong at this boundary;
  saved records exclude pending advancement instructions. Warm-up-only work still
  cannot advance a programme. Preserve skipped, unrecorded, timed and zero-rep rows.
- Keep the strict StrongLifts reader behind upstream's new multi-app dispatcher.
  Preserve zero-rep attempts and unknown sets, stable session identity, bodyweight,
  and import exclusions from current load caches; accept both LB and LBS columns.
- Use upstream's multi-reading merge. Drive supplies deterministic tie resolution;
  ordinary server merges retain their prior preference. Keep device credentials and
  active sessions outside cloud snapshots. No new fork schema is introduced.
- Upstream now owns shared print/card primitives. Put Uplift identity there rather
  than retaining obsolete duplicated renderers. Keep openGym attribution and licensed
  media exclusion. Keep the native icon generator consistent with the companion mark.
- Keep upstream base CSS intact and put fork presentation overrides in uplift-theme.
  Preserve explicit Finish, tabs during live workouts, and the Details/Focused switch.
  The historical editor retains upstream presentation and hides navigation.

Native publishing/signing remains upstream-only until a fork channel is deliberately
configured. Keep fork release selection, trusted Mac build preference, CLA guards,
Worker tests and no-media public builds. No new paid service, telemetry, account
backend, cloud resource or automatic infrastructure deployment is part of this sync.

The separate shared-host proposal lives in the private `dafepro/deploy` repository,
[PR 116](https://github.com/dafepro/deploy/pull/116). It is a plan, not an infrastructure
apply or part of Uplift's runtime migration.
