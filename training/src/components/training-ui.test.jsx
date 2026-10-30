import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import DrillDemonstration from './DrillDemonstration.jsx'
import PracticeView from '../views/PracticeView.jsx'
import HistoryView from '../views/HistoryView.jsx'
import TodayView from '../views/TodayView.jsx'

describe('training presentation boundaries', () => {
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
})
