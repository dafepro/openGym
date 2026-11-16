# 015 — Flat-pitch ball game with optional tilt

Accepted 2026-11-16. The owner asked for the soccer ball to roll with phone tilt,
or behave as a flat surface with two goals and goal counts.

The home ball opens an optional Pocket pitch modal with blue and gold target
goals. Count entries into each goal separately; this is a toy, not a competitive
team match or athletic measurement. Keep the tally during the current home-screen
visit, including closing/reopening the game. Reset score clears it. No persistent
storage, practice history, server API or analytics are involved.

Flat mode has inertia, friction and bounded rebounds, with no automatic downward
gravity. Pull back to kick; provide visible directional buttons and keyboard arrow
controls as well. Goal detection requires the ball to fit between the posts and
resets its position and velocity once per goal.

Request relative device orientation only after Enable tilt. Treat the first valid
reading as neutral, support Set level, rotate axes with screen orientation and
ignore stale or missing readings. Permission denial, unsupported devices and
sensor timeouts leave manual play available. Motion data stays in memory on the
device; absolute heading is unnecessary. Remove listeners on disable/unmount and
ignore permission results after closing.

Backgrounding pauses play and disables tilt; returning requires Resume. Resize
recenters the ball. Reduced motion suppresses decorative spin and modal motion;
ball movement remains the explicitly requested game mechanic. Reuse the existing
dialog's focus trap, Escape/close behavior and scroll lock so play cannot tap the
practice controls underneath.
