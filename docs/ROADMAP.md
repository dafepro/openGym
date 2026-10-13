# Roadmap

- Synced openGym 1.4.1 through upstream `5ec23d3b`; retain the Focus/Drive/Garmin adapter design,
  isolate native release selection, and share phone/watch finish records (ADR 009). Future upstream
  session-phase changes may warrant a shared row-command interface; no engine rewrite is planned.

- Production cutover: existing Cloudflare Worker, local/Drive storage and Garmin relay; no Node API or Coach. Preserve original Uplift data and disable its automatic deploy gate (ADR 005).
- Club Elite Android handoff: verified dashboard intent with official store fallback. A direct external barcode route remains unverified; keep dynamic codes in the official app (ADR 008).
