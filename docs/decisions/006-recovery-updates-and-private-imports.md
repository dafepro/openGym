# 006 — Watch recovery, deliberate updates and private imports

Accepted 2026-10-11. The owner requests pairing recovery, readable watch instructions,
explicit application updates, dynamic Club Fitness check-in, StrongLifts imports and Drive
plan imports. Coach remains deferred.

The existing companion beta gains a confirmed **Pair again** action using the same beta ID
and signing key. Persist credential removal before requesting a new code; retain the cached
workout, queued operation IDs and finish receipt. Cancel requests and invalidate late callbacks.
A failed local write keeps the old credentials. The phone can explicitly revoke the original
relay connection using its original device-local credentials, read without creating an absent
database or importing history. Receive old queued results first; revoked server mailboxes cannot
be recovered. Never erase the original database or transfer watch tokens to Drive.

New service workers wait for **Update**. Save through the normal local persistence/owner boundary
before activation and again immediately before reload. Activation in another tab never reloads
this tab. Storage or profile-handover failures retain the running UI and explain the failure.
First installation may activate automatically. Keep previous offline recovery caches on failed install.

Club Elite+ / Club Fitness is a user-selected app/store shortcut in the existing gym-card data.
Its dynamic QR and login stay in the official app. Accept HTTPS destinations without URL credentials;
never fabricate a current check-in QR or embed authenticated pages. Existing static cards keep working.
No new cloud service, telemetry, gym credential storage or QR scraping is introduced.

StrongLifts CSV imports are separate from Strong exports. Preserve blank, zero-rep and timed sets,
units, distinct same-day sessions, notes, dated body weight and stable re-import IDs.
The profile keeps one weigh-in per day: use the latest logged session from the export, reject
conflicting measurements at the same time, and leave existing profile measurements untouched. Reject ambiguous or invalid values
rather than invent completion. Imported StrongLifts history remains available for review/statistics,
but never seeds current working loads or progression. A plan may set `historyScope: "routine"` to
use only records belonging to that new routine and ignore shared load suggestions. This additive
plan field round-trips through plan export/import and does not require a storage schema migration.

Drive imports preview before writing. The phone's file picker can use its Drive provider without
additional OAuth. An optional selected-file link requests separate read-only Drive consent, with a
memory-only token sent only to fixed Google API origins, no redirects/cookies, timeout and 5 MB bound.
This consent is broader than app-data sync; describe it accurately and do not enable sync as a side
effect. Native Sheets/Docs require an export. Settings also routes backup JSON through the existing
confirmed backup-restore flow. Personal training plans and evidence remain outside this repository,
public assets, fixtures and bundles; save them privately to the owner's Drive.

Verification includes import/plan roundtrips, local-save refusal, actual SW activation, readonly
legacy-pairing recovery, URL/download boundaries, gym shortcuts and the companion simulator suite.
Live Google consent and physical wrist/Bluetooth checks remain distinct from automated protocol checks.
New English release wording is explicitly carried as fallback in translated packs pending translation.

Release checks also exposed a calendar bug in western time zones: date-only initial months were
parsed at UTC midnight and opened the previous month. Interpret calendar days at local noon.
