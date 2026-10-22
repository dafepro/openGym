# Upstream integration review — 2026-10-12

Upstream: `DuarteSantos8/openGym`, head `5ec23d3b3ac68cbc09fbe450276f6db1995c83a6`.
Uplift: `dafepro/openGym`, production branch `codex/focused-workout-overlay`, previous head
`fb8a6478d077e054a89a5d02ff646f72b462c49c`. It had 30 fork commits and was 15 upstream commits
behind; `main` was an unmodified upstream mirror at `b1cff630`.

During this review, PR #1 merged the existing Uplift branch into `main` at `74e4946d`, with the
same source tree. Preserve that new ancestry and sync both branches; `upstream/main` now serves
as the upstream tracking reference.

## Incoming changes

openGym 1.4.1 preserves distinct same-day Strong/Hevy sessions, ranks favourite/used exercises
ahead of unused search results, shares type filtering between picker and Library, and adds chart
date ranges. Android improvements use animated WebP, preserve animation timing, stream APKs to
disk with native hash verification, and duck music for rest tones. Coach changes stay behind
existing capabilities. The CLA workflow is gated to upstream rather than imposing it on this fork.

All 15 commits are merged. Media retains Uplift's no-media Worker contract; native updates retain
the fork release channel and exact checksum pairing. Locale conflicts retain both sets of entries.
Generated API docs use asset version 26. StrongLifts stable IDs and load/progression isolation
coexist with upstream's Strong/Hevy session grouping. Tests use synthetic history only.

## Extension review

| Addition                 | Boundary                                                              | Assessment                                                                                                                                                     |
| ------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focus and thumb controls | `WorkoutFocus`, pure selectors, handlers from mounted `ActiveWorkout` | Keep. Real rows, load cascades and timer ownership are shared with Details.                                                                                    |
| Appearance               | `brand`, `uplift-theme`, components, native identity assets           | Keep. Mostly isolated; persistence and protocol names are stable.                                                                                              |
| Drive                    | `cloud-sync` provider, `google-drive`, owner-aware store merge        | Keep. Immutable verified snapshots suit local-first hosting. Deterministic merge is the broadest domain patch: retain its opt-in policy and convergence tests. |
| Garmin                   | v1 schema, pure adapter, durable `commitWatch`, expiring Worker relay | Keep. Results and receipts commit before acknowledgment. Frozen row identities, unsupported-type rejection and review protect stale delivery.                  |
| Live finish              | Shared commit, previously separate record construction                | Tighten now. One record builder prevents phone warm-up-only finishes from consuming a routine.                                                                 |
| Imports                  | Dedicated parsers and preview UI, narrow progression exclusions       | Keep. StrongLifts history cannot prescribe current loads; incoming Strong/Hevy grouping coexists.                                                              |
| Updates                  | `useAppUpdates`, save-for-update boundary, native downloader          | Keep web activation. Extract native release selection so upstream changes cannot restore upstream APKs or mistake Worker tags for app versions.                |
| Check-in                 | Gym-card data and official-app intent adapter                         | Keep. Dynamic barcode and login stay in the official app.                                                                                                      |
| Hosting                  | Local/no-media Worker, immutable bundles, central promotion PR        | Keep. Fork owns builds; central repository owns credentials and manual promotion. Sync does not deploy.                                                        |

## Next boundary to watch

`ActiveWorkout` remains a large upstream controller, and Garmin knows Focus preparation keys and
rest selectors. If upstream changes session phases or row commands, extract a small action
interface consumed by Focus and Garmin, tested for rest, skipping, completion and stale identity.
Avoid a parallel engine or broad rewrite during routine merges. Drive whole-state snapshots merit
a performance review as history grows; this sync changes neither snapshot format nor storage.

Update drifted descriptions: Mac-first trusted builds with manual central promotion, and Finish
in the shared workout header. Physical Android/Connect IQ behavior and live Google consent
remain distinct from automated checks.

## Verification

- Frontend: 424 files, 5,226 tests passed, including Focus/lifecycle, Drive convergence,
  import idempotence/progression isolation, watch receipts, deliberate updates and new native
  download/channel checks.
- API: 597 tests passed, including upstream compatible-endpoint fallback. Worker: 9 tests passed.
- Eighteen locale packs and strict source-string coverage agree; generated API docs agree.
- Production local/no-media build and Worker dry-run pass. Progression/fatigue probes pass.
- Chromium at 390 × 844: warm-up-only and zero-rep phone finishes preserve set meanings, local
  records and queue behavior; offline reload renders the app and retains the completed record.
  This uses only synthetic data and plain static `dist` hosting, manually registering the built
  worker on localhost because application registration is HTTPS-only. Vite preview adds
  `Vary: Origin`, so its responses are not a representative offline cache fixture.

No production promotion, physical Garmin sync, native Android build or live Google consent is
part of this verification. Existing build warnings concern chunk sizes and dynamic imports.

## Follow-up sync — 2026-10-22

Fetched fork origin at `13923f57` and upstream main at
`e348fc17c42c7e9a211c5972e573ad3698190ee2`. The only new upstream commit corrects CLA PR-comment
handling and adds collection from upstream's pinned CLA issue. It changes no application,
workout, storage, import, Drive or Garmin code.

Merge that commit and extend ADR 009's upstream-only repository guard to the new issue workflow.
Keep both `main` and `codex/focused-workout-overlay` aligned. Validate both workflow documents and
their repository/event conditions, formatting, production local/no-media build and Worker dry-run.
The archived original Uplift repository's main was verified through the connected GitHub account
at `aa4c2838`, matching its preserved local checkout. Production promotion remains a separate
manual action. Workflow conditions, formatting, all nine Worker tests, the production build and
Worker dry-run passed for this follow-up.
