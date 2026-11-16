# Roadmap

- Implemented: local exercise recommendations for live workout Add, optional muscle targeting,
  alternatives, equipment-aware personalized prescriptions, and compact Uplift presentation.
  Setup now includes recent performed imports and today's work, exercise-specific defaults,
  missing plan fields, named estimates from narrowly matching variations and starting trials
  for unfamiliar exercises (ADR 011).
  Ranking, performance, lifecycle, persistence and mobile/reduced-motion checks are recorded in
  [the verification notes](dev/WORKOUT_ADD_RECOMMENDATIONS.md) (ADR 010).

- Synced openGym 1.4.1 through upstream `5ec23d3b`; retain the Focus/Drive/Garmin adapter design,
  isolate native release selection, and share phone/watch finish records (ADR 009). Future upstream
  session-phase changes may warrant a shared row-command interface; no engine rewrite is planned.

- Production cutover: existing Cloudflare Worker, local/Drive storage and Garmin relay; no Node API or Coach. Preserve original Uplift data and disable its automatic deploy gate (ADR 005).
- Club Elite Android handoff: verified dashboard intent with official store fallback. A direct external barcode route remains unverified; keep dynamic codes in the official app (ADR 008).

- Implemented: soccer preparation summaries before Start and clearer Create/Import
  actions (ADR 014). Follow-up: preserve generated setup as structured coach content;
  prose-only and legacy setup remain explicitly unspecified in the summary.

- Soccer improvement 4: coach desk review, player preview, target editing, revision
  feedback and exact-version approval; technical diagnostics remain available on
  demand. PR validation and operational limits are documented in ADR 017.

- Implemented: optional soccer field display, audible phase/countdown cues and
  browser screen-awake support. Timed expiry requires explicit confirmation;
  interrupted-time review and history formats remain intact (ADR 016).

- Implemented: full-screen night ball overlay with goals, scores, drag-to-kick and
  tap-to-dismiss. Removed tilt and visible controls (ADR 018).

- Implemented: practice-first soccer home, contextual feedback journal, and direct
  submission from a saved assigned session (ADR 020). Reuses the player, local
  history and actual-work renderer. Camera integration and broader coach queue
  consolidation remain tracked in openGym #52.
