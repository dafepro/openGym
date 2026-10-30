# Private Worker foundation

This implements the P3/P6 server boundary, not a deployed or phone-qualified
service. No source secret, account, domain route, cloud resource, upload operation
or production selection is created. The source configuration has `workers_dev`
and preview URLs disabled and no domain route. Deploy must supply the reviewed
production resource identities and secrets through its own controller.

## Routes and frontend contract

| Route | Behavior |
| --- | --- |
| `GET /api/health` | Nonprivate app identity/health only. It does not claim private content or access configuration is ready. |
| `GET /api/auth/session` | `{authenticated:false}` or `{authenticated:true,expiresAt:<UTC milliseconds>}`. Missing access configuration returns 503. |
| `POST /api/auth/login` | JSON `{accessKey:<43-character base64url key>}`. Requires exact same Origin; returns a signed session cookie on success. |
| `POST /api/auth/renew` | Requires the existing cookie, same Origin and working rate limiter. Extends session expiry within its absolute seven-day lifetime. |
| `POST /api/auth/logout` | Same-origin cookie deletion; returns `{authenticated:false}`. Does not remove local athlete progress. |
| `GET/HEAD /api/catalog` | Authenticated child catalogue projection only, after verifying selected private envelope hash/revision. |
| `GET/HEAD /media/<id>` | Authenticated MP4 streaming only for registry IDs referenced by approved drills in the selected catalogue. GET supports one byte range. |

Mutations reject absent/wrong `Origin` and explicitly cross-site fetch metadata.
Cookies are host-only `__Host-quicktrack-training`, `Secure`, `HttpOnly`,
`SameSite=Strict`, `Path=/`. The API never returns the cookie token in JSON. Store
neither the access key nor session token in browser storage or URLs. Cookie
handling belongs to the browser's normal same-origin fetch behavior.

Protected requests without a valid cookie return 401 JSON
`{error:'authentication_required'}`; malformed/missing server configuration or
storage failures return generic 503 without private diagnostics. Wrong access
keys return 401, wrong origins 403, and throttled login/renewal 429 with
`Retry-After: 60`. Preserve active local progress on an authentication failure and
offer reauthentication; do not reset the training database.

An exact allowlist exposes only the nonprivate application shell, hashed code/CSS
assets, local font/license files. `run_worker_first: true` prevents other static
paths bypassing route policy. The app release must contain no private catalogue,
instructions, provenance, media or athlete data. Unknown paths, arbitrary bucket
keys, media query overrides, proxy endpoints and YouTube URLs are never forwarded.
There are no training upload, publication, Garmin or account endpoints.

## Required configuration

| Name | Kind and contract |
| --- | --- |
| `APP_ORIGIN` | Exact HTTPS origin without trailing slash; production `https://train.quicktrack.cc`. Protected request URL and mutation Origin must match. |
| `FAMILY_ACCESS_SHA256` | Secret: lowercase SHA-256 hex of a high-entropy 32-byte random base64url access key (43 characters). This is not a human password verifier; do not substitute a short PIN/passphrase. |
| `SESSION_SIGNING_KEY` | Independent secret: 32 random bytes encoded as 64 lowercase hex characters, for HMAC-SHA-256 signatures. |
| `SESSION_EPOCH` | Private nonsecret opaque safe ID. Change to revoke every family's existing signed cookie. It must be supplied; there is no default. |
| `SESSION_TTL_SECONDS` | Integer 900–604800; default 43200 (12 hours). Renewal cannot extend beyond seven days from original login. |
| `CATALOG_REVISION` | Safe opaque selected private revision ID; no source URL or file path. |
| `CATALOG_SHA256` | Lowercase SHA-256 hex of the exact stored private envelope bytes. |
| `TRAINING_CONTENT` | Separate private R2 bucket binding. The Worker uses only get/head, never put/delete. |
| `LOGIN_LIMIT` | Training-owned Cloudflare rate-limit binding. Missing, failing, malformed or denied limiter responses never grant login/renewal. |
| `ASSETS` | Static build binding, pointing to `training/dist`. |

Only public origin and TTL defaults appear in source config. Secrets, epoch and
private catalogue selection are deliberately absent. The source's proposed rate
namespace `10931001` is not proof of an available allocation: deploy must verify
and assign a fresh account namespace before any real use. Never adopt Uplift's
namespaces, Worker name, Garmin bindings or R2 resources.

The limiter calls both a family-wide key and a hashed peer key with a six-request/
minute policy. Cloudflare rate limits are per-edge-location and approximate, not
a strict worldwide lockout. A shared family can be throttled together; choose the
reviewed operational threshold during qualification. The Worker emits no logs of
IP or access values. Cryptographic entropy is required in addition to throttling.

Signed cookies are stateless. Logout clears the requesting browser's cookie;
it cannot revoke a copied token independently of the rest of the family. A copied
token can remain usable until expiry or whole-family epoch/signing-key rotation.
Changing the access-key hash alone does not revoke existing cookies. If per-device
instant revocation is required, add a reviewed server-side session registry before
launch rather than claiming stateless logout supplies it. Already downloaded video
bytes cannot be recalled by any revocation method.

## Private publication contract

Keep real inputs, envelope bytes, receipts, source locators and permission evidence
outside this public repository and app release. The parent preparation tool emits
the following private envelope at `catalogs/<revision>.json`:

```json
{
  "schemaVersion": 1,
  "revision": "opaque-revision",
  "catalog": { "schemaVersion": 1, "revision": "opaque-revision", "assignments": [] },
  "media": [
    { "id": "immutable-media-id", "sha256": "<64 lowercase hex>", "byteLength": 1234, "contentType": "video/mp4" }
  ]
}
```

