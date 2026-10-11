# 005 — Replace production Uplift with the openGym fork

Accepted 2026-10-10. The owner authorizes replacing `uplift.quicktrack.cc` in the existing
`uplift` Worker. Coach remains out of scope. Supersedes ADR 001's deployment deferral.

Publish only `frontend/dist`, with browser-local workouts, optional Google Drive snapshot sync
and the existing Garmin v1 relay. Preserve the Worker name, custom domain, Durable Object class,
migration tag and rate-limit namespaces. Use version uploads/deployments with the existing
scoped release credential; do not provision routes or migrations during cutover.

The Worker build explicitly selects local mode, including offline cold launches. Account-server
controls are absent; local saving and Google Drive remain distinct. Keep server-owned copies,
owner metadata and pending changes if such a copy is encountered. Do not seed demo history.

Original Uplift IndexedDB, device credentials and the original Drive data graph remain untouched.
History is not automatically migrated into openGym's different schema. Preserve other apps'
service-worker caches for recovery; this worker reads its own shell cache first, so preserved
Workbox entries cannot serve the old app during an offline reopen. Original Garmin pairing is
not adopted: disconnect/re-pair the watch with the replacement phone app.

Exclude Gym Visual's separately licensed built-in images/animations from this branded production
build, with no CDN fallback. Exercise text, fallback thumbnails and user-owned local media remain.
The original dataset and normal upstream builds are unchanged.

Disable `dafepro/uplift`'s automatic deployment gate to prevent subsequent old-app pushes from
replacing the fork. Its manual release workflow can use the existing GitHub deployment secrets
for a pinned fork commit, or restore the pinned original app. Record the previous deployed
version before release. Rollback restores code only: preserve new local and Drive snapshots,
which the original app cannot read. No automatic downgrade or data conversion is promised.

Validate browser boot, preserved ownership, account UI gating, offline caches, Drive, Garmin
adapter and relay regressions, locale coverage and the production build. After release, validate
pair/claim/approval, snapshot handoff, event receipts/retries, command barriers and revocation
against the actual Durable Object service. Live physical Garmin/Bluetooth behavior still needs
owner validation; a protocol test does not establish wrist ergonomics or connectivity.
