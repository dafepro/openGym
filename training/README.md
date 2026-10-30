# QuickTrack Training

An isolated soccer-training app inside the openGym fork. Today, Practice and
History connect approved demonstration videos to repetition, timed, each-foot
and watch-only prescriptions. Playback and set timing remain independent. Local
resume, partial outcomes, immutable history, export/restore, single-tab ownership
and interrupted-timer review are implemented.

The default build uses the family-access API. The Worker implements signed
sessions, private catalog delivery and authenticated MP4 range streaming from R2.
This is implemented source, not a deployed service. Real trainer content,
configured HTTPS/R2 browser qualification, release publication and physical-phone
checks remain pending.

## Local sample

From the repository root, with Node 22.12+:

```sh
npm --prefix training ci
VITE_TRAINING_DEMO=1 npm --prefix training run dev
```

Open `http://127.0.0.1:4173/`. The sample uses visibly synthetic prescriptions and
an original eight-second test pattern, **not soccer instruction**. Its separate
`quicktrack-training-demo` database does not mix with real progress. The server
binds localhost and fails if the port is occupied.

Without demo mode, the app checks its same-origin family-access API. Plain Vite
has no Worker, so the default local screen correctly reports that training is not
connected. See [private hosting](docs/PRIVATE-HOSTING.md) for local Worker checks.

## Verification and builds

```sh
npm --prefix training run test:all
npm --prefix training run build
npm --prefix training run check:build
```

The content-preparation tests need FFmpeg/ffprobe and use only a synthetic clip.
The independent output is `training/dist/`; no existing Uplift build, Worker,
database or gym integration is modified. For an explicit sample distribution:

```sh
VITE_TRAINING_DEMO=1 npm --prefix training run build
npm --prefix training run check:build -- --demo
```

Run the default build and guard again before preparing a release. The sample
catalog/module and clip are absent from default artifacts; browser URLs/storage
cannot enable them. `APP_BUILD` may identify a nonsecret build. No service worker
or offline video cache is installed.

## Contracts and operations

- [Domain and persistence](docs/domain-contract.md): immutable prescriptions,
  actual-versus-target outcomes, timers, recovery and export validation.
- [Private content workflow](docs/CONTENT-WORKFLOW.md): prepare permitted local
  MP4s and a child-safe catalog outside Git, with hashes and private provenance.
- [Private hosting](docs/PRIVATE-HOSTING.md): endpoints, cookies, media registry,
  byte ranges, revocation, configuration and exact limitations.
- [Release preparation](docs/RELEASE-PREPARATION.md): disabled deploy staging,
  remaining producer/verifier work and launch/rollback gates.
- [Upstream provenance](docs/UPSTREAM.md) and [notices](NOTICE.md): adaptation and
  local font/license attribution.

Runtime packages are React and ReactDOM. Native hash routes keep the controller
mounted above views. Web Locks prevent competing tabs; unsupported browsers show
a read-only state. Storage failures retain work for retry/export without claiming
it was saved. Clearing site data can erase progress; this version does not sync
devices.

This repository is public. Real catalogs, footage, permissions, source tokens and
athlete records must never enter source, public assets, JavaScript, source maps,
CI logs or retained application artifacts. Import/build checks are focused
guards, not a complete private-data scanner. Review staged files and release
inventories before publication. Real training content belongs behind private
runtime endpoints.