The abbreviated catalogue above illustrates the envelope shape only; an empty
assignment list is not a valid published selection. `catalog` follows P2's exact
child contract: current assignment ID/optional revision, dated assignment editions
and drills with explicit reps/time/watch, side, sets, rest and media availability.
The Worker independently checks those critical fields and projects only the child
fields, omitting any extra private provenance. The whole selected envelope is
bounded to one MiB and its exact digest/revisions are verified before use.

An approved drill media object is `{id,status:'approved',path:'/media/<id>'}`.
IDs are 1–128 ASCII letters/digits/dots/underscores/hyphens starting with a letter
or digit, so they cannot supply nested R2 paths. The only media key is `media/<id>`.
The registry has no arbitrary `key`/URL field. A registry entry alone does not
authorize delivery; it must also have an approved selected-catalogue reference.
Unavailable media is inaccessible even if its object/registry record remains.

Publication must verify actual file SHA-256, byte length and MP4 content type before
uploading an immutable object, set R2 `httpMetadata.contentType='video/mp4'` and
`customMetadata.sha256` to the verified file digest, and verify the stored object.
Do not overwrite a media ID with different bytes. Runtime compares head/get metadata
with the registry and guards the get with an ETag condition; it does not buffer and
rehash the whole MP4 during playback. Source/media permissions remain a separate
private record; server authentication is not permission to rehost.

The current implementation deliberately reloads/verifies the small catalogue
envelope for each protected media/catalogue request and uses no shared HTTP cache.
Measure R2 request volume/latency on a candidate before deciding whether to add a
bounded immutable private manifest cache. Any cache must remain behind the session
check and use the exact selected digest as its key.

## Streaming and cache policy

Media is streamed directly from R2. GET supports closed, open-ended and suffix
single ranges; malformed, multiple, zero suffix and unsatisfiable ranges return
416 with `Content-Range: bytes */<size>`. HEAD ignores Range and returns full-object
metadata without a body. Successful range responses have exact 206/Content-Range/
Content-Length; full GET is 200. ETag conditionals run only after authorization.
If-Range matching supports the exact strong ETag; any other validator falls back
to full GET rather than risking mixed bytes. Missing objects return 404 and
manifest/object metadata mismatches fail closed with 503.

All responses use private/no-store cache policy and `Vary: Cookie`; no public
R2 URLs, shared Cache API writes or CORS grants are exposed. The frontend/service
worker must also stay out of protected catalogue/media responses. Logout should
clear sensitive in-memory state while keeping local athlete records recoverable.
Offline media and physical-phone playback have not been qualified by these native
tests; neither is claimed here.

## Local validation without credentials or cloud changes

From the repository root:

```sh
npm --prefix training ci
./training/node_modules/.bin/vitest run --config training/worker/vitest.config.js
npm --prefix training run build
npm --prefix training run check:build
npm ci --ignore-scripts
WRANGLER_SEND_METRICS=false ./node_modules/.bin/wrangler deploy --dry-run --config training/wrangler.jsonc --outdir training/.private/worker-dry-run
```

The worker suite uses inline, explicitly synthetic catalogue/access values,
WebCrypto and local R2 fakes. It needs no operational secret, bucket or browser.
It verifies cookie signatures, wrong keys/origins, expiry/epoch/key revocation,
limiter failure, renew/logout, anonymous GET/HEAD/Range denial before R2, private
projection, selection tampering, traversal, approval withdrawal, range/conditional
behavior, metadata mismatch and the public-asset boundary.

The dry run is a local bundle/config check only; it uploads nothing. It lists
TRAINING_CONTENT, LOGIN_LIMIT and ASSETS plus origin/TTL defaults, with no secret
or selected catalogue configured. Existing root Wrangler/dependency advisories are
separate from the new training package; this work does not change that lockfile.

An unconfigured local emulator can exercise health, assets and fail-closed status:

```sh
WRANGLER_SEND_METRICS=false ./node_modules/.bin/wrangler dev --local --config training/wrangler.jsonc --ip 127.0.0.1 --port 8787
curl --fail http://127.0.0.1:8787/api/health
curl --include http://127.0.0.1:8787/api/auth/session
```

The latter is deliberately 503 while configuration is missing. For configured
local access testing, use operator-held synthetic credentials and a trusted local
HTTPS certificate. Wrangler 4.143 supports `--local-protocol https`,
`--https-key-path`, `--https-cert-path`, `--env-file <absolute external path>` and
`--var APP_ORIGIN:https://localhost:8787`. Keep local credentials outside the
repository; do not add `.dev.vars` here. Do not disable certificate verification,
relax Secure cookies or use `--remote` to make local tests pass. No configured
HTTPS/R2 integration or real-device acceptance is claimed by this foundation.

Observed local evidence: 16 native tests pass; Wrangler dry-run bundles the Worker
with the three isolated bindings and no configured secrets. A local workerd smoke
run returned health 200, unconfigured session 503 and public-shell HEAD 200 with
private/no-store policy and CSP. Its server was stopped after verification.
Compatibility date is pinned to `2026-10-03`, supported by the existing locked
Wrangler 4.143 runtime; the newer implementation date is not used as an unsupported
runtime compatibility date. No root package or lockfile was changed.

API behavior follows the current official [R2 Worker binding reference](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)
and [rate-limit binding reference](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/),
verified during implementation. Production preflight, credential custody, immutable
publication/promotion and retained code/content rollback remain P8 work in deploy.
