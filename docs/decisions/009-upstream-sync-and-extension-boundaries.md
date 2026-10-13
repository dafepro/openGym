# 009 — Sync upstream and tighten extension boundaries

Accepted 2026-10-12. The owner requests upstream synchronization and a review of the Uplift seams.
Import all 15 commits from `b1cff630b3c30d8bad1f698a264d52314a029855` through
`5ec23d3b3ac68cbc09fbe450276f6db1995c83a6` (openGym 1.4.1 and the upstream CLA).
During review, PR #1 merged the 30 Uplift commits into `main` at `74e4946d`. Preserve that merge
ancestry and sync both `main` and the established release source `codex/focused-workout-overlay`.
Track upstream history with `upstream/main`; do not reset the fork's default branch to upstream.
Build publication does not authorize production promotion.

Retain Focus as a presentation of openGym's mounted workout controller, using its real rows,
load/rest/timed-set handlers and single local store. Retain the Garmin v1 translation adapter and
immutable Drive snapshot provider. A parallel workout engine or an upstream Node account backend
would increase scope and migration risk. Device credentials and active sessions stay outside Drive;
deterministic Drive tie-breaking remains opt-in so account-server merge policy is unchanged.

Tighten two boundaries exposed by this sync:

- Native release selection lives in `release-channel.js`. It queries only the Uplift fork, rejects
  draft/beta/non-version Worker releases and returns the chosen release to the upstream downloader.
  Preserve exact APK/checksum pairing. Adopt upstream disk streaming and native hash verification
  without installing an upstream openGym APK. Web updates retain explicit activation after saves.
- Phone and watch use `liveWorkoutRecord` and `commitLiveWorkout`. Record construction, warm-up-only
  classification and queue credit must agree; the phone retains its estimated-1RM display and
  backfill path. No completed working sets means no program advancement. Completed zero-rep,
  timed and single-limb work still count. Skipped and unrecorded rows retain their meanings.
  This uses the existing `warmupOnly` field; no format migration or historical rewrite is needed.

Preserve Worker media exclusion with MP4 and animated-WebP source selection. Coach remains gated
and deferred. Retain upstream CLA documentation, but gate its signature workflow to upstream;
fork synchronization does not create or sign a contribution agreement.

When upstream changes session phases or commands, consider a small action interface shared by
phone, Focus and watch. Do not move training semantics into UI or support row types the watch
cannot represent. The seven merge conflicts were in media, native updates, Settings, one locale
and generated API docs; none required a second store or training engine.
See [the detailed review](../dev/UPSTREAM_SYNC.md).
