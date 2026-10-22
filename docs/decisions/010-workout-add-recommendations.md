# 010 — Local exercise recommendations for workout Add

Accepted 2026-10-22. The owner requests a fast rules engine for one recommended exercise,
optional muscle targeting, easy alternatives, and personalized weight, reps, sets and rest.

Only Add in a live workout opens this surface. Show one match immediately, with an optional
muscle selector, the active equipment profile, a compact prescription and estimated extra time.
Another dismisses that exercise for this picker visit without repeating it; exhaustion offers
an explicit restart and the full catalogue stays one tap away. Close without changing anything.
Routine editing, swaps, past logging and saved-workout editing retain their existing pickers.

The pure ranking engine uses completed work in the last 90 days for familiarity, weighted
muscle exposure in the last week, time since muscle work and the last session, the existing
fatigue model (including completed current sets), favourites, current plans and today's pending
volume. Exclude exercises already in today's session, unavailable equipment and missing required
accessories. An equipment label the selected profile cannot establish is not recommended, but
remains available through deliberate catalogue browsing. A muscle filter targets primary muscles.
High estimated fatigue can leave no suitable match; do not quietly relax the constraint. Common
movement/equipment priors are editorial heuristics, not measured population popularity or claims
of universal safety. Recovery is an estimate, not physiological clearance. Never infer diagnoses
or restrictions from private notes. History remains unchanged, including skipped, unrecorded,
zero-rep, warm-up, timed and partial unilateral rows.

The displayed match alone gets a prescription. Prefer the current routine's exercise settings,
then another explicitly saved plan. A recent completed app session with an actual target may
inform working load and the user's existing progression rule; limit that evidence to 21 days,
exclude non-progressing sessions and ignore future records. Old records, imported history without
an app target and the historic-best `exWeights` cache cannot seed a current load. This extends
the owner's earlier exercise-only request with the explicit request to propose weight and reps;
show the proposal before adding it. An unknown load opens the existing configuration sheet.
Keep bodyweight distinct from added load, convert stamped kg/lb and dumbbell meanings, honour
owned dumbbells, plate inventory, base bar weight and assistance direction. Snap loads down
(assistance up), never manufacture an unsupported starting weight. A recent miss/high effort
prevents a harder load (more ordinary weight or less assistance), reduces optional sets and may
lengthen positive rest to 120s. Resolve rest through the existing controller helper: a zero
exercise override inherits the default; a zero global default stays off. Bodyweight rows carry
added load, not body mass, and dumbbell previews identify each/combined meanings.

Use one or two optional sets, reducing volume near the hour or with high recent effort. Keep
the saved rep/duration target and explicit rest; never save time by shortening rest. Only today's
new entry changes. Recommended accessory doses use the existing per-entry no-progression flag
so two optional sets cannot earn progression credit for a full planned session; the existing
exercise menu can opt that entry back in. Deliberate catalogue additions retain their normal
progression eligibility. Existing sets, routine prescriptions, progression exclusions, rest ownership,
recovery deadlines and the single workout store retain their existing controller semantics.
No schema, migrations, network dependency, telemetry, cloud resource or persistent dismissal
history is introduced. Reloaded sessions retain additions through existing transactional storage,
Drive and Garmin paths, with no new protocol fields.

Keep copy sparse, controls at least 44px and Add/Another/Browse stable across matches and
on-demand explanations. Reuse Uplift tokens, shared selectors and media fallbacks. A finite
150ms acknowledgement respects reduced motion; timer ticks must not replay it. Cache catalogue
features by object identity, bound history windows, reuse the ranked list for alternatives, and
perform load/progression work only for the displayed candidate. Verify large-history latency as well as cold starts, filters, no-repeat
alternatives, equipment/load feasibility, units, stale/unknown data, lifecycle and persistence.
See [verification notes](../dev/WORKOUT_ADD_RECOMMENDATIONS.md).
