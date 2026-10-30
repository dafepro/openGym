# QuickTrack Training

An isolated React/Vite application in the openGym fork. This foundation has a
Today/History route shell only. Family authentication, private catalog delivery,
media playback and workout persistence are not implemented yet. The default app
truthfully shows that training is unavailable.

From the repository root (Node 22.12+):

```sh
npm --prefix training ci
npm --prefix training run dev
npm --prefix training test
npm --prefix training run build
npm --prefix training run check:build
```

The regular Vite dev server is `http://127.0.0.1:4173/`; it fails if that port is
occupied. It serves only the training root. `npm --prefix training run preview`
serves the built application at the same port after stopping the dev server.
The independent production output is `training/dist/`. No root/frontend scripts,
dependencies, Uplift configuration or existing storage are modified.

The default build excludes the demo module. Explicitly opt in for synthetic UI
work, then inspect its visible sample warning:

```sh
VITE_TRAINING_DEMO=1 npm --prefix training run dev
VITE_TRAINING_DEMO=1 npm --prefix training run build
npm --prefix training run check:build -- --demo
```

Before preparing a release, run the default build and `check:build` again. Build
selection is compile-time: the browser cannot turn a normal build into a demo by
changing its URL or storage. `APP_BUILD` optionally supplies the visible build ID;
it must never contain a secret. Test runs use the default no-demo contract.

## Source and integration boundaries

- `src/main.jsx`: only browser mount and global stylesheet import.
- `src/App.jsx`: integration entry; initially foundation-owned, then UI owner.
- `src/config.js`: `APP_CONFIG` and `TRAINING_DEMO`, with independent identities
  and same-origin catalog/media paths. These reserve names; they create no cloud,
  storage, cache or service-worker resources.
- `src/lib/routes.js`: `ROUTES`, `routeFromHash(hash)` and `useHashRoute()`. Known
  route values are `today`, `history`, `practice`; anchors use `#/today`,
  `#/history`, `#/practice`. Unknown locations fall back to Today. Navigation
  does not own or initialize a session.
- `src/domain/`, `src/storage/`: domain owner's pure contracts and native browser
  persistence. Nothing in P0 initializes or reads a database or legacy gym keys.
- `src/components/`, `src/views/`, `src/styles/`: interface owner. P0 provides only
  `src/styles/index.css`; the UI owner can replace it with the shared design.
- `src/demo/`: explicit opt-in UI reference. Future fixtures must be reachable
  only through this compile-time branch. Domain fixtures remain synthetic.
- `fixtures/media/`: reserved for the coordinator's synthetic media assets. Keep
  them outside `public/`; only the explicit demo graph may import them.
- `worker/`: reserved for later media/family access work. No existing Uplift
  Worker, Garmin resources or uploader is imported.

Vitest discovers colocated `src/**/*.test.js` and `src/**/*.test.jsx`, uses Node
and resets mocks between tests. Pure domain tests need no simulated UI. The
upstream `fake-indexeddb` development tool is available for native IDB tests.
Runtime packages are React and ReactDOM; browser routing currently uses the
native hash-change event. New dependencies/import boundaries need explicit review.

`check:boundaries` validates literal JS/CSS imports against the isolated source
and dependency boundary. It is a focused guard, not a JavaScript parser or a full
privacy scanner. `check:build` verifies demo presence/absence, excludes source maps
and inherited exercise media, and checks the font license is distributed.

## Private content and scope

This repository is public. Real trainer catalogs, prescriptions, videos, source
tokens, permission evidence and athlete records must never enter public source,
`public/`, JavaScript, source maps, CI logs or retained application artifacts.
Keep real immutable catalogs/media in private R2 or deploy-controlled storage;
only an authenticated runtime API may deliver them. `.private/` is ignored for
local operations but is not a security boundary. Review the exact staged diff and
build inventory before publication.

No network calls, analytics, third-party font requests, authentication claims,
service worker or athlete storage occur in the P0 shell. The reserved family
access and resource names do not indicate a deployed or protected service.

See [upstream provenance](docs/UPSTREAM.md), [notices](NOTICE.md), and the
repository's [AGPL license](../LICENSE).
