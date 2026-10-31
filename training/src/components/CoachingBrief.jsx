import { useEffect, useId, useState } from 'react'
import Reveal from './Reveal.jsx'
import Icon from './Icon.jsx'

const label = value => { const text = value.replace(/^futbol:/, '').replace(/[-_]/g, ' '); return text.charAt(0).toUpperCase() + text.slice(1) }

// Reorganize supplied wording; never generate coaching cues or training quantities.
export function coachingBrief(drill) {
  const lines = (Array.isArray(drill.instructions) ? drill.instructions : [drill.instructions || ''])
    .flatMap(line => line.split(/(?<=[.!?])\s+/)).filter(Boolean)
  const credit = lines.filter(line => /^(Demonstration:|Video by )/.test(line))
  const reminders = lines.filter(line => /^(Practice at your own pace; open the demonstration whenever you need a reminder\.)$/.test(line))
  const focus = lines.filter(line => /^(Keep |Focus on |Aim for |Remember )/i.test(line))
  const steps = lines.filter(line => !credit.includes(line) && !focus.includes(line) && !reminders.includes(line))
  const requirements = drill.metadata?.requirements
  const setup = [...(requirements?.equipment || []).map(label)]
  if (requirements?.space) setup.push(`${requirements.space.lengthM} × ${requirements.space.widthM} m`)
  return { steps, focus, credit, setup, reminders }
}

export default function CoachingBrief({ drill }) {
  const { steps, focus, credit, setup, reminders } = coachingBrief(drill)
  const [notesOpen, setNotesOpen] = useState(false)
  const notesId = useId()
  useEffect(() => setNotesOpen(false), [drill.id])
  return <div className="qt-coaching-brief">
    {setup.length > 0 && <section><h2>Setup</h2><p className="qt-equipment">{setup.join(' · ')}</p></section>}
    {steps.length > 0 && <section><h2>Do the drill</h2><ol>{steps.map((line, index) => <li key={index}>{line}</li>)}</ol></section>}
    {focus.length > 0 && <section><h2>Focus</h2><ul>{focus.map((line, index) => <li key={index}>{line}</li>)}</ul></section>}
    {(credit.length > 0 || reminders.length > 0) && <div className="qt-coaching-notes"><button type="button" aria-expanded={notesOpen} aria-controls={notesId} onClick={() => setNotesOpen(value => !value)}><span>Notes &amp; video credit</span><Icon name="arrow" size={14}/></button><Reveal open={notesOpen} id={notesId}><p>{[...reminders, ...credit].join(' ')}</p></Reveal></div>}
  </div>
}
