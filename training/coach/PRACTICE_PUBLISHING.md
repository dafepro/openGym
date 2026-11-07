# Coach practice publishing

Routing label: `coach:practice`. Runtime model: `gpt-6-luna` through Responses.
This file describes the workflow; it is not copied as a preamble into each PR.

## From a coach brief

1. Require Google Access identity and the server allowlist before showing the form or accepting a request. Keep the player app public.
2. Accept a 20–1,000 character soccer brief and at most 20 optional contacts. Normalize email/phone inputs and deduplicate them. Recipient names, addresses and submitter email stay in the authenticated coach desk and private queue, never public GitHub or model input.
3. Run the stored prompts in `prompts.js`: classify, research, then compose strict practice JSON. Search is limited to three tool calls. Every drill needs a real researched YouTube link, setup, sets/time/reps, rest, side and a focus cue. Prefer brief, single-drill demonstrations. Longer footage needs a researched excerpt of at most 120 seconds; never invent timestamps. The player and shared practice retain those exact bounds. Verify video metadata through YouTube oEmbed. Availability does not establish instructional quality: the video is prominently linked in the PR for review.
4. A deterministic compiler appends one practice to `training/public/practice-additions.json`. It cannot change code, workflows, secrets or previously published practices. The original assignment remains current; a generated practice is assigned through its share link.
5. Create one PR on `coach-practice-<request-id>` against `codex/quicktrack-training-release`. Include the overall goal, each drill's quantities, video thumbnail/title/channel, recipient counts and private recipient link, and likely overlapping practices. Suggest a numbered progression when drill names substantially overlap; do not silently rename it.
6. Watch for the owner's `CHANGES_REQUESTED` review or `/coach <feedback>` comment. Re-research and update this PR, at most three times. Only GitHub user ID `313492551` can direct revisions or approve publication. Checkpoint feedback before paid work, so a restart cannot charge twice. If research fails, preserve that feedback and classify the stage; the coach can explicitly retry the same revision once without creating a second request or losing its private recipients.
7. Merge only the exact owner-approved head, authored by the publisher App, with exactly one data file changed and all three training checks passing. A new revision or catalog refresh needs fresh approval. External branch edits stop automation.
8. Source Actions build the immutable release and request the existing deployment pointer PR. The deploy repository's ten-minute schedule accepts only data-only source PRs merged by this publisher, validates source checks and immutable producer provenance, and requires a trusted exact-head pointer-validation receipt. It never rolls production backward or merges unrelated application changes. The coach service watches source checks and release builds; the deployment controller watches pointer validation and production. Each may retry a failed workflow once for the same commit. A trusted, idempotent source-PR receipt carries deployment progress back to the coach desk. A second failure exposes the workflow link for attention; it never triggers unapproved code edits or more paid research.
9. After production deployment, compare the actual HTTPS catalog, source ancestry and a decoded compact practice pass with the reviewed practice. Only then show the ready link and attempt configured notifications. Provider acceptance is not a delivery receipt. If email/text is not connected, retain the private recipients and show “share the link.”

## Existing approved issues

An owner-applied `coach:approved` label imports the existing fenced JSON schema
`quicktrack-coach-practice-v1`. The last label event must be by the owner, and the
issue must not have changed after approval. Every drill still requires a verifiable
video. The imported body and approval event are hashed/pinned; removing the label,
editing the issue or requesting a revision invalidates that approval. Valid imported
issues can publish without an additional PR approval. The source issue closes only
after the practice is actually live.

## State and recovery

`queued → processing → creating_pr → submitted → publishing → ready → notified`

`submitted → revising → creating_pr` updates the existing PR. A closed PR stays
closed. Interrupted model or notification operations become `attention`; they are
not automatically repeated. PR writes reconcile the deterministic branch and data
before retrying. GitHub/publication polling uses increasing backoff and stops after
ten failures. All jobs expire after 30 days; published catalog entries remain.

Append-only catalog prefixes carry their own content hash. Old compact practice
codes resolve the exact historical prefix even after new practices are added.

## Credentials and cost boundaries

The publisher GitHub App is installed only on `dafepro/openGym`, with Contents,
Pull Requests, Issues and Actions write, and Checks/Commit Status read. Actions access is used only for inspecting workflow runs and one failed-run retry per exact revision. Its RSA key remains
in the protected runtime environment/server file; short-lived installation tokens
are minted in memory. It has no Cloudflare deployment or GitHub Actions secrets.
The existing separate deploy App selects the final release pointer.

Luna stays explicitly configured with low reasoning effort and bounded output budgets. Three Responses calls per initial request or
requested revision, maximum three research tool calls per pass, maximum three
revisions, existing daily/monthly/pending limits and provider spending limits apply.
No autonomous loop requests more model work merely because a check or deploy failed.
