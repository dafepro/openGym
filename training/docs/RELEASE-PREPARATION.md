# QuickTrack Training source releases

The source producer is `.github/workflows/training-release.yml` in
`dafepro/openGym`. It publishes **public application code only** from
`codex/quicktrack-training-release`. Private catalogues, videos, source evidence,
family access credentials and runtime secrets stay outside this release.
Deployment and private-content selection belong to `dafepro/deploy`; publishing
a code release does not deploy it.

## Trusted workflow

Pushes to the dedicated branch trigger on `training/**` or the producer workflow.
Owner-only manual dispatch (actor ID `313492551`) is accepted on that same ref,
when GitHub makes the workflow dispatchable. Both paths require repository
variable `QUICKTRACK_TRAINING_PUBLISH_ENABLED=true`. The publisher independently
checks the repository, full SHA, exact branch, exact workflow ref, event, manual
actor and positive run identities.

The single job is named **Publish immutable QuickTrack Training Worker** and
runs on GitHub-hosted Ubuntu 24.04. It installs locked dependencies, runs all
training tests, checks the explicit synthetic build, then rebuilds the ordinary
production app with `APP_BUILD=$GITHUB_SHA`. The production guard checks that
sample/private-preview modules and media are absent. Wrangler performs only a
local dry run. A smoke test runs the retained compiled Worker entry to check
health, public source notice routing and failure closed without private runtime
configuration.

The job retains the same local files through verification and publication; it
does not use Actions upload/download artifacts or depend on that storage quota.
The job has source `contents:write` permission; only its final publication step
receives `GH_TOKEN` and the existing `DEPLOY_REQUEST_TOKEN` request capability.
No Cloudflare token, runtime secret or deploy PR App key is provided. Existing
Uplift workflows, branches and installed self-hosted runner policies are not
changed. Do not push this work to `codex/focused-workout-overlay`, which has its
own Uplift release trigger.

## Retained artifact contract

Format **`quicktrack-training-worker-v1`** comprises permanent GitHub release
assets `worker.tgz` and `release-manifest.json`. The immutable release tag is
`deploy-production-<full-source-sha>-<run-id>-<run-attempt>`. Publication creates a
new release without overwrite flags; retries must not replace retained assets.

The schema-2 manifest contains:

- `format`, `sha`, `controllerSha` (both exact source SHA), `profile:production`
  and `checksum` (the archive SHA-256).
- `files`: exact regular-file path → SHA-256 inventory.
- `runtime`: compatibility date `2026-10-03`, binding names
  `ASSETS`, `TRAINING_CONTENT`, `LOGIN_LIMIT`, and `workerFirst:true`.
- `audit`: `demoIncluded`, `privateContentIncluded`, `sourceMapsIncluded`, all
  false.
- `source`: repository `dafepro/openGym`, exact revision and
  `path:assets/source.html`. The generated notice links corresponding source and
  its archive at that immutable SHA, plus the included AGPL license.

Only `worker/index.js`, the normal built `assets/index.html`, generated
`assets/source.html`, hashed app assets, the local Barlow font/OFL notice and AGPL
license are allowlisted. No catalogue JSON, media, environment file, Wrangler
configuration, source map, link, special file or alternate archive root is
accepted. Wrangler's local debug map and README are omitted; only its exact
terminal debug-map reference is removed from the retained Worker entry before
inventory/hash generation and compiled-entry smoke testing. No executable code
is modified after those tests. Preview/demo environment modes cannot package a
release. File inventory, archive digest and runtime/audit/source identities are
revalidated before publication. Size bounds are 128 MiB compressed / 512 MiB
expanded.

After upload, the publisher checks the permanent release identity and both
asset sizes/digests, writes `deploy-request.json` and records its public pointer
in the Actions job summary. It submits the standard schema-1
`quicktrack-training/production/training` pointer through the existing
`dafepro-release-request-v1` issue convention. A request failure leaves the
immutable release available for recovery from those identities. Central deploy
independently verifies exact successful workflow/run/attempt, trusted branch
ancestry, permanent asset IDs/digests, inventory and runtime compatibility.

The manifest declares binding **names**, not resource ownership. The source
Wrangler bucket/name/rate namespace are proposals for local compilation; they
are not bundled or adopted by deployment. Central configuration owns actual
resources, domain, secrets, content selection and version promotion. Source
request authority cannot edit private selection or infrastructure policy.

## Local verification

From the repository root (Node 22, Python 3, ffmpeg installed):

```sh
npm ci
npm --prefix training ci
npm --prefix training run test:all
APP_BUILD=$(git rev-parse HEAD) npm --prefix training run build
APP_BUILD=$(git rev-parse HEAD) npm --prefix training run check:build
# Output directory must not already exist; use a location outside the checkout.
APP_BUILD=$(git rev-parse HEAD) python3 training/scripts/release_bundle.py build \
  "$(git rev-parse HEAD)" /tmp/quicktrack-training-release
python3 training/scripts/release_bundle.py verify \
  "$(git rev-parse HEAD)" /tmp/quicktrack-training-release
```

`npm --prefix training run test:release` covers exact inventory preservation,
source revision binding, map/preview/demo/media/catalog/config exclusions,
symlinks and archive traversal/duplicates, tampering, trusted publication
identity, immutable upload arguments and retained-asset verification. Publisher
tests mock GitHub calls; they do not publish or submit requests.

This implementation does not itself establish that a workflow has run, that
retained release assets exist, that Cloudflare resources are configured, or that
the phone has passed production acceptance. Record those receipts separately
when central deployment executes. Private serving and withdrawal behavior are
described in [PRIVATE-HOSTING.md](PRIVATE-HOSTING.md).

### Verify the first producer run

After creating the dedicated release branch, confirm that GitHub has started a
`Publish immutable QuickTrack Training Worker` job for the intended full SHA.
Branch creation alone is not evidence that the path-filtered producer ran. A
subsequent reviewed change under `training/` can trigger the producer; select
only the retained release from its completed successful attempt.
