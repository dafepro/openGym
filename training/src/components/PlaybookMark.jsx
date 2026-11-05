// A small coach's pitch sketch: the field stays in ink, the next move in orange.
export default function PlaybookMark({ className = '' }) {
  return <svg className={`qt-brand-mark--playbook ${className}`.trim()} width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <rect x="3" y="2" width="18" height="20" rx="3" stroke="currentColor" strokeWidth="1.25"/>
    <g className="qt-brand-mark-field" stroke="currentColor" strokeWidth="1">
      <path d="M3 12h18M9 2v3h6V2M9 22v-3h6v3"/>
      <circle cx="12" cy="12" r="3"/>
    </g>
    <path className="qt-brand-mark-route" d="M7 18C5 11 10 6 17 6" stroke="var(--qt-accent, #d86732)" strokeWidth="1.65" strokeLinecap="round" strokeDasharray="2.4 2.5"/>
    <circle cx="7" cy="18" r="1.3" fill="var(--qt-accent, #d86732)"/>
    <circle className="qt-brand-mark-ball" cx="17" cy="6" r="1.8" fill="var(--qt-accent, #d86732)"/>
  </svg>
}
