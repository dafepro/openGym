// Keeps both directions of a disclosure animated without moving focus into hidden content.
export default function Reveal({ open, children, id, className = '' }) {
  return <div id={id} className={`qt-reveal ${className}`} data-open={!!open} aria-hidden={!open} inert={!open ? true : undefined}><div>{children}</div></div>
}
