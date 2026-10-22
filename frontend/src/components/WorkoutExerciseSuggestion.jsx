import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { activeProfile } from '../lib/equipment.js'
import { recommendExercises } from '../lib/exercise-recommendations.js'
import { MUSCLES, MUSCLE_NAME } from '../lib/muscles.js'
import { setsRepsOf } from '../lib/history.js'
import { recommendationPrescription } from '../lib/recommendation-prescription.js'
import { bellsIn, isBellEx } from '../lib/dumbbells.js'
import { fmtNum } from '../lib/format.js'
import { fmtRest } from '../lib/duration.js'
import { t, exerciseNameFor, exerciseNameClass } from '../lib/i18n.js'
import { Thumb } from './Media.jsx'
import { Button, SelectRow } from './ui.jsx'
import Icon from './Icon.jsx'
import './WorkoutExerciseSuggestion.css'

const reasonLabel = (reason) =>
  ({
    familiar: t('Familiar movement'),
    spacing: t('Less recent muscle work'),
    recovery: t('Lower estimated fatigue'),
    common: t('Common movement')
  })[reason]

export default function WorkoutExerciseSuggestion({ onPick, onBrowse, close }) {
  const state = useStore((s) => s.S)
  const [sessionId] = useState(state.active?.id)
  const [now, setNow] = useState(Date.now)
  const [muscle, setMuscle] = useState('')
  const [dismissed, setDismissed] = useState([])
  const [why, setWhy] = useState(false)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    if (state.active?.id !== sessionId) close()
  }, [state.active?.id, sessionId, close])
  // Alternatives only walk the already-ranked list. No history/recovery rescan per tap.
  const ranked = useMemo(() => recommendExercises(state, { now, muscle }), [state, now, muscle])
  const candidate = ranked.find((item) => !dismissed.includes(item.exercise.id))
  const match = useMemo(() => recommendationPrescription(state, candidate, { now }), [state, candidate, now])
  const ex = match?.exercise,
    profile = activeProfile(state)
  const loadUnit =
    match && isBellEx(ex) && bellsIn(match.config) > 1
      ? match.config.dbLoad === 'each'
        ? t('Each ({0})', state.unit)
        : match.config.dbLoad === 'total'
          ? t('Both ({0})', state.unit)
          : state.unit
      : state.unit
  const choose = (quick) => {
    if (!ex || useStore.getState().S.active?.id !== sessionId) return
    close()
    onPick(ex, quick, match.config)
  }
  if (!state.active || state.active.id !== sessionId) return null
  return (
    <div className="workout-suggestion">
      <h3>{t('Add exercise')}</h3>
      <SelectRow
        icon="figureStrength"
        title={t('By muscle')}
        value={muscle}
        options={[
          { value: '', label: t('Any muscle') },
          ...MUSCLES.map((m) => ({ value: m, label: t(MUSCLE_NAME[m]) }))
        ]}
        onChange={(value) => {
          setMuscle(value)
          setWhy(false)
        }}
      />
      <div className="suggestion-equipment small dim">
        <Icon name="kettlebell" />
        <span>{profile?.name || t('Any equipment')}</span>
      </div>
      <div className="suggestion-card card">
        <div className="row between">
          <span className="small dim">{t('Suggested exercise')}</span>
          <button
            className="iconbtn"
            aria-label={t('Why this exercise?')}
            aria-expanded={why}
            disabled={!match}
            onClick={() => setWhy((value) => !value)}
          >
            <Icon name="info" />
          </button>
        </div>
        <div className="suggestion-slot" aria-live="polite" aria-atomic="true">
          {why && match ? (
            <div className="suggestion-why small dim">
              <strong>{reasonLabel(match.reason)}</strong>
              <span>
                {match.source === 'plan'
                  ? t('Saved plan')
                  : match.source === 'recent'
                    ? t('Recent training')
                    : t('Choose weight')}
              </span>
              <p>{t('Estimates from logged training, not a recovery measurement.')}</p>
              <Button size="sm" variant="ghost" trailingIcon="chevronRight" onClick={() => choose(false)}>
                {t('Details')}
              </Button>
            </div>
          ) : match ? (
            <div className="suggestion-match" key={ex.id}>
              <Thumb ex={ex} />
              <div className="suggestion-name">
                <h2 className={exerciseNameClass(ex)}>{exerciseNameFor(ex)}</h2>
                <div className="small dim capitalize">{t(ex.eq)}</div>
              </div>
              <div className="suggestion-dose">
                <strong>{setsRepsOf(match.config)}</strong>
                <span className="small dim">
                  ~{match.minutes} {t('min')}
                </span>
              </div>
              <div className="suggestion-prescription">
                <span>
                  {match.config.bodyweight
                    ? `${t('Bodyweight')}${match.config.weight > 0 ? ` +${fmtNum(match.config.weight)} ${state.unit}` : ''}`
                    : match.needsWeight
                      ? t('Choose weight')
                      : `${fmtNum(match.config.weight)} ${loadUnit}`}
                </span>
                <span>
                  {t('Rest')} · {fmtRest(match.config.restSec)}
                </span>
              </div>
              <span className="tag acc suggestion-reason">{reasonLabel(match.reason)}</span>
            </div>
          ) : (
            <div className="suggestion-empty">
              <Icon name="figureStrength" />
              <p>{dismissed.length ? t('All options seen') : t('No suitable suggestion')}</p>
              {!!dismissed.length && (
                <Button size="sm" variant="ghost" onClick={() => setDismissed([])}>
                  {t('Start over')}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="suggestion-actions">
        <Button
          icon="shuffle"
          disabled={!match}
          onClick={() => {
            setDismissed((ids) => [...ids, ex.id])
            setWhy(false)
          }}
        >
          {t('Another')}
        </Button>
        <Button variant="primary" icon="plus" disabled={!match} onClick={() => choose(!match.needsWeight)}>
          {t('Add')}
        </Button>
      </div>
      <Button variant="ghost" icon="magnifier" onClick={onBrowse}>
        {t('Browse exercises')}
      </Button>
    </div>
  )
}
