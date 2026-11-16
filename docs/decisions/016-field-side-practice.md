# 016 — Field-side practice controls

Accepted 2026-11-16. Soccer players can place a phone several metres away.
Offer independent, session-only large display, audible cue and screen-awake toggles
in the existing practice dock. Keep the existing controls and session reducer.

Audio is synthesized locally after a user gesture: rising work tones, falling rest
tones, final-three-second ticks and a distinct return-to-phone cue. Do not replay
missed countdowns after backgrounding. Display unavailable/suspended states and
provide a test cue on enabling sound. Browser audio and device volume still limit
what a player can hear; no background playback promise is made.

Request the browser screen wake lock only when opted in and practice is active.
Release on hiding, completion or unmount, including late asynchronous grants.
Reacquire on return to visibility; report actual lock support, denial and release.
No fullscreen requirement, storage migration, new service or telemetry is added.

All timed expiry now enters the existing explicit time-review flow, even if the
page stayed visible. A lit screen and running timer are not evidence of work.
Preserve interrupted-time review, editable actual seconds, unfinished work and
explicit early completion. Rest expiry still becomes ready without starting work.
Historical records and backup schema are unchanged.
