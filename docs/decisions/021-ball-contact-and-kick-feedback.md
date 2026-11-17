# 021 — Ball contact and kick feedback

The owner corrected the night overlay interaction: touching the home ball must
launch that ball from its existing screen position rather than spawn a centered
replacement. In play, contact nudges away from the touched side; a centered tap
nudges toward open field (upward at center). Pull-and-release retains the original
opposite-direction kick and restores the original curved green-to-red arrow from PR #38 behind the ball. Length and color show
bounded force, and the pull range adapts to the screen edge. The home ball also
supports aiming before launching. Pointer cancellation fires no kick. Resize preserves the ball
position within the new bounds instead of recentering it.

Supersedes ADR 018 tap-to-close behavior. Use an accessible icon close button and
Escape so taps remain physical interactions. Goals show posts, perspective mesh
and back netting with the score inside. Keep the dark overlay, no sensor access,
no training records or persistent data, and existing reduced-motion behavior.
