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

Preserve workout history and distinguish unrecorded, skipped, zero-rep and timed sets. Keep
rest intervals explicit. Local saving, account-server sync, Google Drive and Garmin transfer
have separate, accurate status. Preserve durable local recovery and existing backup/protocol
compatibility. Never bundle private files, backups or notes.

Retain openGym copyright/license notices and attribution. The fork’s name is Uplift, while
About and onboarding link “Powered by openGym” to the upstream. Rebranding does not grant new
rights to licensed exercise media; public distribution needs a separate media-permission check.

Deployment remains a separate step. Publish only `frontend/dist`. Cloudflare/Drive hosting does
not provide the Node account, Coach, push or uploaded-media backend. Do not silently migrate the
original Uplift cloud data graph. See ADRs [001](decisions/001-uplift-watch-and-oauth.md) and
[002](decisions/002-uplift-visual-identity.md) and
[003](decisions/003-explicit-workout-views.md).
