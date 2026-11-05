import { useId, useState } from 'react'
import Reveal from './Reveal.jsx'
import Icon from './Icon.jsx'

// Unlike a native details element, the closing content remains mounted long
// enough to animate. Reveal immediately removes it from focus and hit testing.
export default function Disclosure({ summary, children, className = '', defaultOpen = false, open: controlledOpen, onOpenChange }) {
  const [localOpen, setLocalOpen] = useState(defaultOpen)
  const open = controlledOpen ?? localOpen
  const toggle = () => { if (controlledOpen === undefined) setLocalOpen(!open); onOpenChange?.(!open) }
  const id = useId()
  return <section className={`pb-disclosure ${className}`} data-open={open}>
    <button type="button" className="pb-disclosure-trigger" aria-expanded={open} aria-controls={id} onClick={toggle}><span>{summary}</span><Icon name="arrow" size={16}/></button>
    <Reveal id={id} open={open}>{children}</Reveal>
  </section>
}
