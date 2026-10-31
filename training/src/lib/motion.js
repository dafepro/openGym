import { flushSync } from 'react-dom'

let finishPrevious

// Exactly one animation owns each navigation. The incoming surface is hidden
// before React commits; no mount animations restart when this animation ends.
// Drill transitions leave the fixed control panel in place.
export function transitionView(update, direction = 'forward', selector = '.qt-shell') {
  finishPrevious?.()
  document.documentElement.dataset.motion = direction
  const root = document.querySelector(selector)
  if (!root?.animate || document.visibilityState !== 'visible' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { update(); return }
  const bounds = root.getBoundingClientRect()
  const snapshot = root.cloneNode(true)
  snapshot.removeAttribute('id')
  snapshot.setAttribute('aria-hidden', 'true')
  snapshot.inert = true
  snapshot.classList.add('qt-transition-snapshot')
  snapshot.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'))
  snapshot.querySelectorAll('dialog,video,audio,source').forEach(element => element.remove())
  Object.assign(snapshot.style, { position: 'fixed', left: `${bounds.left}px`, top: `${bounds.top}px`, width: `${bounds.width}px`, height: `${bounds.height}px`, margin: '0', pointerEvents: 'none', zIndex: '24', overflow: 'hidden' })
  root.parentElement.append(snapshot)
  const sign = direction === 'back' ? -1 : 1
  const timing = { duration: 240, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' }
  // The root itself must survive the update (no React key on the drill card).
  const incoming = root.animate([{ opacity: 0, transform: `translateX(${20 * sign}px)` }, { opacity: 1, transform: 'translateX(0)' }], timing)
  flushSync(update)
  const outgoing = snapshot.animate([{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: `translateX(${-20 * sign}px)` }], timing)
  let fallback
  const finish = () => { clearTimeout(fallback); snapshot.remove(); outgoing.cancel(); incoming.cancel(); if (finishPrevious === finish) finishPrevious = null }
  finishPrevious = finish
  fallback = setTimeout(finish, 300)
  incoming.finished.then(finish, finish)
}
