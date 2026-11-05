import { useMemo, useState } from 'react'
import { generateRandomPractice, DEFAULT_RANDOM_CONTEXT } from '../domain/random-practice.js'
import PracticeSequence from '../components/PracticeSequence.jsx'
import { Button, Notice, countLabel } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import Disclosure from '../components/Disclosure.jsx'

export default function RandomPracticeView({ library, history = [], onStart, onOpenDrill, onWatchDrill, disabled = false, initialSeed }) {
  const [seed, setSeed] = useState(() => initialSeed || crypto.randomUUID())
  const [context, setContext] = useState(() => structuredClone(DEFAULT_RANDOM_CONTEXT))
  const [setupOpen, setSetupOpen] = useState(false)
  const [count, setCount] = useState(3)
  const [videoOnly, setVideoOnly] = useState(false)
  const [allowUnknownSpace, setAllowUnknownSpace] = useState(false)
  const proposal = useMemo(() => {
    try { return generateRandomPractice(library, { context, seed, count, videoOnly, allowUnknownSpace, history }) }
    catch (error) { return { error: error.message } }
  }, [library, context, seed, count, videoOnly, allowUnknownSpace, history])
  const equipment = name => setContext(value => ({ ...value, equipment: value.equipment.includes(name) ? value.equipment.filter(item => item !== name) : [...value.equipment, name] }))
  return <div className="pb-random-setup">
    <p className="pb-random-intro">A fresh mix, using the space and gear you have.</p>
    <Disclosure className="pb-setup-options" open={setupOpen} onOpenChange={setSetupOpen} summary={<span><strong>Your setup</strong><small>{context.setting === 'indoor' ? 'Indoors' : 'Outdoors'} · {context.space.lengthM} × {context.space.widthM} m · {context.participants.count === 1 ? 'Solo' : 'With a partner'} · {context.equipment.length ? context.equipment.join(', ') : 'No equipment'}</small></span>}>
      <div className="qt-field-grid"><label className="qt-field">Where?<select value={context.setting} onChange={event => setContext(value => ({ ...value, setting: event.target.value }))}><option value="outdoor">Outdoors</option><option value="indoor">Indoors</option></select></label><label className="qt-field">Clear space<select value={context.space.lengthM} onChange={event => setContext(value => ({ ...value, space: { lengthM: Number(event.target.value), widthM: Number(event.target.value) } }))}><option value={3}>3 × 3 m</option><option value={6}>6 × 6 m</option><option value={12}>12 × 12 m</option><option value={20}>20 × 20 m</option></select></label></div>
      <fieldset className="pb-equipment-options"><legend>Available equipment</legend>{['ball', 'cones', 'wall', 'goal', 'ladder'].map(item => <label key={item}><input type="checkbox" checked={context.equipment.includes(item)} onChange={() => equipment(item)}/><span>{item}</span></label>)}</fieldset>
      <div className="qt-field-grid"><label className="qt-field">Players<select value={context.participants.count} onChange={event => setContext(value => ({ ...value, participants: { count: Number(event.target.value), roles: [] } }))}><option value={1}>Just me</option><option value={2}>Me + a partner</option></select></label><label className="qt-field">How many drills?<select value={count} onChange={event => setCount(Number(event.target.value))}>{[1,2,3,4,5].map(n => <option key={n} value={n}>{n} {n === 1 ? 'drill' : 'drills'}</option>)}</select></label></div>
      <label className="qt-video-filter"><span><Icon name="video" size={18}/>Only drills with a demonstration</span><input type="checkbox" checked={videoOnly} onChange={event => setVideoOnly(event.target.checked)}/></label>
      <label className="qt-video-filter"><span>Include drills with unlisted space needs</span><input type="checkbox" checked={allowUnknownSpace} onChange={event => setAllowUnknownSpace(event.target.checked)}/></label>
      {allowUnknownSpace && <p className="qt-fine-print">Check those drills yourself before starting. Your space may not be enough.</p>}
    </Disclosure>
    {proposal.error ? <Notice title="Try another setup" tone="warning" action="Change setup" onAction={() => setSetupOpen(true)}>{proposal.error}</Notice> : <section className="pb-proposal" aria-label="Random practice proposal" key={`${seed}-${context.setting}-${count}`}><div className="pb-section-heading"><div><p className="qt-eyebrow">Your fresh mix</p><h2>{proposal.assignment.title}</h2></div><span>{countLabel(proposal.assignment.drills.length, 'drill')}</span></div><p className="qt-fine-print">{proposal.explanation}</p>{proposal.warnings?.map(warning => <p className="pb-proposal-warning" key={warning}><Icon name="info" size={14}/>{warning}</p>)}<PracticeSequence drills={proposal.assignment.drills} onOpenDrill={onOpenDrill} onWatchDrill={onWatchDrill} compact/></section>}
    <div className="pb-editor-actions"><Button icon="forward" disabled={disabled || !proposal.assignment} onClick={() => onStart(proposal.assignment)}>Start this practice</Button><Button variant="secondary" icon="shuffle" disabled={disabled || !proposal.assignment || proposal.eligibleCount < 2} onClick={() => setSeed(crypto.randomUUID())}>Shuffle again</Button></div>
    {!proposal.error && proposal.eligibleCount < 2 && <p className="qt-fine-print">Only one drill is available with these choices. Change your setup for more options.</p>}
  </div>
}
