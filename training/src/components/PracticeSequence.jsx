import Icon from './Icon.jsx'
import { compactTarget } from '../domain/drill-selection.js'
import { hasDemonstration } from '../domain/drill-library.js'

export function DrillThumbnail({ drill, onClick, disabled, label }) {
  const video = hasDemonstration(drill)
  return <button type="button" className={`pb-media-thumb${video ? ' has-video' : ''}`} onClick={onClick} disabled={disabled || !onClick} aria-label={label || `${video ? 'Watch' : 'Instructions for'} ${drill.title}`}>
    {video ? <video src={`${drill.media.path}#t=0.1`} muted playsInline preload="metadata" tabIndex="-1" aria-hidden="true" /> : <Icon name="ball" size={22} />}
    <span className="pb-media-action" aria-hidden="true"><Icon name={video ? 'play' : 'arrow'} size={16} /></span>
  </button>
}

export default function PracticeSequence({ drills = [], onOpenDrill, onWatchDrill, compact = false }) {
  return <ol className={`qt-drill-list pb-drill-sequence${compact ? ' is-compact' : ''}`} aria-label="Drills in this practice">
    {drills.map((drill, index) => <li className="qt-drill-row pb-drill-strip" key={drill.id}>
      <span className="qt-drill-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      <button type="button" className="pb-drill-name" disabled={!onOpenDrill} onClick={() => onOpenDrill?.(drill, index)} aria-label={`Instructions for ${drill.title}`}><strong>{drill.title}</strong><small>{compactTarget(drill)}</small></button>
      <DrillThumbnail drill={drill} onClick={hasDemonstration(drill) ? () => (onWatchDrill || onOpenDrill)?.(drill, index) : () => onOpenDrill?.(drill, index)} />
    </li>)}
  </ol>
}
