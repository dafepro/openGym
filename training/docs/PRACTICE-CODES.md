# Portable practice codes

QT3 uses retained catalog editions to shorten shares without a link database. A code contains the catalog revision and a 128-bit SHA-256 dictionary fingerprint, ordered drill indexes, changed targets, the practice title/note, and inline payloads for unpublished drills. JSON is canonicalized, deflated, and base64url encoded. A final 128-bit content digest identifies the reconstructed practice. This is integrity checking, not proof of who authored a practice.

Dictionary order is the published assignments/drills order. Its fingerprint covers complete drill payloads (excluding occurrence IDs and current media approval). Never reorder or edit a published edition. Publish a new revision instead. The deployment publisher already enforces create-only catalog objects; retain old objects at `catalogs/<revision>.json` as long as their links should work.

Readers use the current edition when it matches, otherwise GET `/api/catalogs/<revision>`. The worker applies the same access mode as the current catalog and exposes only its sanitized child projection. Missing or changed editions fail explicitly. Historical media approvals do not restore playback: imported drills use only the current catalog's approved media.

QT1 legacy links and QT2 full payloads remain readable. QT3 and QT2 versions of the same practice retain the same saved-practice identity. Practices with no published matches remain QT2. Custom drill text remains embedded, so custom-heavy links can still be large. Imported practices store their resolved instructions locally; opening a reference on a fresh device requires the retained catalog edition.

Validation (2026-11-05): the original four-drill practice's production-origin link shrank from 1,130 to 234 characters, and medium-correction QR grids from 129 to 61 modules per side. Visible QR codes were decoded from screenshots at phone, 320px compact, and desktop sizes; each opened and started the reconstructed practice in a fresh browser context.
