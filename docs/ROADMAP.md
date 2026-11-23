# Roadmap

- Implemented: local exercise recommendations for live workout Add, optional muscle targeting,
  alternatives, equipment-aware personalized prescriptions, and compact Uplift presentation.
  Setup now includes recent performed imports and today's work, exercise-specific defaults,
  missing plan fields, named estimates from narrowly matching variations and starting trials
  for unfamiliar exercises (ADR 011).
  Ranking, performance, lifecycle, persistence and mobile/reduced-motion checks are recorded in
  [the verification notes](dev/WORKOUT_ADD_RECOMMENDATIONS.md) (ADR 010).

- Synced openGym 1.4.5 through upstream `e4a68a94`; retain the Focus/Drive/Garmin adapter design,
  isolate native release selection, and share phone/watch finish records (ADRs 009/012). Per-exercise units, gym inventories and multi-reading Drive merges use upstream domain helpers. Future upstream
  session-phase changes may warrant a shared row-command interface; no engine rewrite is planned.

- Production cutover: existing Cloudflare Worker, local/Drive storage and Garmin relay; no Node API or Coach. Preserve original Uplift data and disable its automatic deploy gate (ADR 005).
- Club Elite Android handoff: verified dashboard intent with official store fallback. A direct external barcode route remains unverified; keep dynamic codes in the official app (ADR 008).
- Shipped in the starter chooser: editable StrongLifts 5×5 and 3×5 A/B rotations ([ADR 013](decisions/013-editable-strength-templates.md)).
