# 017 — Review soccer practices in the coach desk

Accepted 2026-11-16. Implements improvement 4 from the soccer flow review.

The coach desk presents Draft → Review → Publishing → Ready. Coaches review the
same compiled practice that will be published, including player preview, written
instructions and the existing muted, bounded demonstration player. Target edits
are explicit: sets, reps/duration, sides and rest. Saving targets revises the
existing practice PR without paid research. Free-text feedback uses the existing
bounded research/revision pipeline and clearly identifies that consequence.

Approval remains restricted to the existing Google-verified publishing owner.
Other authorized coaches can preview their own requests but cannot gain publishing
authority through this UI. This deliberately does not introduce general coach
roles or replace the account model. No new credentials or infrastructure are needed.

The existing authenticated `/api/coach/requests` endpoint scopes every action to
its coach queue. Before accepting an action, the service verifies the open bot PR,
exact head, allowed data file, append-only change and compiled practice equality.
Persisted approval names the exact head and queue owner. Any target edit, research
revision or rebased head requires review again. CI, GitHub changes-requested vetoes,
exact-head merge and live publication qualification remain mandatory.

Review mutations and the scheduler cannot execute concurrently in one queue.
Edits and feedback are checkpointed before external writes/research; existing
recovery behavior handles interrupted side effects. New fields live in the existing
JSON records and SQLite backup; no schema migration or local-player storage change.
GitHub links and build diagnostics remain available in Technical details. Nothing
is called Ready or shareable until the existing HTTPS publication checks succeed.
