import { flushSync } from 'react-dom'

let finishPrevious

// Capture the outgoing surface before updating it. This also works on browsers
// without the View Transition API and never delays a durable controller update.
export function transitionView(update, direction = 'forward') {
  finishPrevious?.()
  document.documentElement.dataset.motion = direction
  const root = document.getElementById('training-main')
  if (!root?.animate || document.visibilityState !== 'visible' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { update(); return }
  const bounds = root.getBoundingClientRect()
  const snapshot = root.cloneNode(true)
  snapshot.removeAttribute('id')
  snapshot.setAttribute('aria-hidden', 'true')
  snapshot.inert = true
  snapshot.classList.add('qt-transition-snapshot')
  snapshot.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'))
  snapshot.querySelectorAll('video,audio,source').forEach(element => { element.removeAttribute('src'); element.removeAttribute('autoplay') })
  Object.assign(snapshot.style, { position: 'fixed', left: `${bounds.left}px`, top: `${bounds.top}px`, width: `${bounds.width}px`, height: `${bounds.height}px`, margin: '0', pointerEvents: 'none', zIndex: '25', overflow: 'hidden' })
  document.body.append(snapshot)
  const sign = direction === 'back' ? -1 : 1
  root.classList.add('qt-in-transition')
  flushSync(update)
  const outgoing = snapshot.animate([{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: `translateX(${-24 * sign}px)` }], { duration: 180, easing: 'ease-out', fill: 'forwards' })
  const incoming = root.animate([{ opacity: 0, transform: `translateX(${24 * sign}px)` }, { opacity: 1, transform: 'translateX(0)' }], { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' })
  let fallback
  const finish = () => { clearTimeout(fallback); snapshot.remove(); outgoing.cancel(); incoming.cancel(); root.classList.remove('qt-in-transition'); if (finishPrevious === finish) finishPrevious = null }
  finishPrevious = finish
  fallback = setTimeout(finish, 260)
  incoming.finished.then(finish, finish)
}
