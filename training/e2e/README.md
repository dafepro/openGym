# Playbook browser checks

These tests start an isolated Vite server on `127.0.0.1:4188`. They intercept the
catalog with synthetic software fixtures and serve the repository's original
playback test clip. They never request the production catalog, private videos,
or deployment credentials. Every test gets its own browser storage.

Run the isolated browser checks with:

```sh
npm run test:e2e -- --project=mobile-chromium
npm run test:e2e
```

Playwright browser engines must already be installed. `npx playwright test --list`
validates collection without starting a browser or web server.

Projects cover mobile Chromium, mobile WebKit, desktop Chromium, reduced motion,
compact 320×740 and short landscape 844×390. The suite exercises assigned practice, actual work recording, muted
demonstration playback, custom drill persistence, setup-compatible random
practice, encoded sharing into a fresh browser context and nested dialog/tap
regressions, paused-session reload, active discard and completed-session deletion.
Random seeds are deterministic in the random-practice scenario;
the actual selection and ranking algorithms run normally.

The HTML report and artifacts go under `.playwright/`. Key flow states have
attached full-page screenshots. Failed cases retain browser traces and failure
screenshots. Screenshots are review artifacts, not automatically approved visual
baselines. Review them against the approved Playbook concept before accepting a
run as visually validated.

Execution status: the final isolated browser run passed 64 active cases:
36 user-flow journeys, 12 frame-sampled motion checks, 12 native-media/recovery
checks and 4 layout-stress cases. Eight inapplicable stress/project combinations
are deliberately skipped (the compact boundary is tested on both mobile engines
and reduced motion; CSS zoom is tested only on desktop Chromium).

Frame samples verify real intermediate translation/opacity, continuous outgoing
and incoming drill content, stable work controls, persistent navigation, inert
visual snapshots and complete cleanup. Media tests verify actual native looping,
speed, mute resets, and recovery from injected playback failure. Layout stress
covers 320×568, long text, a 12-drill rail, 10,000 reps, and a 24-hour timer. The 200%
CSS zoom fixture is explicitly not evidence of OS text scaling or hardware testing.

The pull-request/manual Training checks workflow includes this suite and retains
its reports as `playbook-browser-review-linux-chromium` and
`playbook-browser-review-macos-webkit`. The five Chromium projects run on Linux;
the iPhone WebKit project runs on native macOS for Safari-platform media and
frame timing. Every project retains the same flow, motion, and playback assertions.
Linux software WebKit also passed the flow/media cases but did not consistently
sample intermediate frames of short composited animations.
Playwright is pinned to 1.63.0 while
investigating Linux WebKit failures with 1.64.1; that version has a documented
[rendering regression](https://github.com/microsoft/playwright/issues/43426).
All browser assertions remain enabled. The actual four-video screenshot harness
is separate:

```sh
TRAINING_VISUAL_BUNDLE=/absolute/path/to/approved/bundle.json \
TRAINING_VISUAL_OUTPUT=/absolute/path/outside/git/screenshots \
node scripts/playbook-visual-review.mjs
```

It expects a normal local Vite server on port 4189, intercepts its API/media routes
inside the isolated browser, and never changes the production catalog. The bundle
is validated by the private-preview loader. Keep private screenshots outside Git.
