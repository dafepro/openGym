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

export default function PracticePreparation({ practice }) {
  const info = practicePreparation(practice)
  const knownSeconds = info.workSeconds + info.restSeconds
  const time = info.reviewOnly
    ? 'At your pace'
    : !knownSeconds
      ? 'Self-paced'
      : info.openEnded
        ? `${minutes(knownSeconds)} + untimed work`
        : `About ${minutes(knownSeconds)} + setup`
  return (
    <section className="pb-preparation" aria-label="Before you start">
      <dl className="pb-preparation-facts">
        <div>
          <dt>Time</dt>
          <dd>{time}</dd>
        </div>
        {!info.reviewOnly && (
          <>
            <div>
              <dt>Bring</dt>
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
              <dt>Space</dt>
              <dd>
                {info.space ? `${info.space.lengthM} × ${info.space.widthM} m` : 'Not specified'}
                {info.space && info.missing.space && <small>Some drills unspecified</small>}
              </dd>
            </div>
            <div>
              <dt>Players</dt>
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
          <strong>Focus</strong> {info.focus.slice(0, 3).join(' · ')}
          {info.focus.length > 3 ? ` · +${info.focus.length - 3} more` : ''}
        </p>
      )}
      <p className="pb-preparation-note">
        {info.reviewOnly ? (
          'Video review only; no athletic work recorded.'
        ) : (
          <>
            {knownSeconds > 0
              ? `${info.restSeconds > 0 ? 'Includes prescribed rest. ' : ''}Setup, pauses${info.openEnded ? ' and untimed work' : ''} add time.`
              : 'No fixed duration. Take the time you need for each drill.'}
            {Object.values(info.missing).some(Boolean) && ' Check drill instructions for missing setup details.'}
            {info.participants?.varies && ' Player numbers change between drills.'}
          </>
        )}
      </p>
    </section>
  )
}
