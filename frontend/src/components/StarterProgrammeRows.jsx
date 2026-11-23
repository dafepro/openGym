import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t, tn } from '../lib/i18n.js'
import { buildStarterProgramme, starterProgrammeOptions } from '../lib/starter.js'
import { saveProgramme } from '../lib/programmes.js'
import { Row } from './ui.jsx'

// Names and blurbs as t() literals, for check-source-strings.mjs (see lib/starter.js).
const STARTER_COPY = {
  'strength-4': () => ({
    name: t('Strength block, 4 weeks'),
    about: t('Three days on the 5×5 routines, a little heavier every week, then a light week to bounce back.')
  }),
  'hypertrophy-6': () => ({
    name: t('Upper / lower by effort, 6 weeks'),
    about: t('Four days. Your progression picks the weights, the effort climbs to RPE 9, then a deload.')
  }),
  'linear-12': () => ({
    name: t('Linear 5×5 style, 12 weeks'),
    about: t('Three days of plain linear progression, with a deload every fourth week.')
  })
}

export default function StarterProgrammeRows({ onOpen, rotationsOnly = false }) {
  const update = useStore((s) => s.update)
  const options = starterProgrammeOptions().filter((o) => !rotationsOnly || o.rotation)
  const addStarter = (id, name) => {
    const built = buildStarterProgramme(id, name)
    if (!built) return
    update((s) => {
      s.routines = [...(s.routines || []), ...built.routines]
      saveProgramme(s, built.programme)
    })
    useUI.getState().toast(tn('Added with {0} new routine.', 'Added with {0} new routines.', built.routines.length))
    onOpen('/plan/prog/' + built.programme.id)
  }

  return options.map((o) => {
    const copy = o.rotation ? { name: o.name, about: `A / B · ${t('Deadlift')} 1×5` } : STARTER_COPY[o.id]()
    return (
      <Row
        key={o.id}
        icon="clipboard"
        title={copy.name}
        accessory="chevron"
        subtitle={copy.about + ' · ' + tn('{0} day a week', '{0} days a week', o.days)}
        onClick={() => addStarter(o.id, copy.name)}
      />
    )
  })
}
