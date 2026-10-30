# Foundation provenance

Reviewed upstream: `dafepro/openGym`, commit
`8d71dc690173c7bc779b81de494ccd3b69b0e6bd`, production source branch
`codex/focused-workout-overlay`. This is the revision selected by the inspected
Uplift deployment pointer during planning; it is not live-deployment evidence.

P0 introduces an independent training package. No workout-engine code has been
copied yet. React and fake-indexeddb versions match the reviewed upstream lockfile.
Vite 8.3.5 and Vitest 4.1.12 are scoped compatible updates to resolve the three
advisories reported against the older upstream development-tool versions. Runtime
integration deliberately excludes its gym store,
catalogue, Garmin, account/cloud synchronization, personal uploads and Capacitor.

Unmodified copied files:

| Source | Training destination | License |
| --- | --- | --- |
| `frontend/public/fonts/barlow-condensed-latin-600.woff2` | `public/fonts/barlow-condensed-latin-600.woff2` | SIL OFL 1.1 |
| `frontend/public/fonts/OFL.txt` | `public/fonts/OFL.txt` | Font license text |
| `LICENSE` | `public/licenses/AGPL-3.0.txt` | Repository license text |

The minimal shell adopts the reviewed Uplift palette and Barlow display identity;
body text uses system fonts because no Inter font file is present in the reviewed
public font folder. P0 CSS/components are new and do not copy a whole Uplift screen.
Future engine adaptations must append exact source paths, behavior changes and
regression evidence here. Preserve notices and provide source correspondence for
the exact release when publication is implemented.

No production publishing workflow, Worker or resource contract has been enabled.
The intended deployment remains a new `quicktrack-training` target through
`dafepro/deploy`, with its own hostname/bindings and private catalog selection.
