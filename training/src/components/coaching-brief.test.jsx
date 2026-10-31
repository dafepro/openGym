import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { coachingBrief } from './CoachingBrief.jsx'
import PracticeView from '../views/PracticeView.jsx'

describe('instruction-first practice', () => {
  it('separates supplied cues and credit without inventing coaching or equipment', () => {
    const drill = { instructions: 'Roll the ball. Keep it close. Demonstration: Coach.' }
    expect(coachingBrief(drill)).toEqual({ steps: ['Roll the ball.'], focus: ['Keep it close.'], credit: ['Demonstration: Coach.'], setup: [], reminders: [] })
  })
  it('shows prescribed work, rest, and current foot before the demo', () => {
    const drill = { id: 'timed', title: 'Touch drill', mode: 'time', sets: 3, durationSec: 45, restSec: 20, side: 'each', instructions: 'Receive and turn.' }
    const html = renderToStaticMarkup(<PracticeView drill={drill} sets={[{ id: 'row', side: 'right', setNumber: 2 }]} />)
    expect(html).toContain('3 sets · 45 sec · each foot')
    expect(html).toContain('20s rest')
    expect(html).toContain('Right foot')
    expect(html.indexOf('Assigned work')).toBeLessThan(html.indexOf('Watch demonstration'))
    expect(html).not.toContain('<video')
    expect(html).not.toContain('<dialog')
  })
  it('does not turn the self-paced internal row into a prescribed set or time', () => {
    const html = renderToStaticMarkup(<PracticeView drill={{ id: 'free', title: 'Practice', mode: 'practice', sets: 1, restSec: null }} />)
    expect(html).toContain('Self-paced')
    expect(html).not.toContain('1 set')
    expect(html).not.toContain('0s rest')
  })
  it('retains rest pause, elapsed review, and actual repetition controls', () => {
    const drill = { id: 'test', title: 'Drill', mode: 'time', durationSec: 45, sets: 3 }
    const rest = renderToStaticMarkup(<PracticeView drill={drill} phase="rest" remainingSeconds={12} restPaused />)
    expect(rest).toContain('0:12')
    expect(rest).toContain('Resume rest')
    const review = renderToStaticMarkup(<PracticeView drill={drill} phase="review" actualValue={18} onActualChange={() => {}} />)
    expect(review).toContain('Seconds actually completed')
    expect(review).toContain('value="18"')
    const reps = renderToStaticMarkup(<PracticeView drill={{ ...drill, mode: 'reps', reps: 10 }} phase="working" actualValue={8} onActualChange={() => {}} />)
    expect(reps).toContain('Repetitions completed')
    expect(reps).toContain('value="8"')
  })

})
