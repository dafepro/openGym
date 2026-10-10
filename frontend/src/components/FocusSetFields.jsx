import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { EFFORT, capEffort, effortOf, stepEffort, modeOf } from '../lib/history.js'
import { focusLoadLabel } from '../lib/workout-focus.js'
import { weightIncrement, stepWeight } from '../lib/progression.js'
import { ownedWeightsFor, stepOwned } from '../lib/dumbbells.js'
import { dropsOf, clustersOf, isFailureSet, isWarmupRow, toggleFailure, setDropAt, setSideDropAt, setClusterAt, setSideClusterAt } from '../lib/workout-model.js'
import { speedUnitOf, toSpeed, fromSpeed } from '../lib/speed.js'
import { inclineFits, hasIncline, INCLINE_STEP, INCLINE_MAX, clampIncline } from '../lib/incline.js'
import { exOr } from '../lib/exercises.js'
import { fmtRest } from '../lib/duration.js'
import { NumberField, Stepper } from './ui.jsx'
import Icon from './Icon.jsx'

export default function FocusSetFields({ target, field, mutate, disabled = false, main = true, effort = false, extras = false }) {
  const S = useStore(s => s.S)
  const { entry, row, set, side } = target
  if (!set) return null
  const cfg = { ...entry.target, id: entry.id }
  const mode = modeOf(cfg)
  const step = weightIncrement(cfg, S.unit)
  const owned = mode === 'reps' ? ownedWeightsFor(S, cfg) : null
  const onStep = owned ? (value, _step, dir) => stepOwned(owned, value, dir) : stepWeight
  const loadLabel = t(...focusLoadLabel(entry, S.unit))
  const effortKind = effortOf(S)
  const scale = EFFORT[effortKind]
  const drops = dropsOf(set), bursts = clustersOf(set)
  const speedUnit = speedUnitOf(S)
  return <div className="wf-fields">
    {main && (mode === 'cardio' ? <>
      <Stepper label={t('Duration (min)')} ariaLabel="duration" value={set.min ?? 0} decimal={false} disabled={disabled} onChange={value => field('min', value)} />
      <Stepper label={speedUnit === 'mph' ? t('Speed (mph)') : t('Speed (km/h)')} ariaLabel="speed" value={toSpeed(set.speed ?? 0, speedUnit)} step={0.5} disabled={disabled} onChange={value => field('speed', fromSpeed(value, speedUnit))} />
      {(inclineFits(exOr(entry.id)) || entry.sets.some(hasIncline)) && <Stepper label={t('Incline (%)')} ariaLabel="incline" value={set.incline ?? 0} step={INCLINE_STEP} max={INCLINE_MAX} disabled={disabled} onChange={value => field('incline', clampIncline(value))} />}
    </> : <>
      <Stepper label={loadLabel} ariaLabel="load" value={set.w ?? 0} step={step} onStep={onStep} disabled={disabled} onChange={value => field('w', value)} />
      {mode === 'time' ? <Stepper label={t('Seconds')} ariaLabel="duration" value={set.planSec ?? set.sec ?? entry.target?.sec ?? 45} decimal={false} min={1} step={5} disabled={disabled} onChange={value => field('sec', Math.max(1, value))} />
        : effort && <Stepper label={t('Reps')} ariaLabel="reps" value={set.r ?? 0} decimal={false} disabled={disabled} onChange={value => field('r', Math.min(999, value))} />}
    </>)}
    {effort && mode === 'reps' && scale && !isWarmupRow(row) && <div className="wf-effort-field"><span>{t(scale.hd)}</span><div className="wf-effort-edit">
      <button type="button" aria-label={t('Decrease') + ' ' + t(scale.hd)} disabled={disabled} onClick={() => field(scale.f, stepEffort(effortKind, set[scale.f], -1))}><Icon name="minus" /></button>
      <NumberField aria-label={t(scale.hd)} nullable value={set[scale.f] ?? null} placeholder="–" disabled={disabled} onChange={value => field(scale.f, capEffort(effortKind, value))} />
      <button type="button" aria-label={t('Increase') + ' ' + t(scale.hd)} disabled={disabled} onClick={() => field(scale.f, stepEffort(effortKind, set[scale.f], 1))}><Icon name="plus" /></button>
    </div></div>}
    {effort && mode !== 'cardio' && !isWarmupRow(row) && <button type="button" className="wf-effort" aria-pressed={isFailureSet(row)} disabled={disabled} onClick={() => mutate(toggleFailure)}><Icon name={isFailureSet(row) ? 'check' : 'gauge'} />{t('Taken to failure')}</button>}
    {extras && drops.map((drop, index) => <section key={'d' + index}><strong>{t('Drop {0}', index + 1)}</strong>
      <Stepper label={loadLabel} ariaLabel={'drop ' + (index + 1) + ' load'} value={drop.w} step={step} onStep={onStep} disabled={disabled} onChange={value => mutate(current => side ? setSideDropAt(current, side, index, { w: value }) : setDropAt(current, index, { w: value }))} />
      <Stepper label={t('Reps')} ariaLabel={'drop ' + (index + 1) + ' reps'} value={drop.r} decimal={false} disabled={disabled} onChange={value => mutate(current => side ? setSideDropAt(current, side, index, { r: value }) : setDropAt(current, index, { r: value }))} />
    </section>)}
    {extras && bursts.map((burst, index) => <section key={'b' + index}><strong>{t('Burst {0}', index + 1)} · {fmtRest(burst.restSec)}</strong>
      <Stepper label={t('Reps')} ariaLabel={'burst ' + (index + 1) + ' reps'} value={burst.r} decimal={false} disabled={disabled} onChange={value => mutate(current => {
        if (side) return setSideClusterAt(current, side, index, value)
        const delta = value - (clustersOf(current)[index]?.r || 0)
        return { ...setClusterAt(current, index, { r: value }), r: Math.max(0, (current.r || 0) + delta) }
      })} />
    </section>)}
  </div>
}
