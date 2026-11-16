import Icon from './Icon.jsx'
import { practicePreparation } from '../domain/practice-preparation.js'
import '../styles/practice-preparation.css'

function minutes(seconds) {
  return `${Math.max(1, Math.ceil(seconds / 60))} min`
}
function players(group) {
  if (!group) return 'Not specified'
  if (group.varies) return 'Varies by drill'
  if (group.min === 1 && group.max === 1) return 'Solo'
  if (group.max === Infinity) return `${group.min}+ players`
  if (group.min === group.max) return `${group.min} players`
  return `${group.min}–${group.max} players`
}

export default function PracticePreparation({ practice, compact = false }) {
  const info = practicePreparation(practice)
  const knownSeconds = info.workSeconds + info.restSeconds
  const time = info.reviewOnly
    ? 'At your pace'
    : !knownSeconds
      ? 'Self-paced'
      : info.openEnded
        ? `${minutes(knownSeconds)} + untimed work`
        : `About ${minutes(knownSeconds)} + setup`
  if (compact)
    return (
      <p className="pb-duration">
        <Icon name="clock" size={16} />
        {time}
      </p>
    )
  return (
    <section className="pb-preparation" aria-label="Before you start">
      <dl className="pb-preparation-facts">
        <div>
          <dt>
            <Icon name="clock" size={18} />
            <span className="qt-visually-hidden">Time</span>
          </dt>
          <dd>{time}</dd>
        </div>
        {!info.reviewOnly && (
          <>
            <div>
              <dt>
                <Icon name="ball" size={18} />
                <span className="qt-visually-hidden">Bring</span>
              </dt>
              <dd>
                {info.equipment.length
                  ? info.equipment.join(', ')
                  : info.missing.equipment
                    ? 'Not specified'
                    : 'No equipment'}
                {info.equipment.length > 0 && info.missing.equipment && <small>Partial list</small>}
              </dd>
            </div>
            <div>
              <dt>
                <Icon name="expand" size={18} />
                <span className="qt-visually-hidden">Space</span>
              </dt>
              <dd>
                {info.space ? `${info.space.lengthM} × ${info.space.widthM} m` : 'Not specified'}
                {info.space && info.missing.space && <small>Some drills unspecified</small>}
              </dd>
            </div>
            <div>
              <dt>
                <Icon name="user" size={18} />
                <span className="qt-visually-hidden">Players</span>
              </dt>
              <dd>
                {players(info.participants)}
                {info.participants && info.missing.participants && <small>Some drills unspecified</small>}
                {!!info.participants?.roles.length && <small>{info.participants.roles.join(', ')}</small>}
              </dd>
            </div>
          </>
        )}
      </dl>
      {!!info.focus.length && (
        <p className="pb-preparation-focus">
          <Icon name="flag" size={16} /> {info.focus.slice(0, 3).join(' · ')}
          {info.focus.length > 3 ? ` · +${info.focus.length - 3} more` : ''}
        </p>
      )}
      {info.reviewOnly && <p className="pb-preparation-note">Video review · no workout recorded</p>}
    </section>
  )
}
