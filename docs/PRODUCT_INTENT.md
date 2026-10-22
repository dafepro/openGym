# Uplift fork intent

Uplift is a personal strength-training app powered by openGym. Keep the main gym workflow short,
clear and practical with one hand. Focus shows the next action, with state transitions near the
bottom. The pinned workout header keeps Finish visible in both layouts. A full-width two-button
switch below it explicitly selects Workout details or Focused, preserving the current set and
timers. Details expand from their toggle; that same button closes them. Keep
nonessential information behind a deliberate action and use short labels and intuitive icons.

Use the original Uplift athletic visual system: charcoal/slate surfaces, pale lime actions,
condensed headings and large stable numbers. Color identifies warm-up, work, rest and completion.
Brand the fork with the companion's U-and-up-arrow mark and the original lowercase sans-serif
`uplift /` wordmark; reserve condensed uppercase type for workout headings and statistics.
Motion acknowledges taps and changes of phase, stays interruptible, and respects reduced motion.
Support existing appearance preferences with readable light and custom-color variants.

Live workout Add offers one local exercise recommendation without requiring filters. Optional
muscle targeting, non-repeating alternatives and the full library remain quick to reach. Use
recent training, estimated fatigue, today's volume, familiarity and available equipment; show
personalized sets, reps, load and rest before adding. Saved plans and recent app targets can
inform the proposal, while old/imported records and historic-best caches cannot seed a load.
Unknown weights remain explicit choices. Budget optional volume, preserve rest, and keep copy
and motion compact. These are coaching heuristics, not recovery measurements (ADR 010).

Preserve workout history and distinguish unrecorded, skipped, zero-rep and timed sets. Keep
rest intervals explicit. Local saving, account-server sync, Google Drive and Garmin transfer
have separate, accurate status. Preserve durable local recovery and existing backup/protocol
compatibility. Never bundle private files, backups or notes.

Retain openGym copyright/license notices and attribution. The fork’s name is Uplift, while
About and onboarding link “Powered by openGym” to the upstream. Rebranding does not grant new
rights to licensed exercise media; public distribution needs a separate media-permission check.

The owner has authorized the Cloudflare production replacement (ADR 005). Publish only `frontend/dist`. Cloudflare/Drive hosting does
not provide the Node account, Coach, push or uploaded-media backend. Coach is deferred. Do not silently migrate the
original Uplift cloud data graph. See ADRs [001](decisions/001-uplift-watch-and-oauth.md) and
[002](decisions/002-uplift-visual-identity.md) and
[003](decisions/003-explicit-workout-views.md).

Updates wait for an explicit Update action and verified local saves. Watch pairing recovery preserves
queued results and never imports the original application's history. Dynamic gym check-in stays in the
owner's official gym app, reached through a saved shortcut. Android Club Elite shortcuts open
the verified official app dashboard with a Play Store fallback; its barcode remains an explicit
tap inside Club Elite until an external barcode route is verified (ADR 008). Check-in slides share stable header,
card and control positions; remembering the selected card must not interrupt a swipe. StrongLifts CSV and Drive plan/backup imports
preview before changing data; historical exports must not seed new working loads. Personal coaching plans
remain private and distinguish source evidence from symptom-dependent assumptions. See ADR 006.

Track `upstream/main` and merge its changes into Uplift's `main` and established release source
branch. Focus uses the existing workout controller; Drive and Garmin remain separate adapters
around the same local store. Phone and watch share finished-record construction and commit;
warm-up-only sessions preserve their routine's place. Native updates use a fork-owned release
channel alongside upstream's downloader. See ADR 009 and the upstream integration review.
