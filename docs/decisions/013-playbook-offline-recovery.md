# 013 — Playbook offline recovery

Accepted 2026-11-16. The owner selected the next high-priority soccer improvement
while a separate workstream completes individual assignment deployment (ADR 012).

The player must be able to reopen an already downloaded app and continue saved
work without waiting for the catalog server. Load existing IndexedDB progress
independently of network requests. Keep one bounded, validated catalog in a
separate versioned local-storage record; a failed or invalid replacement leaves
the last valid copy intact. If that cache is missing or damaged, construct a
temporary library from validated active, saved, or historical practice snapshots.
Label that recovery as device-local content, not a new coach assignment. Never
modify those snapshots, recorded outcomes, or the existing progress schema.

Precache the public production shell and its exact build assets with a dedicated
service worker. Samples and private previews do not install it. The worker does
not intercept catalog/auth/coach/player API requests, videos, external resources,
query-string URLs or mutations. Catalog persistence is explicit application
storage after anonymous fetch and schema validation, not HTTP response caching.

Install a complete shell before activation. Do not force a waiting worker to
activate, claim an open tab, or reload a session. A waiting worker activates after
all tabs using the previous worker close. Navigation tries the deployed HTML
with a three-second bound, then falls back to the complete installed shell.
A confirmed 404/410 for the service-worker script after successful online navigation
retires the worker and only its shell caches, allowing rollback to earlier releases.
Network failures and 5xx responses never trigger retirement. Delete only older Playbook shell caches
after activation, preserving progress, catalog data and other applications' caches.
No cloud sync, offline result-submission queue, downloaded videos, or new cloud
resources are added. Coach/player actions require a connection and retain their
existing explicit submission behavior.

Offline reopening requires one successful online shell installation. Browser
storage eviction or clearing site data can remove it. Offline content may be
out of date; reconnecting refreshes the library without rewriting active work.
Bound catalog requests to eight seconds and retain an explicit retry action.

Validation includes cache corruption/quota boundaries, interrupted installation,
cache isolation, production-shell reload/resume and reconnection in Chromium and
native WebKit. WebKit tests drop server connections directly because Playwright
1.63's offline emulation rejects service-worker navigations (upstream #42775).
This is not a claim of physical-phone field validation. The deploy controller
must allow the audited optional `assets/sw.js` file before promoting this release.
