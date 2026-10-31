import { flushSync } from 'react-dom'

let running = null

// One transition controller owns motion between drills. An outgoing DOM clone
// plus a keyed card's own CSS animation used to produce a visible double sweep.
// Keep only the current React view; never copy a live player or duplicate IDs.
export function transitionView(update, direction = 'forward') {
  running?.cancel()
  running = null
  const root = document.getElementById('training-main')
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  if (!root || !root.animate || document.visibilityState !== 'visible' || reduce) {
    update()
    return
  }
  root.classList.add('qt-in-transition')
  // Save state synchronously so we animate only the new drill, once.
  try { flushSync(update) } catch (error) { root.classList.remove('qt-in-transition'); throw error }
  const sign = direction === 'back' ? -1 : 1
  const animation = root.animate(
    [{ opacity: .55, transform: `translateX(${16 * sign}px)` }, { opacity: 1, transform: 'translateX(0)' }],
    { duration: 180, easing: 'cubic-bezier(.22,1,.36,1)' },
  )
  running = animation
  const finish = () => {
    if (running !== animation) return
    running = null
    root.classList.remove('qt-in-transition')
  }
  void animation.finished.then(finish, finish)
}
