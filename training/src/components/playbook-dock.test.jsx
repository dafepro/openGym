import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import PracticeActionDock from './PracticeActionDock.jsx'

const action = () => {}
const base = { drill: { id: 'touch', mode: 'time', sets: 2, durationSec: 30 }, phase: 'working', sets: [{ id: 'one', setNumber: 1 }, { id: 'two', setNumber: 2 }], currentSetIndex: 0, drillIndex: 0, drillCount: 2, onPrimary: action, onStop: action, onQuit: action }
const render = fields => renderToStaticMarkup(<PracticeActionDock {...base} {...fields}/>)

describe('work-dock state actions', () => {
  it.each([
    [{ currentSetIndex: 0 }, 'Finish set'],
    [{ currentSetIndex: 1 }, 'Next drill'],
    [{ currentSetIndex: 1, drillIndex: 1 }, 'Finish practice'],
    [{ phase: 'rest' }, 'Skip rest'],
    [{ phase: 'review', actualValue: 10, onActualChange: action }, 'Confirm time'],
    [{ phase: 'complete' }, 'Finish practice'],
  ])('names the next action for the current phase and position: %j', (fields, label) => {
    expect(render(fields)).toContain(`aria-label="${label}"`)
  })
  it('keeps rest controls and a right-side pause button available without live timers being focusable', () => {
    const html = render({ phase: 'rest', remainingSeconds: 17, onPauseRest: action, onResumeRest: action, onAdjustRest: action })
    expect(html).toContain('0:17')
    expect(html).toContain('aria-label="Pause rest"')
    expect(html).toContain('aria-label="Reduce rest by 15 seconds"')
    expect(html).toContain('aria-label="Add 15 seconds of rest"')
    expect(html.indexOf('qt-control-readout')).toBeLessThan(html.indexOf('qt-control-play'))
    expect(html).not.toMatch(/role="timer"[^>]*tabindex/)
  })
  it('counts left and right foot rows as separate work before offering the next drill', () => {
    const fields = { drill: { ...base.drill, side: 'each' }, sets: [{ setNumber: 1, side: 'left' }, { setNumber: 1, side: 'right' }, { setNumber: 2, side: 'left' }, { setNumber: 2, side: 'right' }] }
    expect(render({ ...fields, currentSetIndex: 2 })).toContain('aria-label="Finish set"')
    expect(render({ ...fields, currentSetIndex: 3 })).toContain('aria-label="Next drill"')
    expect(render({ ...fields, currentSetIndex: 3 })).toContain('Right foot')
  })
  it('retains disabled state for a read-only session in every action', () => {
    const html = render({ disabled: true, onPrimary: undefined, onStop: undefined, onQuit: undefined })
    expect(html).toMatch(/disabled="" aria-label="Finish set"/)
    expect(html).toMatch(/disabled="" aria-label="Quit practice"/)
  })
})
