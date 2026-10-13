import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// Keep the outgoing view briefly for a real crossfade. It cannot own input or actions.
export default function FocusSwitch({ stateKey, children }) {
  const previous = useRef({ key: stateKey, children })
  const outgoingRef = useRef(null)
  const [outgoing, setOutgoing] = useState(null)
  useLayoutEffect(() => {
    if (previous.current.key !== stateKey) {
      setOutgoing(previous.current)
    }
    previous.current = { key: stateKey, children }
  }, [stateKey, children])
  useLayoutEffect(() => {
    // The fading snapshot has no accessible controls. Remove its IDs as well so
    // current labels and aria-controls resolve only to the incoming live view.
    outgoingRef.current?.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'))
  }, [outgoing])
  useEffect(() => {
    if (!outgoing) return
    const timeout = setTimeout(() => setOutgoing(null), 180)
    return () => clearTimeout(timeout)
  }, [outgoing])
  return <div className="wf-switch">
    {outgoing && <div ref={outgoingRef} className="wf-outgoing" aria-hidden="true" inert>{outgoing.children}</div>}
    <div className="wf-phase" key={stateKey}>{children}</div>
  </div>
}
