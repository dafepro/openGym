# Garmin companion in openGym

**Settings → Data & backup → Garmin watch** connects the existing Uplift Connect IQ app on the Forerunner 245 Music. The phone and watch interfaces are both branded Uplift; the phone is powered by openGym.

The existing companion targets `https://uplift.quicktrack.cc/api/garmin/`. The prepared Cloudflare config preserves the original Worker and relay resource identities. This branch has **not** replaced the live site. A watch cannot reach a laptop's localhost. Pairing is available locally for protocol testing; real-watch testing requires an owner-approved HTTPS deployment.

## Pair and train

1. Drain/export any queued results in the original Uplift app before switching.
2. Disconnect the old watch pairing. Open Uplift on the watch and generate a fresh eight-character code.
3. In openGym choose **Pair watch**, enter the code, and confirm the matching four digits on the watch.
4. Start/configure the workout on the phone. Keep the phone app visible to transfer entries. Garmin Connect must remain installed and connected to the watch.
5. Use the existing physical-button controls for preparation, warm-ups, reps, station selection, skip rest, next exercise and confirmed finish. Loads/targets stay configured on phone.

A lost pairing response resumes with the saved credential. Expired/revoked pairings need a new code. Readiness means the watch recently acknowledged the current snapshot. It does not claim every offline outbox entry has arrived or that Google Drive has backed it up.

## Compatibility and recovery

Supported: ordinary bilateral rep sets, zero reps, optional warm-up rows, plate guidance for a single bar convention, explicit per-hand matched dumbbells, preparation and station commands, rest skip, confirmed next exercise and finish. Manual workout start/configuration remain on phone. No automatic movement counting or Garmin FIT recording.

Use phone for timed/cardio/per-side rows, supersets, drop sets/rest-pause, ambiguous or total-pair dumbbells, single-stack plate loading, multiple bars, over-limit sessions or a session whose row identities were reordered/rebuilt after handoff. The watch protocol supports 60 working sets, 12 warm-ups per station/120 total, loads ≤2000, reps ≤100, rest ≤600 seconds and a 14 KB snapshot. Do not round or truncate a prescription to fit these limits.

Warm-up recovery has a firmware limitation: the existing companion projects warm-up entries without a rest timer. The phone retains openGym's configured recovery and sends its current timer on transfer. Keep the phone visible and follow its prescribed warm-up recovery; offline warm-up recovery is not supplied by this firmware. Working-set timers remain cached on watch. Do not interpret a watch Ready screen after a warm-up as a changed rest prescription.

Conflicting/stale entries preserve phone results and enter **Watch entries need review**. Export that inbox before dismissing rows; make corrections in the phone workout/history editor. Old undo commands are reviewed instead of rewriting results. A full review inbox leaves additional entries unacknowledged on the watch. Workouts and saved timestamps survive retries; elapsed rest does not restart on late delivery.

Credentials live only in `gym_garmin_device_v1`. Results and bounded local receipts/reviews save together in `gym_state_v1`; `_watch` is excluded from Drive, account-server writes and ordinary backup exports. Explicit review exports contain only the entries the user chooses to export. Original Uplift data/credentials are neither imported nor erased.

## Local runtime and deployment candidate

```sh
npm install
npm --prefix frontend install
npm run build:worker
npm run dev:worker
# A second terminal:
npm --prefix frontend run dev -- --port 8080
```

Vite proxies `/api/garmin` to local port 8788; `GARMIN_TARGET` can override it. Other `/api` routes still reach the normal Node server in development.

For production the Worker serves only `frontend/dist`, plus the same temporary Garmin relay. The account-server endpoints intentionally return unavailable; use local mode and optional Google Drive. This deployment does not replace Node/SQLite account hosting, Coach or server-uploaded personal media.

`npm run check:worker` bundles a dry run only. No new bindings, migration tags, routes or rate-limit namespaces were introduced. Routine releases should preserve the owner's existing separate release/admin credentials. Do not run a provisioning deploy to reconcile the custom domain as a side effect of a frontend change.

No watch binary, signing key or private workout files are copied into this repository. Continue using the owner's existing validated companion; physical wrist ergonomics/Bluetooth throughput remain unverified for this adapter.
