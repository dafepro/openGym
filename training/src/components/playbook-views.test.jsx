import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import TodayView from '../views/TodayView.jsx'
import MyPracticesView, { recentPractices } from '../views/MyPracticesView.jsx'
import OwnDrillView from '../views/OwnDrillView.jsx'
import RandomPracticeView from '../views/RandomPracticeView.jsx'
import PracticeReview from './PracticeReview.jsx'
import PracticeSequence from './PracticeSequence.jsx'
import { standardDrills } from '../domain/standard-workouts.js'
import { validateAssignment } from '../domain/content.js'

const drill = { id: 'close-touches', title: 'Close touches', instructions: 'Keep the ball close.', mode: 'practice', sets: 1, side: 'both', restSec: null, media: { id: 'close-touches', status: 'approved', path: '/media/close-touches' } }
const assignment = { id: 'assigned', revision: 'v1', title: 'First touch', status: 'current', drills: [drill] }
const noop = () => {}

describe('Playbook whole-practice entry', () => {
  it('puts a single start action before numbered drills and keeps independent choices outside the assignment', () => {
    const html = renderToStaticMarkup(<TodayView assignment={assignment} onStart={noop} onOpenDrill={noop} onWatchDrill={noop} onRandom={noop} onOwnDrill={noop} onBuild={noop}/>)
    expect(html.indexOf('Start practice')).toBeLessThan(html.indexOf('Drills in this practice'))
    expect(html).toContain('One complete practice')
    expect(html).toContain('aria-label="Watch Close touches"')
    expect(html).toContain('Surprise me')
    expect(html).toContain('My own drill')
    expect(html).toContain('Choose my own practice')
    expect(html).not.toContain('Add Close touches')
    expect(html).not.toContain('Search drills')
  })
  it('makes preview non-recording while allowing instruction inspection', () => {
    const html = renderToStaticMarkup(<TodayView assignment={assignment} preview onOpenDrill={noop} onWatchDrill={noop}/>)
    expect(html).toContain('Player preview')
    expect(html).toMatch(/disabled=""[^>]*>.*?Start practice/)
    expect(html).toContain('aria-label="Instructions for Close touches"')
  })
  it('shows only an actual parent note and preserves it in the player preview', () => {
    const html = renderToStaticMarkup(<TodayView assignment={{ ...assignment, note: 'Small touches, left foot first.' }} preview/>)
    expect(html).toContain('Small touches, left foot first.')
    expect(html.indexOf('Start practice')).toBeLessThan(html.indexOf('Small touches, left foot first.'))
    expect(renderToStaticMarkup(<TodayView assignment={assignment}/>)).not.toContain('pb-practice-note')
  })
  it('reuses exact immutable assignment snapshots and deduplicates repeated editions', () => {
    const older = { ...assignment, revision: 'v0' }
    const history = [{ assignment: older }, { assignment }, { assignment }]
    const snapshot = structuredClone(history)
    const result = recentPractices(history)
    expect(result).toEqual([assignment, older])
    expect(result[0]).toBe(assignment)
    expect(validateAssignment(result[0])).toEqual(assignment)
    expect(history).toEqual(snapshot)
  })
  it('starts saved sessions as a whole before exposing drill inspection', () => {
    const html = renderToStaticMarkup(<MyPracticesView saved={[assignment]} onStart={noop} onAdapt={noop} onNew={noop} onRandom={noop} onOwnDrill={noop}/>)
    expect(html.indexOf('Start this practice')).toBeLessThan(html.indexOf('Drills in this practice'))
    expect(html).toContain('Make it fit today')
    expect(html).not.toContain('Add Close touches')
  })
  it('keeps only same-origin approved media in miniature previews', () => {
    const html = renderToStaticMarkup(<PracticeSequence drills={[{ ...drill, media: { ...drill.media, path: 'https://youtube.com/watch?v=bad' } }]} onOpenDrill={noop}/>)
    expect(html).not.toContain('<video')
    expect(html).not.toContain('youtube.com')
  })
})

describe('Independent training choices', () => {
  it('defaults a personal drill to time spent without guessed repetitions', () => {
    const html = renderToStaticMarkup(<OwnDrillView onSubmit={noop}/>)
    expect(html).toContain('aria-pressed="true">Time spent')
    expect(html).toContain('Your timer counts up')
    expect(html).toContain('Start my drill')
    expect(html).toContain('Save for later')
    expect(html).not.toContain('type="number"')
    expect(html).not.toContain('type="file"')
  })
  it('keeps personal drill maintenance secondary and deletion inside edit mode', () => {
    const saved = { ...drill, id: 'custom-test', media: { id: 'custom-test', status: 'unavailable' } }
    const normal = renderToStaticMarkup(<OwnDrillView savedDrills={[saved]} onSubmit={noop} onEditSaved={noop}/>)
    expect(normal).toContain('aria-label="Edit Close touches"')
    expect(normal).not.toContain('Delete drill')
    expect(normal).toContain('noValidate=""')
    const editing = renderToStaticMarkup(<OwnDrillView editingId="custom-test" savedDrills={[saved]} onSubmit={noop} onCancelEdit={noop} onDelete={noop}/>)
    expect(editing).toContain('Save changes')
    expect(editing).toContain('Cancel edit')
    expect(editing).toContain('Delete drill')
    expect(editing).not.toContain('Start my drill')
  })
  it('shows random assumptions explicitly before offering compatible work', () => {
    const html = renderToStaticMarkup(<RandomPracticeView library={standardDrills()} initialSeed="view-test" onStart={noop}/>)
    expect(html).toContain('Outdoors')
    expect(html).toContain('6 × 6 m')
    expect(html).toContain('Solo')
    expect(html).toContain('ball')
    expect(html).toContain('Random practice proposal')
    expect(html).toContain('cones')
    expect(html).toContain('Include drills with unlisted space needs')
    expect(html).toContain('Start this practice')
    expect(html).toContain('Shuffle again')
  })
  it('offers no startable random proposal when no drill fits', () => {
    const html = renderToStaticMarkup(<RandomPracticeView library={[]} initialSeed="empty" onStart={noop}/>)
    expect(html).toContain('Try another setup')
    expect(html).not.toContain('aria-label="Random practice proposal"')
    expect(html.match(/disabled=""/g)).toHaveLength(2)
  })
  it('makes the organizer an explicit named session, not a second catalog', () => {
    const html = renderToStaticMarkup(<PracticeReview draft={{ title: assignment.title, drills: assignment.drills }} onChange={noop} onAdd={noop} onNew={noop} onSwap={noop} onPreview={noop}/>)
    expect(html).toContain('Practice name')
    expect(html).toContain('Add drill')
    expect(html).toContain('aria-label="Edit Close touches"')
    expect(html).not.toContain('Search drills')
  })
})
