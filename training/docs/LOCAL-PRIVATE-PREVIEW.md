# Local private video preview

This development mode reads a private bundle from outside every Git checkout at runtime. It does not provision family access, publish videos, deploy a site, or place private catalog/media bytes in application assets. Use it on a trusted local computer; it is not production authentication or a distribution mechanism.

Create a manifest outside Git, alongside a validated child-safe catalog and locally prepared MP4s:

```json
{
  "schemaVersion": 1,
  "catalogFile": "catalog.json",
  "media": [
    { "id": "opaque-video-id", "file": "media/clip.mp4" }
  ]
}
```

The catalog follows the existing content schema. Each approved `media.id` has exactly one manifest entry, and its child path stays `/media/<id>`. Every approved media identity in retained assignments must be available. Unavailable media needs no file entry. Do not add source URLs, rights records, credentials, absolute filesystem paths, or operator metadata to the child catalog. Keep those parent records private and separate.

Files must be regular, nonempty files contained under the manifest directory after symlink resolution; catalog files use `.json`, videos `.mp4`. Escapes, files in Git checkouts, duplicate/unused media entries, missing approved videos, and invalid content fail validation. Prepare browser-compatible H.264/AAC MP4s and inspect technique/framing separately; the manifest validator is not a codec or training-content reviewer. Treat bundle files as immutable while the server runs and restart after replacing them.

Run from `training/`, with the environment variable scoped to this one development command:

```sh
TRAINING_PREVIEW_BUNDLE=/absolute/path/outside-git/bundle.json npm run dev -- --port 4175
```

The variable intentionally has no `VITE_` prefix. The browser receives an opt-in boolean, then fetches the validated catalog from `/__training-preview/catalog`. The absolute bundle path and media bytes are never embedded in JavaScript. Video GET/HEAD requests stream only allowlisted `/media/<id>` files, including bounded/open/suffix byte ranges. Responses use `no-store`; invalid ranges return 416. Unknown media returns 404. The middleware does not implement or fake `/api/auth/*`.

The server must bind loopback. Private requests reject non-loopback peers/Host values, foreign Origin headers and cross-site embedding. Keep Vite's strict filesystem allowlist; do not proxy this server to another machine or expose it through a tunnel. Local processes on the trusted computer can access the preview. Close the server when finished. No production family-access guarantee is implied.

The interface labels this mode **Private local preview** and stores progress in the separate `quicktrack-training-private-preview` IndexedDB database. Clearing that preview database affects only its local records. Watch-only collections use Start review / Mark reviewed / Videos reviewed and record no athletic quantities. They become prescribed work only when a new assignment edition supplies real quantities. Portrait video uses a taller fit-contain frame after metadata loads; it must not crop the body or ball.

Private-preview mode and the synthetic demo are mutually exclusive. `npm run build` and `npm run preview` refuse to run with `TRAINING_PREVIEW_BUNDLE` set. Unset it for normal or synthetic builds. Both artifact checks reject the private-preview client module. Tests use disposable generated files outside Git, not user content:

```sh
npm run test:private-preview
npm run test:all
npm run build
npm run check:build
VITE_TRAINING_DEMO=1 npm run build
npm run check:build -- --demo
```

Only generic code and these instructions belong in source control. Real bundles, videos, private source IDs, and review screenshots containing private content remain outside the public source artifact.
