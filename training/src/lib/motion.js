import { flushSync } from 'react-dom'

let finishPrevious
let dockSurface
const DOCK = '.qt-workout-controls:not(.qt-transition-snapshot)'

function capture(element, zIndex = '24') {
  const bounds = element.getBoundingClientRect()
  const opacity = window.getComputedStyle?.(element).opacity || '1'
  const snapshot = element.cloneNode(true)
  snapshot.removeAttribute('id')
  snapshot.setAttribute('aria-hidden', 'true')
  snapshot.inert = true
  snapshot.classList.add('qt-transition-snapshot')
  snapshot.querySelectorAll('[id]').forEach(child => child.removeAttribute('id'))
  snapshot.querySelectorAll('dialog,video,audio,source').forEach(child => child.remove())
  Object.assign(snapshot.style, { position: 'fixed', left: `${bounds.left}px`, top: `${bounds.top}px`, right: 'auto', bottom: 'auto', width: `${bounds.width}px`, height: `${bounds.height}px`, margin: '0', pointerEvents: 'none', zIndex, overflow: 'hidden', transform: 'none', translate: 'none', opacity })
  return { snapshot, bounds, opacity }
}

// Main-page transitions also hand off the bottom controls. The navigation stays
// mounted; only newly mounted/removed workout docks participate. A phase or drill
// update never replays the dock entrance.
export function transitionView(update, direction = 'forward', selector = '#training-main') {
  const mainTransition = selector === '#training-main'
  const oldDock = mainTransition ? document.querySelector(DOCK) : null
  // Capture the current visual position before cancelling an interrupted motion.
  const departingDock = oldDock ? capture(oldDock, '30') : null
  const handoff = mainTransition && dockSurface ? { bounds: dockSurface.getBoundingClientRect(), opacity: window.getComputedStyle?.(dockSurface).opacity || '1' } : null
  finishPrevious?.()
  document.documentElement.dataset.motion = direction
  const root = document.querySelector(selector)
  if (!root?.animate || document.visibilityState !== 'visible' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { update(); return }
  const { snapshot, bounds } = capture(root)
  root.parentElement.append(snapshot)
  const sign = direction === 'back' ? -1 : 1
  const timing = { duration: 240, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' }
  const animations = [], snapshots = [snapshot], restore = []
  // The root itself must survive the update (no React key on the drill card).
  animations.push(root.animate([{ opacity: 0, transform: `translateX(${20 * sign}px)` }, { opacity: 1, transform: 'translateX(0)' }], timing))
  flushSync(update)
  const nextDock = mainTransition ? document.querySelector(DOCK) : null
  if (oldDock !== nextDock) {
    if (departingDock) {
      const ghost = departingDock.snapshot
      document.body.append(ghost)
      snapshots.push(ghost)
      dockSurface = ghost
      animations.push(ghost.animate([{ opacity: departingDock.opacity, translate: '0 0' }, { opacity: 0, translate: '0 24px' }], { ...timing, duration: 180 }))
    }
    if (nextDock?.animate) {
      const wasInert = nextDock.inert
      nextDock.inert = true
      restore.push(() => { nextDock.inert = wasInert })
      const startY = handoff ? handoff.bounds.top - nextDock.getBoundingClientRect().top : 24
      dockSurface = nextDock
      animations.push(nextDock.animate([{ opacity: handoff?.opacity || 0, translate: `0 ${startY}px` }, { opacity: 1, translate: '0 0' }], { ...timing, delay: handoff ? 0 : 80 }))
    }
  }
  // Keep scrolled outgoing content below the incoming header boundary.
  const incomingTop = root.getBoundingClientRect().top
  snapshot.style.clipPath = `inset(${Math.max(0, incomingTop - bounds.top)}px 0 0 0)`
  animations.push(snapshot.animate([{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: `translateX(${-20 * sign}px)` }], timing))
  let fallback, finished = false
  const ownedDock = dockSurface
  const finish = () => {
    if (finished) return
    finished = true
    clearTimeout(fallback)
    snapshots.forEach(surface => surface.remove())
    animations.forEach(animation => animation.cancel())
    restore.forEach(reset => reset())
    if (dockSurface === ownedDock) dockSurface = null
    if (finishPrevious === finish) finishPrevious = null
  }
  finishPrevious = finish
  fallback = setTimeout(finish, 380)
  Promise.all(animations.map(animation => animation.finished)).then(finish, finish)
}
