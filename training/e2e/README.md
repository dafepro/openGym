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

Execution status on 2026-11-04: collection passes (36 cases). Local browser use
is disabled in Work settings, and the alternate headless-browser choice is
pending. These authored checks are not a claim that the flows or screenshots
have passed browser validation. The pull-request/manual Training checks workflow
also includes this suite and retains its report as `playbook-browser-review`; no
remote run has been triggered for this implementation checkpoint.
