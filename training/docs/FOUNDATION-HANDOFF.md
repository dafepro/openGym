# P0 foundation handoff

Implementation date: October 30, 2026. Branch: `codex/training-foundation`.
All changes are scoped to `training/`; upstream frontend/Worker/configuration and
Uplift browser storage remain untouched.

## Integration contracts

`src/main.jsx` mounts `App` and imports `src/styles/index.css`. The interface owner
replaces that initial stylesheet and later owns `src/App.jsx` integration.
The minimal P0 shell is deliberately an unavailable-family-access state; it is
not a functioning login, catalogue, player or workout engine.

`src/config.js` exports `APP_CONFIG` and `TRAINING_DEMO`. `src/lib/routes.js`
exports `ROUTES`, `routeFromHash(hash)` and `useHashRoute()`. Known values are
`today`, `history`, `practice`; anchors use `#/today`, `#/history`, `#/practice`.
The hook returns the current route string. Navigation has no session side effects.

Domain owns `src/domain/` and `src/storage/`; interface owns `src/components/`,
`src/views/` and `src/styles/`. Those empty reserved directories have no tracked
placeholder files. Coordinator owns `fixtures/media/`; worker ownership follows
in the media/access milestone. Tests can import synthetic `fixtures/`; production
code may import them only inside `src/demo/`. The boundary checker enforces that
literal-import rule. Real content never belongs in either fixtures or public assets.

The Barlow font and OFL are at `/fonts/barlow-condensed-latin-600.woff2` and
`/fonts/OFL.txt`, copied unchanged. The AGPL distribution copy is
`/licenses/AGPL-3.0.txt`. There is no upstream local Inter file, so body text uses
system sans. Notices/provenance are in `NOTICE.md` and `docs/UPSTREAM.md`.

## Verification evidence

- Standard `npm --prefix training ci` succeeds with the committed lockfile.
  Initial lock generation worked around an npm 10 optional-peer resolver crash;
  downstream installs require no special flags or global configuration.
- Three foundation tests pass with Vitest 4.1.12: independent identities,
  unavailable default shell, and bounded native hash routes.
- Import-boundary check and production build pass. Default output has one script
  and no synthetic demo sentinel/chunk. Explicit `VITE_TRAINING_DEMO=1` output has
  the sample chunk/sentinel and visible sample warning. Both output checks pass;
  the final local build was reset to the default no-sample mode.
- Full minimal-package `npm audit` reports zero vulnerabilities after scoped
  Vite 8.3.5/Vitest 4.1.12 updates. React/ReactDOM 19.2.8 and fake-indexeddb 6.2.5
  match the reviewed upstream lockfile. No Capacitor or gym runtime dependency.
- Copied font and license files compare byte-for-byte with their upstream sources.
- Browser CUA check in Chrome loaded `http://127.0.0.1:4173/`, rendered the default
  unavailable state, and changed to History through its visible navigation link.
  The resulting `#/history` heading/state and rendered layout were inspected.
  This is desktop shell evidence only; no phone, private media, auth or workout
  acceptance is claimed.
- Coordinator separately reports 102 existing Focus/model/routine tests passing
  and `npm run build:worker` succeeding at the baseline source. P0 introduces no
  changes to those paths; their baseline run is coordinator-owned evidence.

The dev server uses strict localhost port 4173. Stop this foundation server before
starting an integrated application on that port. No GitHub push, workflow change,
cloud write, credentials change or service-worker registration occurred in P0.
