import { useLayoutEffect, useRef } from 'react'

// Only the current phase is mounted. Keeping outgoing React children alive used
// to duplicate media playback and create two visible transitions on rapid changes.
export default function FocusSwitch({ stateKey, children }) {
  const phase = useRef(null)
  const previous = useRef(stateKey)
  const running = useRef(null)

  useLayoutEffect(() => {
    if (previous.current === stateKey) return
    previous.current = stateKey
    running.current?.cancel()
    running.current = null
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return
    const node = phase.current
    if (!node?.animate) return
    const animation = node.animate(
      [{ opacity: 0.7, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 180, easing: 'ease-out' },
    )
    running.current = animation
    return () => { animation.cancel(); if (running.current === animation) running.current = null }
  }, [stateKey])

  return <div className="wf-switch">
    <div className="wf-phase" key={stateKey} ref={phase}>{children}</div>
  </div>
}
