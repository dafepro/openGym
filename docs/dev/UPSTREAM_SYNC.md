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

## Follow-up sync — 2026-11-16

Re-fetched upstream and fork origin after integration. Upstream main remains
`e4a68a94c42a3c17cbd560d66ce2e46a7048ab99` (1.4.5); fork main and the production
source branch began at `8d71dc690173c7bc779b81de494ccd3b69b0e6bd`. This merge imports
2,005 upstream commits while preserving both histories. See
[ADR 012](../decisions/012-opengym-145-integration.md) for the integration decisions.

The existing adapters remain useful. Adapt Focus at upstream's exercise-unit/gym
view boundary instead of duplicating its new unit engine. Both phone and watch
now build and commit the same completed-session record, including circuits and
session targets; warm-up-only finishes cannot advance a programme. Keep the
strict StrongLifts reader behind the new multi-app dispatcher, preserve unknown
and zero-rep rows, and exclude imported history from current load caches.
Drive's deterministic conflict policy now extends upstream multi-reading weigh-ins.

Adopt upstream's shared print/card rendering and use the Uplift mark there. Keep
base CSS unchanged, with fork presentation in the theme stylesheet. Preserve the
mounted controller, explicit Finish, live navigation, and full-width Details/Focused
switch. The production browser check caught and corrected a selected-segment contrast
regression caused by upstream's new dark-theme specificity, including scrollable
segments. Both light and dark selected labels meet 4.5:1 contrast in the built app.

Verification on synthetic data:

- Frontend: 925 files, 10,328 tests passed; native localization coverage passed.
  After the final CSS correction, all 26 theme/legacy-browser fallback checks passed.
- API: 1,085 tests passed. MCP: 153 tests passed. Worker: all nine tests passed.
- All 25 locale packs have matching 5,945 keys; strict source-string coverage passed.
- Fatigue/progression probes passed 108,000 history comparisons and 2,100 latest-record
  deletion comparisons. Recommendation benchmark with 5,632 exercises/4,000 workouts:
  cold 44.95 ms, warm median 7.51 ms and p95 10.84 ms on the local machine.
- Production local/no-media build and Worker dry-run passed. Existing build warnings
  concern large chunks and ineffective dynamic imports. No account backend or media
  directory is added to the Worker bundle.
- Chromium at 390 × 844 against built `dist/`: exercise-pinned pounds over a kilogram
  profile display/edit correctly; Home/Resume retains the edit; reload persists it;
  explicit Finish opens the completion flow. No browser page errors occurred.

Physical native builds, Garmin hardware and live Google consent were not exercised.
This sync publishes source/builds only; central production promotion is separate.
The DigitalOcean/state-ownership work is a proposal in private `dafepro/deploy`
[PR 116](https://github.com/dafepro/deploy/pull/116), not an infrastructure apply.
