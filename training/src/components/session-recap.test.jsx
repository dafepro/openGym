import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import SessionRecap, { RecordedWork } from './SessionRecap.jsx'

const record = rows => ({ rows, assignment: { drills: [{ id: 'drill', title: 'Close control' }] } })
describe('recorded session recap', () => {
  it('separates work seconds from reps and ignores pending work and video watching', () => {
    const html = renderToStaticMarkup(<RecordedWork session={record([
      { mode: 'time', status: 'done', actual: 30 },
      { mode: 'practice', status: 'stopped', practiceSeconds: 42 },
      { mode: 'reps', status: 'done', actual: 12 },
      { mode: 'reps', status: 'stopped', actual: 4 },
      { mode: 'time', status: 'pending', actual: 600 },
      { mode: 'watch', status: 'done', actual: 999 },
    ])} />)
    expect(html).toContain('1:12')
    expect(html).toContain('>16</strong>')
    expect(html).toContain('Some work was untimed.')
    expect(html).not.toContain('999')
  })
  it('does not turn missing historical time into zero, and preserves measured zero', () => {
    expect(renderToStaticMarkup(<RecordedWork session={record([{ mode: 'practice', status: 'done' }])} />)).toContain('No time recorded')
    expect(renderToStaticMarkup(<RecordedWork session={record([{ mode: 'practice', status: 'done', practiceSeconds: 0 }])} />)).toContain('0:00')
    expect(renderToStaticMarkup(<RecordedWork session={record([{ mode: 'watch', status: 'done' }])} />)).toBe('')
  })
  it('shows partial drill progress without promoting stopped sets to completed sets', () => {
    const html = renderToStaticMarkup(<SessionRecap session={record([{ drillId: 'drill', mode: 'reps', status: 'done', actual: 5 }, { drillId: 'drill', mode: 'reps', status: 'stopped', actual: 2 }])} completed={1} total={2} label="set recorded" />)
    expect(html).toContain('stroke-dasharray="50 100"')
    expect(html).toContain('scaleX(0.5)')
    expect(html).toContain('>7</strong>')
  })
})
