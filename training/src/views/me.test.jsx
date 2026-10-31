import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import MeView from './MeView.jsx'
import { SessionDetail } from './HistoryDetails.jsx'
import TrainingShell from '../components/TrainingShell.jsx'

const now = new Date(2026, 9, 30, 12).getTime()
const assignment = { id: 'assigned', revision: '1', title: 'First touch practice', drills: [{ id: 'touch', title: 'Receive and turn', mode: 'practice', metadata: { version: 1, registryVersion: 1, tags: ['futbol:first-touch'] } }] }
const record = { id: 'saved', assignmentId: assignment.id, assignmentRevision: '1', assignment, status: 'completed', startedAt: now - 10000, endedAt: now, rows: [{ id: 'row', drillId: 'touch', mode: 'practice', status: 'done', prescriptionMet: true }] }

describe('Me presentation', () => {
  it('keeps empty history honest and exposes editable profile and both backup actions', () => {
    const html = renderToStaticMarkup(<MeView now={now} onExport={() => {}} onRestore={() => {}} />)
    expect(html).toContain('Make this space your own.')
    expect(html).toContain('Your first session starts here')
    expect(html).toContain('No timed practice recorded')
    expect(html).toContain('Complete a drill with a skill label')
    expect(html).toContain('Export a backup')
    expect(html).toContain('Restore a backup')
    expect(html.match(/class="qt-calendar-day"/g)).toHaveLength(28)
    expect(html).not.toContain('qt-segment')
  })
  it('shows recorded time alongside unmeasured history without estimating duration', () => {
    const html = renderToStaticMarkup(<MeView now={now} sessions={[record, { ...record, id: 'timed', rows: [{ ...record.rows[0], practiceSeconds: 72 }] }]} assignments={[assignment]} />)
    expect(html).toContain('1:12')
    expect(html).toContain('Some practice has no recorded duration and is left out.')
    expect(html).toContain('Practice time not tracked')
    expect(html).toContain('first touch')
    expect(html).toContain('This shows exposure, not a skill rating.')
    expect(html.match(/>Assigned</g)).toHaveLength(2)
  })
  it('offers saved-session deletion only when a handler is provided', () => {
    expect(renderToStaticMarkup(<SessionDetail session={record} onDelete={() => {}} />)).toContain('Delete session')
    expect(renderToStaticMarkup(<SessionDetail session={record} />)).not.toContain('Delete session')
    expect(renderToStaticMarkup(<SessionDetail session={{ ...record, status: 'active' }} onDelete={() => {}} />)).not.toContain('Delete session')
  })
  it('makes Me the navigation destination', () => {
    const html = renderToStaticMarkup(<TrainingShell page="me" builder />)
    expect(html).toContain('aria-current="page"')
    expect(html).toContain('<span>Me</span>')
    expect(html).not.toContain('<span>History</span>')
  })
})
