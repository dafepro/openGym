import Icon from './Icon.jsx'

export function Button({ children, icon, variant = 'primary', className = '', ...props }) {
  return <button className={`qt-button qt-button--${variant} ${className}`} type="button" {...props}>{icon && <Icon name={icon} />}<span>{children}</span></button>
}

export function Badge({ children, tone = 'neutral' }) {
  return <span className={`qt-badge qt-badge--${tone}`}>{children}</span>
}

export function Notice({ title, children, tone = 'neutral', action, onAction, className = '' }) {
  return <div className={`qt-notice qt-notice--${tone} ${className}`} role={tone === 'error' ? 'alert' : 'status'}>
    <Icon name={tone === 'error' || tone === 'warning' ? 'warning' : 'info'} size={19} />
    <div>{title && <strong>{title}</strong>}{children && <p>{children}</p>}</div>
    {action && <button type="button" onClick={onAction}>{action}</button>}
  </div>
}

export function EmptyState({ title, children, icon = 'ball', action, onAction }) {
  return <section className="qt-empty"><span className="qt-empty-icon"><Icon name={icon} size={32} /></span><h2>{title}</h2><p>{children}</p>{action && <Button variant="secondary" onClick={onAction}>{action}</Button>}</section>
}

export function LoadingState({ label = 'Loading assignment' }) {
  return <div className="qt-loading" role="status"><span>{label}</span><div className="qt-skeleton qt-skeleton--wide" /><div className="qt-skeleton" /><div className="qt-skeleton qt-skeleton--short" /></div>
}

export function PageHeading({ eyebrow, title, children }) {
  return <header className="qt-page-heading">{eyebrow && <p className="qt-eyebrow">{eyebrow}</p>}<h1>{title}</h1>{children && <p className="qt-page-subtitle">{children}</p>}</header>
}

export function formatClock(value) {
  const seconds = Math.max(0, Math.ceil(Number(value) || 0))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function prescriptionLabel(drill) {
  if (drill?.prescription) return drill.prescription
  if (drill?.mode === 'watch') return 'Watch the demonstration'
  const work = drill?.mode === 'time' ? `${drill.durationSec} sec` : drill?.reps != null ? `${drill.reps} reps` : 'Prescription pending'
  return `${drill?.sets ? `${drill.sets} ${drill.sets === 1 ? 'set' : 'sets'} · ` : ''}${work}${drill?.side === 'each' ? ' · each foot' : ''}`
}

export const countLabel = (count, singular) => `${count} ${singular}${count === 1 ? '' : 's'}`
