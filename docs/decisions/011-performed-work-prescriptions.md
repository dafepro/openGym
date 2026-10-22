# 011 — Populate workout additions from performed work

Accepted 2026-10-22. After selecting a recommendation, the owner found an unknown load and
generic 2 × 10/rest defaults. The owner explicitly requests intelligent automatic setup.

Extend ADR 010's evidence boundary for a proposal shown before adding: completed work within
21 days may supply actual reps, duration and load even when imported, lacking an app target,
or excluded from progression. Completed work today is eligible too. The blanket import
exclusion in ADRs 006/010 remains in force for normal progression and historical load caches,
but no longer prevents this deliberately reviewed, recent-work proposal. Never use old or
future records, warm-ups, skipped/unrecorded rows, zero-rep attempts as proof of a working load,
or an all-time-best cache. Never update a routine, progression baseline or history as a side
effect. Imported/non-progressing/live evidence cannot earn a progression increase.

Prefer explicit saved exercise fields. Fill missing fields from the latest exact exercise's
performed work, including zero-weight placeholders in an otherwise saved plan. Keep its
saved targets when present. A higher chosen rep target can reduce a recent load; it cannot
increase it. Preserve bodyweight added load, unilateral totals, timed work, stamped units and
per-bell/combined meanings. Snap down to available loads (assistance up); an unavailable load
does not round up to the lightest available bell.

Without exact evidence, allow a named, visible estimate from a narrow family of the same
free-weight movement and equipment: front raise, lateral raise, hammer curl, biceps curl,
shoulder press or bench press. Do not transfer a shoulder press or lateral raise to a front
raise, or use muscle overlap as load evidence. Explicit bell meanings are required for
different variations. Discount a variation by 20%, adjust down for higher reps, and discount
another 10% for high effort/fatigue before inventory snapping. These factors are conservative
editorial heuristics, not validated strength ratios. The card marks estimates with `~`; its
explanation names the source exercise. An unsupported weight still requires the user's choice.

Cold setup distinguishes isolation work (12 reps), compound work (8 reps) and recognizable
static holds (45 seconds). Missing rest uses at least the user's default and 150 seconds for
compounds or 90 for other work; explicit exercise rest/default-off semantics remain intact.
Keep the optional one/two-set cap and reduce volume near the hour or with high effort/fatigue;
never shorten rest to fit. These are broad coaching defaults, not individual recovery or
suitability claims. General context: [ACSM progression guidance](https://pubmed.ncbi.nlm.nih.gov/19204579/).

Live Browse selections receive the same setup before configuration/commit. Historical editing,
swaps and routine configuration retain their existing behavior. The existing controller,
transactional store, backup schema and watch protocol are unchanged. Add regression coverage
for recent target-less imports, today, no-progression holds, units/meanings, unknowns, narrow
transfer, rest and the real configuration/commit seam; recheck catalogue/history latency.
