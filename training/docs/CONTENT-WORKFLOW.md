# Preparing a private assignment edition

The child app plays first-party MP4s. A YouTube link is intake information, not
an upload instruction. Ask the trainer for files and permission for the intended
family audience, then retain the original and permission record privately. Never
commit real catalogs, coaching instructions, footage, permission evidence or
progress exports to this public repository.

Install FFmpeg (including `ffprobe`) locally. Prepare H.264 video with yuv420p
pixel format, optional AAC audio, and MP4 packaging. Prefer a fast-start MP4 with
the metadata at the beginning. The command inspects streams and duration, but
actual phone playback still needs qualification. It neither downloads YouTube
content nor transcodes files or guesses a training prescription.

In a private directory outside **all Git checkouts**, author an input JSON file:

```json
{
  "catalog": {
    "schemaVersion": 1,
    "revision": "edition-opaque-id",
    "currentAssignmentId": "assignment-id",
    "currentAssignmentRevision": "assignment-edition-id",
    "assignments": []
  },
  "media": [
    {
      "id": "immutable-media-id",
      "file": "./permitted-original-or-derivative.mp4",
      "permission": {
        "status": "approved",
        "reference": "private-evidence-record-id"
      }
    }
  ]
}
```

This is a shape example, not a valid publishable assignment. Fill `assignments`
using the [domain contract](domain-contract.md), with exact trainer-supplied sets,
repetitions/duration, side, rest and instructions. A missing rest prescription is
`null`; a prescribed zero rest is `0`. Mark missing or withdrawn media unavailable.
An approved drill references `{id,status:"approved",path:"/media/<id>"}`. Media
IDs must change whenever bytes change; assignment revisions must change whenever
their prescription changes. Preserve previous assignment editions in the catalog
when they should remain available.

Run from the repository root with private absolute paths:

```sh
node training/scripts/prepare-catalog.mjs /private/location/input.json /private/location/new-edition
```

The output directory must not exist and its parent must already exist. The tool
rejects Git checkouts even through symlinks, requires an exact approved media
inventory and a permission reference for each item, copies the files once,
validates their streams, and hashes the copied bytes. Files are created with
private filesystem permissions. A failed preparation leaves an incomplete output
for inspection; it is never eligible for publication. A successful
`publication-report.json` has status `prepared-not-published`.

The prepared directory contains:

- `media/<id>`: verified MP4 bytes, without a URL to an external video service.
- `catalogs/<revision>.json`: private runtime envelope with the child-safe
  catalog and server-only media hashes, lengths and MIME types.
- `publication-report.json`: private permission references and inspection
  results. **Do not upload this report or put it in an application artifact.**

The command prints only opaque catalog selection values and a media count. It
does not upload objects, provision storage, change secrets, deploy or activate a
new assignment. Preparation is not evidence that permission was granted; the
operator must retain and review the referenced permission record.

## Publication and rollback contract

Publication remains a separate operator step once the private bucket and release
target are configured. Upload media first under `media/<id>`, with HTTP metadata
`contentType: video/mp4` and custom metadata `sha256` exactly matching the receipt.
Enforce create-only immutable keys; a previously used key may be reused only when
the complete recorded bytes/hash match. Check all remote lengths, hashes and MIME
metadata before uploading the exact catalog bytes to `catalogs/<revision>.json`.
The Worker refuses inconsistent metadata and serves only media approved by the
selected catalog. Do not depend on bucket obscurity for access control.

Select `CATALOG_REVISION` and `CATALOG_SHA256` together through the reviewed deploy
configuration. The SHA is over the exact prepared envelope bytes, including the
trailing newline. Changing selection must not mutate either catalog. Keep the
previous selection receipt for a content rollback; an active or historical
session retains its original prescription snapshot. A withdrawn asset should be
unavailable to old sessions as well—do not revive it just to satisfy a rollback.

Remote publication, atomic selection, object immutability checks and the rollback
rehearsal are release gates. This local command does not claim to have performed
them. No real trainer material has been qualified in this initial implementation.
