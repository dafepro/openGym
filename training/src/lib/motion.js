import { flushSync } from 'react-dom'

let finishPrevious
const DOCK = '.qt-workout-controls'

// Never transform the persistent main landmark. Cancelling its Web Animation
// can leave visible descendants absent from Chromium hit testing and AX after
// dialog/navigation cycles. CSS motion belongs to the content inside it.
export function transitionView(update, direction = 'forward', selector = '#training-main') {
  finishPrevious?.()
  document.documentElement.dataset.motion = direction
  const reduced = document.visibilityState !== 'visible' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const oldDock = selector === '#training-main' ? document.querySelector(DOCK) : null
  const bounds = !reduced && oldDock?.getBoundingClientRect()
  const ghost = bounds ? oldDock.cloneNode(true) : null
  flushSync(update)
  if (reduced) return
  const root = document.querySelector(selector === '#training-main' ? '#training-main .qt-view' : selector)
  const nextDock = selector === '#training-main' ? document.querySelector(DOCK) : null
  let fallback
  const surfaces = []
  const finish = () => {
    clearTimeout(fallback)
    surfaces.forEach(element => element.classList.remove('qt-content-enter', 'qt-dock-enter'))
    ghost?.remove()
    if (finishPrevious === finish) finishPrevious = null
  }
  const enter = (element, className) => {
    if (!element) return
    element.classList.remove(className)
    element.getBoundingClientRect() // Restart repeated drill motion before paint.
    element.classList.add(className)
    surfaces.push(element)
  }
  enter(root, 'qt-content-enter')
  if (oldDock !== nextDock) {
    if (ghost) {
      ghost.removeAttribute('id')
      ghost.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'))
      ghost.setAttribute('aria-hidden', 'true')
      ghost.inert = true
      ghost.classList.remove('qt-dock-enter')
      ghost.classList.add('qt-dock-exit')
      Object.assign(ghost.style, { position: 'fixed', left: `${bounds.left}px`, top: `${bounds.top}px`, width: `${bounds.width}px`, bottom: 'auto', transform: 'none', pointerEvents: 'none' })
      document.body.append(ghost)
    }
    enter(nextDock, 'qt-dock-enter')
  }
  finishPrevious = finish
  fallback = setTimeout(finish, 360)
}
