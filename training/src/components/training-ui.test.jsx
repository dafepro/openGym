import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import DrillDemonstration from './DrillDemonstration.jsx'
import PracticeActionDock from './PracticeActionDock.jsx'
import PracticeView from '../views/PracticeView.jsx'
import HistoryView from '../views/HistoryView.jsx'
import BuildPracticeView from '../views/BuildPracticeView.jsx'
import TodayView from '../views/TodayView.jsx'
import DrillMetadata from './DrillMetadata.jsx'
import { SessionDetail } from '../views/HistoryDetails.jsx'

const reviewAssignment = { id: 'review-test', revision: 'v1', title: 'Video review test', drills: [{ id: 'review-video', title: 'Reference video', instructions: 'Review this reference.', mode: 'watch', sets: 1, side: 'both', restSec: null, media: { id: 'unavailable-test', status: 'unavailable' } }] }

describe('practice bottom action tray', () => {
  it('keeps stop on the left, clock and pause in the middle, and Next to the right', () => {
    const html = renderToStaticMarkup(<PracticeActionDock phase="working" primaryLabel="Drill done"
      onPrimary={() => {}} onStop={() => {}} onTogglePracticePause={() => {}}
      canPausePractice clockLabel="Time practiced" clockValue="1:23" />)
    expect(html).toContain('Time practiced')
    expect(html).toContain('1:23')
    expect(html).toContain('>Stop</span>')
    expect(html).toContain('>Pause</span>')
    expect(html).toContain('<small>Done</small>')
    expect(html).toContain('<strong>Next</strong>')
    expect(html.indexOf('qt-action-stop')).toBeLessThan(html.indexOf('qt-action-pause'))
    expect(html.indexOf('qt-action-pause')).toBeLessThan(html.indexOf('qt-action-next'))
  })

  it('uses the same pause target to resume rest without finishing a set', () => {
    const html = renderToStaticMarkup(<PracticeActionDock phase="rest" restPaused
      onResumeRest={() => {}} onAdjustRest={() => {}} onPrimary={() => {}}
      clockLabel="Rest paused" clockValue="0:45" />)
    expect(html).toContain('Resume rest')
    expect(html).toContain('0:45')
    expect(html).toContain('>Next</strong>')
    expect(html).toContain('−15s')
  })
})

describe('training presentation boundaries', () => {
  it('labels link-selected work as shared and offers a personal copy', () => {
    const html = renderToStaticMarkup(<TodayView assignment={reviewAssignment} kind="shared" onBuild={() => {}} />)
    expect(html).toContain('Shared practice')
    expect(html).toContain('<h1>Video review test</h1>')
    expect(html).toContain('Make a copy')
    expect(html).not.toContain('Current assignment')
  })

  it('renders the independent builder with an empty draft and explicit add controls', () => {
    const html = renderToStaticMarkup(<BuildPracticeView draft={{ title: '', drills: [] }} library={reviewAssignment.drills} saved={[]} history={[]} />)
    expect(html).toContain('Build practice')
    expect(html).toContain('Custom drill')
    expect(html).toContain('Add drill')
    expect(html).toContain('unsaved')
    expect(html).not.toContain('Reps per set')
  })

  it('never turns an external or unapproved media reference into a player', () => {
    for (const media of [{ status: 'approved', path: 'https://youtube.com/watch?v=abc' }, { status: 'unavailable', path: '/media/clip' }, { status: 'approved', path: '//example.com/media/clip' }]) {
      const html = renderToStaticMarkup(<DrillDemonstration title="Sample" media={media} />)
      expect(html).not.toContain('<video')
      expect(html).toContain('Demonstration unavailable')
    }
  })

  it('offers inline native controls and identifies a sample clip without autoplay', () => {
    const html = renderToStaticMarkup(<DrillDemonstration title="Sample" sample media={{ id: 'sample-playback', status: 'approved', path: '/media/sample-playback' }} />)
    expect(html).toContain('<video')
    expect(html).toContain('controls=""')
    expect(html).toContain('playsInline=""')
    expect(html).not.toContain('autoPlay')
    expect(html).toContain('not a drill demonstration')
  })

  it('opts into autoplay for a requested demo and exposes an additional playback control', () => {
    const html = renderToStaticMarkup(<DrillDemonstration title="Demo" autoPlay media={{ id: 'clip', status: 'approved', path: '/media/clip' }} />)
    expect(html).toContain('autoPlay=""')
    expect(html).toContain('aria-label="Play video"')
    expect(html).toContain('Loop last 5s')
    expect(html).not.toContain('type="number"')
  })

  it('accepts an approved media identity containing multiple dots', () => {
    const html = renderToStaticMarkup(<DrillDemonstration title="Sample" media={{ id: 'trainer.drill.v1', status: 'approved', path: '/media/trainer.drill.v1' }} />)
    expect(html).toContain('<video')
  })

  it('does not describe a partial save as practice complete', () => {
    const html = renderToStaticMarkup(<PracticeView saved complete={false} completedCount={1} totalCount={4} />)
    expect(html).toContain('Session saved')
    expect(html).toContain('sets left unfinished')
    expect(html).not.toContain('Practice complete')
  })

  it('identifies only the selected edition of a logical assignment as current', () => {
    const html = renderToStaticMarkup(<HistoryView currentAssignmentId="same" currentAssignmentRevision="2" assignments={[{ id: 'same', revision: '1', title: 'Old edition', drills: [] }, { id: 'same', revision: '2', title: 'New edition', drills: [] }]} />)
    expect(html.match(/>Current</g)).toHaveLength(1)
    expect(html.match(/>Previous</g)).toHaveLength(1)
  })

  it('keeps an active older edition separate from the current assignment action', () => {
    const html = renderToStaticMarkup(<TodayView assignment={{ id: 'same', revision: '2', title: 'Current edition', drills: [] }} activeSession={{ assignmentId: 'same', assignmentRevision: '1' }} onStart={() => {}} onResume={() => {}} />)
    expect(html).toContain('earlier assignment edition')
    expect(html).toContain('Start practice')
    expect(html).not.toContain('Resume practice')
  })

  it('offers a video review without inventing athletic prescriptions on Today', () => {
    const html = renderToStaticMarkup(<TodayView assignment={reviewAssignment} onStart={() => {}} />)
    expect(html).toContain('Start review')
    expect(html).toContain('does not record athletic work')
    expect(html).not.toContain('Start practice')
    expect(html).not.toContain('work through the sets')
    expect(html).not.toContain('qt-assignment-art')
  })

  it('labels watch progress and completion as video review rather than athletic completion', () => {
    const ready = renderToStaticMarkup(<PracticeView assignment={reviewAssignment} drill={reviewAssignment.drills[0]} sets={[{ id: 'row-test', mode: 'watch', status: 'pending' }]} />)
    expect(ready).toContain('Video review')
    expect(ready).not.toContain('Set 1')
    const saved = renderToStaticMarkup(<PracticeView assignment={reviewAssignment} saved complete completedCount={1} totalCount={1} />)
    expect(saved).toContain('Videos reviewed')
    expect(saved).toContain('No athletic work was recorded')
    expect(saved).not.toContain('Practice complete')
    expect(saved).not.toContain('set recorded')
    const detail = renderToStaticMarkup(<SessionDetail session={{ assignment: reviewAssignment, assignmentRevision: 'v1', status: 'completed', rows: [{ id: 'row-test', drillId: 'review-video', mode: 'watch', status: 'done', prescriptionMet: true, actual: null, setNumber: 1 }] }} />)
    expect(detail).toContain('Videos reviewed')
    expect(detail).toContain('Demonstration acknowledged')
    expect(detail).not.toContain('Set 1')
  })

  it('retains practice/set semantics for mixed prescribed assignments', () => {
    const mixed = { ...reviewAssignment, drills: [...reviewAssignment.drills, { ...reviewAssignment.drills[0], id: 'reps-test', mode: 'reps', reps: 4 }] }
    const saved = renderToStaticMarkup(<PracticeView assignment={mixed} saved complete completedCount={2} totalCount={2} />)
    expect(saved).toContain('Practice complete')
    expect(saved).toContain('sets recorded')
  })

  it('displays canonical skills and explicit context without inventing requirements', () => {
    const html = renderToStaticMarkup(<DrillMetadata metadata={{ version: 1, registryVersion: 1, tags: ['futbol:first_touch'], requirements: { equipment: ['ball'], participants: { min: 1, max: 1, roles: [] }, space: { lengthM: 3, widthM: 2 } } }} />)
    expect(html).toContain('First touch')
    expect(html).toContain('Solo')
    expect(html).toContain('3 × 2 m')
    expect(html).not.toContain('Outdoor')
    expect(renderToStaticMarkup(<DrillMetadata />)).toBe('')
  })
})

