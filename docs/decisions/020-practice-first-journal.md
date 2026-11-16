# 020 — Practice-first home and contextual feedback journal

Accepted 2026-11-16. The owner selected concept A's practice-first layout with
concept C's feedback history. The home now prioritizes individual assignments,
then saved practices; the existing assignments URL remains a home alias. One
navigation exposes Practice, History and Coach, with compact mobile controls.
Creation tools remain available after the library, not ahead of today's work.

Keep the existing practice runner, session IDs and transactional local saves.
A saved assigned session offers explicit submission at completion. Saving does
not transmit it. Failed submission retains the note; expired authentication
clears server records and offers sign-in. Records are not added to offline caches.

Group earlier results by coach, player, practice ID and immutable revision, never
by title. Repeats still require fresh acceptance and their own local session.
Use the existing session-detail renderer for actual work, preserving stopped,
pending, zero and recorded values without exposing raw fractional seconds.
No database schema, migration or backup format changes are needed.

The journal discloses earlier sessions in place. Existing disclosure and route
transitions provide direction; small card entrances acknowledge new assignments.
Respect reduced motion and keep status text meaningful. Use CSS/SVG for the
simple decorative ball path; no generated mockup or fabricated data enters the app.

Coach work keeps Players and Practice requests as two explicit queues in one
workspace. Camera-runner consolidation remains outside this change (issue #52).
