# 012 — Individual soccer assignments

Accepted 2026-11-16. The owner approved persistent individual assignments,
lightweight player sign-in, assignment-only sharing, optional due dates, explicit
result submission, coach review/comments/reassignment, and immutable versions.

Use the existing isolated Node coach service and SQLite database. A new additive
player_assignments table retains assignment snapshots and explicitly submitted
results independently of the 30-day generation queue. Existing local session
storage and backups are unchanged. Back up SQLite with its WAL through the existing
service backup procedure; older application releases ignore this new table.

Google Access player authentication uses PLAYER_ACCESS_AUD, separate from the coach
audience and allowlist. Before deployment, configure a player Access application
covering /api/player/*, route those paths to the same proxy, and pass its audience
to the Node container. Keep coach API protection unchanged and include the new
coach assignment paths. No automatic deployment or access-policy edits are made.
Acceptance binds the verified identity as well as the intended email. Players
see only their assignments; coaches see only those they created. No full history,
profile, contact lists or other coaches' results are shared.

Practice links remain public previews. Assignment acceptance and results require
sign-in. Multiple assignments may be pending. A new version or repeat is a new
assignment requiring acceptance; existing work is never rewritten. Results are
explicitly sent after a local session is finished. Coach review may add a comment.
No notifications are sent automatically by this feature.

Operational qualification: test separate coach and player Google accounts and a
second player, restart recovery and backup restoration, and the proxy routing on
staging before enabling production. Player sign-in fails closed without its audience.

Local sessions carry an optional validated `coachAssignmentId`. Old sessions remain
valid; exports/restores preserve the optional field. Submissions require this exact
assignment ID as well as the immutable practice snapshot, so repeat assignments
cannot reuse a previous session of the same practice. No IndexedDB version bump
or rewriting of existing history is required.
