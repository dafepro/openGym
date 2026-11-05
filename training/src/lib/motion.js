import { flushSync } from 'react-dom'

let finishPrevious
const DOCK = '.qt-workout-controls'

// A departing visual is never the live page. It cannot receive a tap, focus,
// play media, or keep native modal inertness alive after navigation.
function snapshot(element) {
  if (!element) return null
  const bounds = element.getBoundingClientRect()
  if (!bounds.width || !bounds.height) return null
  const clone = element.cloneNode(true)
  clone.removeAttribute('id')
  clone.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'))
  clone.querySelectorAll('dialog').forEach(node => node.remove())
  clone.querySelectorAll('video, audio').forEach(node => {
    node.removeAttribute('src')
    node.removeAttribute('autoplay')
    node.querySelectorAll('source').forEach(source => source.remove())
  })
  clone.setAttribute('aria-hidden', 'true')
  clone.setAttribute('data-motion-snapshot', '')
  clone.inert = true
  clone.classList.remove('qt-content-enter', 'qt-dock-enter')
  // Preserve ancestor-dependent drill typography without copying the shell.
  if (element.matches('.qt-drill-card')) clone.classList.add('qt-practice')
  Object.assign(clone.style, {
    position: 'fixed', left: `${bounds.left}px`, top: `${bounds.top}px`,
    width: `${bounds.width}px`, height: `${bounds.height}px`, margin: '0',
    maxWidth: 'none', bottom: 'auto', transform: 'none', pointerEvents: 'none',
  })
  return clone
}

// Never transform the persistent main landmark. Cancelling its Web Animation
// can leave visible descendants absent from Chromium hit testing and AX after
// dialog/navigation cycles. CSS motion belongs to content inside it; the old
// content is a disposable inert visual outside the app tree.
export function transitionView(update, direction = 'forward', selector = '#training-main') {
  finishPrevious?.()
  document.documentElement.dataset.motion = direction
  const reduced = document.visibilityState !== 'visible' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const contentSelector = selector === '#training-main' ? '#training-main .qt-view' : selector
  const oldDock = selector === '#training-main' ? document.querySelector(DOCK) : null
  const oldContent = !reduced && snapshot(document.querySelector(contentSelector))
  const oldDockVisual = !reduced && snapshot(oldDock)
  flushSync(update)
  if (reduced) return
  const root = document.querySelector(contentSelector)
  const nextDock = selector === '#training-main' ? document.querySelector(DOCK) : null
  let fallback
  const surfaces = []
  const ghosts = []
  const starts = []
  const finish = () => {
    clearTimeout(fallback)
    surfaces.forEach(element => element.classList.remove('qt-content-enter', 'qt-dock-enter'))
    ghosts.forEach(element => element.remove())
    if (finishPrevious === finish) finishPrevious = null
  }
  const stageEnter = (element, className) => {
    if (!element) return
    element.classList.remove(className)
    surfaces.push(element)
    starts.push([element, className])
  }
  const stageExit = (element, className) => {
    if (!element) return
    document.body.append(element)
    ghosts.push(element)
    starts.push([element, className])
  }
  stageExit(oldContent, 'qt-content-exit')
  stageEnter(root, 'qt-content-enter')
  if (oldDock !== nextDock) {
    stageExit(oldDockVisual, 'qt-dock-exit')
    stageEnter(nextDock, 'qt-dock-enter')
  }
  // Establish every unanimated surface together. A layout read after starting
  // the outgoing animation can give it a head start and expose a blank frame.
  document.body.getBoundingClientRect()
  starts.forEach(([element, className]) => element.classList.add(className))
  finishPrevious = finish
  fallback = setTimeout(finish, 360)
}
