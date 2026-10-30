# Release preparation: disabled staging only

Prepared October 30, 2026. This is a P8 handoff, not deployment readiness or a live
release. The source training application and native Worker tests do not by
themselves establish an immutable source producer, central integrity adapter,
private-content publication, domain/resource ownership or phone acceptance.

The local `dafepro/deploy` checkout, branch `codex/quicktrack-training`, contains
disabled staging commit `a112a468bcc403304ee0e652c5aafd997c19940c` on inspected
base `bfb754c14d05f442b3a472d788fd19a5c69220dc`:

- `apps/quicktrack-training/target-contract.json`: exact future source/artifact/
  resource/content boundary and false execution capabilities.
- `apps/quicktrack-training/wrangler.json`: curated prebuilt configuration base
  with Worker-first assets, no routes/bindings/secrets and disabled workers.dev/
  previews. It is deliberately incomplete for private service deployment.
- `apps/quicktrack-training/content-selection.json`: null.
- `releases/quicktrack-training/production.json`: null.
- `apps/quicktrack-training/README.md` and isolated staging tests: evidence,
  activation prerequisites and rejection checks.

No shared deploy policy, workflow, runner, setting, credential or existing target
was modified. No GitHub push, release publication, secret transfer, resource
discovery, upload, provisioning or deployment occurred.

## Future producer decision

Use `dafepro/openGym`, dedicated branch **`codex/quicktrack-training-release`**,
new `.github/workflows/training-release.yml`, required job
**`Publish immutable QuickTrack Training Worker`**. The branch/workflow is an
explicitly uncreated proposal pending the complete reviewed implementation.
Publication is separately gated by `QUICKTRACK_TRAINING_PUBLISH_ENABLED=false`.
Trusted pushes are path-scoped to `training/**` and that new workflow; manual
dispatch is owner-only on the same exact ref, subject to GitHub's default-branch
workflow availability and the installed runner's reviewed exact-ref policy.

Uplift's current `.github/workflows/worker-release.yml` triggers on every overlay
branch push, including changes confined to training files. Keep training release
pushes off `codex/focused-workout-overlay`; do not alter/reuse the Uplift publisher
or assume a path filter on another workflow suppresses it. Preserve Uplift's source
and release authority. Upstream changes can be reviewed and merged deliberately
into the dedicated training branch.

The existing openGym Mac guard does not authorize push-triggered builds on the
proposed branch. Update both source policy and independently installed guard only
as part of the reviewed producer setup, with the exact workflow/ref/event boundary
and explicit hosted-runner override. No runner behavior is changed by this document.

## Missing integrity and publication work

The new source packager must build/test the normal no-demo app, package the exact
prebuilt Worker and assets under roots `worker/` and `assets/`, audit every file
and private-content boundary, and retain immutable `worker.tgz` plus
`release-manifest.json`. The proposed format is
`quicktrack-training-worker-v1`, using existing schema-2 source/controller/profile/
archive-digest identities plus an explicit training runtime, binding and audited
file-inventory contract. The final fields and rejection tests must be implemented
before registration; the staging format string alone is not a verifier.

The central `scripts/releases.py` currently allows specific existing producer
tuples and has an Uplift-shaped fallback for its non-ZoomiGo/non-static bundle.
Adding a training tuple alone would not validate its private-content/resource
contract. Implement an explicit training verifier, source publisher policy and
archive/provenance/tampering tests together. Then extend only the training code
pointer path in `scripts/validate-release-pr.mjs`; leave content/config/workflow
changes outside source release-request authority.

Source CI receives publication and the existing Issues-write request capability,
never Cloudflare credentials or the deploy PR App key. Verify the existing source
reader/request access and retained release/artifact capacity before promising an
operational publication path. No dummy SHA/run/release/version IDs are selected.

## Private content and resources

Real catalogue envelopes and videos remain in private storage. The future private
content selector is `{schema:1,revision:<opaque ID>,sha256:<exact envelope digest>}`,
selecting `catalogs/<revision>.json`. The one-MiB envelope contains the P2 child
catalogue and server-only media records with immutable ID/SHA-256/byteLength/
`video/mp4`; media keys are fixed `media/<id>`. See
[private hosting](PRIVATE-HOSTING.md) for runtime metadata and authorization.
Public source/build artifacts contain no real catalogue, prescriptions, media,
provenance, access key or session secret.

Before any first deployment, verify ownership/conflicts for Worker
`quicktrack-training` and hostname `train.quicktrack.cc`, allocate a separate
private `TRAINING_CONTENT` bucket and new `LOGIN_LIMIT` namespace, and configure
family secret custody/epoch. The source namespace number is a proposal, not an
allocation. The staged central config intentionally contains no adopted resource
bindings. Never borrow Uplift's identities, Garmin resources or rate namespaces.

Future deploy workflows must begin disabled under
`QUICKTRACK_TRAINING_PRODUCTION_ENABLED` and
`QUICKTRACK_TRAINING_PROVISIONING_ENABLED`, share a noncancelling target mutation
group, and separate infrastructure operations from routine exact-version
promotion. Deploy must pin code and private content selection from the same
reviewed controller commit, revalidate retained bytes/compatibility immediately
before promotion and use the exact version ID from its upload receipt. Routine
promotion must not rebuild code, provision DNS/resources or delete media.

Rollback needs retained source/artifact/content identities, the previous Worker
deployment/version receipt, compatible local data schema, recoverable exports and
retained media or explicit withdrawal handling. Reverting code cannot revert
browser state or restore withdrawn footage. A first deployment has no predecessor;
record that fact rather than inventing a rollback version.

## Evidence and limits

Deploy staging checks passed: seven new contract tests, 29 targeted Node release/
App-PR/runner/Uplift tests, global Prettier formatting, null-pointer offline
validation and all 45 Python tests using installed Python 3.13. The system Python
3.9.6 run encounters five pre-existing static-live fixture failures in
`urllib.error.HTTPError.geturl`; no shared code/settings were modified to hide them.

Targeted commands from deploy:

```sh
node --test tests/quicktrack-training-staging.test.mjs
/opt/homebrew/bin/python3.13 -m unittest discover -s tests -v
python3 scripts/releases.py releases/quicktrack-training/production.json --offline
npm run format:check
```

Tests also prove online null selection stops before asking for GitHub credentials,
the shared release policy rejects training, release-App PRs cannot write the new
pointer or private selector, and no executable training workflow/runner push
authorization is implied. These are meaningful disabled-state boundaries, not a
successful source publication, resource preflight, deployment or launch.