describe('practice-first assignments', () => {
  const assignment = { ...reviewAssignment, title: 'Ready practice', drills: [{ ...reviewAssignment.drills[0], mode: 'practice', instructions: 'Practice the movement.', media: { id: 'fixture-video', status: 'approved', path: '/media/fixture-video' } }] }
  it('starts an assigned practice directly without a builder or review prerequisite', () => {
    const html = renderToStaticMarkup(<TodayView assignment={assignment} onStart={() => {}} />)
    expect(html).toContain('Start practice')
    expect(html.indexOf('Start practice')).toBeLessThan(html.indexOf('qt-drill-list'))
    expect(html).not.toContain('qt-assignment-art')
    expect(html).not.toContain('Start review')
    expect(html).not.toContain('Video review only')
  })
  it('loads demonstration only on request and keeps practice completion independent', () => {
    const html = renderToStaticMarkup(<PracticeView assignment={assignment} drill={assignment.drills[0]} primaryLabel="Start drill" />)
    expect(html).toContain('Watch demonstration')
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('<video')
    expect(html).toContain('Start drill')
    expect(html).not.toContain('Watch &amp; learn')
    const saved = renderToStaticMarkup(<PracticeView assignment={assignment} saved complete completedCount={1} totalCount={1} />)
    expect(saved).toContain('Practice complete')
    expect(saved).toContain('drill practiced')
    expect(saved).not.toContain('Videos reviewed')
  })
  it('shows tracked self-paced duration while preserving old unmeasured history', () => {
    const html = renderToStaticMarkup(<SessionDetail session={{ assignment, assignmentRevision: 'v1', status: 'completed', rows: [{ id: 'row', drillId: 'review-video', mode: 'practice', status: 'done', prescriptionMet: true, actual: null, target: null, practiceSeconds: 72 }] }} />)
    expect(html).toContain('1:12 time practiced')
    expect(html).not.toContain('no reps or duration tracked')
  })
  it('shows self-paced completion honestly in history', () => {
    const html = renderToStaticMarkup(<SessionDetail session={{ assignment, assignmentRevision: 'v1', status: 'completed', rows: [{ id: 'row', drillId: 'review-video', mode: 'practice', status: 'done', prescriptionMet: true, actual: null, target: null, setNumber: 1 }] }} />)
    expect(html).toContain('Practiced · no reps or duration tracked')
    expect(html).not.toContain('null reps')
    expect(html).not.toContain('Demonstration acknowledged')
  })
})
