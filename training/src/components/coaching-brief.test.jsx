import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { coachingBrief } from './CoachingBrief.jsx'
import PracticeView from '../views/PracticeView.jsx'

describe('instruction-first practice', () => {
  it('separates supplied cues and credit without inventing coaching or equipment', () => {
    const drill = { instructions: 'Roll the ball. Keep it close. Demonstration: Coach.' }
    expect(coachingBrief(drill)).toEqual({ steps: ['Roll the ball.'], focus: ['Keep it close.'], credit: ['Demonstration: Coach.'], setup: [], reminders: [] })
  })
  it('gives a player’s written setup its own place instead of mixing it into drill steps', () => {
    expect(coachingBrief({ instructions: 'Setup: Ball and two markers.\n\nTap between your feet.\nKeep it close.' })).toMatchObject({
      setup: ['Ball and two markers.'], steps: ['Tap between your feet.'], focus: ['Keep it close.'],
    })
  })
  it('shows compact help beside the title and keeps targets and instructions on the page', () => {
    const drill = { id: 'timed', title: 'Touch drill', mode: 'time', sets: 3, durationSec: 45, restSec: 20, side: 'each', instructions: 'Receive and turn.', media: { id: 'demo', status: 'approved', path: '/media/demo' } }
    const html = renderToStaticMarkup(<PracticeView drill={drill} sets={[{ id: 'row', side: 'right', setNumber: 2 }]} />)
    expect(html).toContain('3 sets · 45 sec · each foot')
    expect(html).toContain('20s rest')
    expect(html).toContain('Right foot')
    expect(html).toContain('pb-demo-compact')
    expect(html).toContain('Receive and turn.')
    expect(html.indexOf('Watch demonstration')).toBeLessThan(html.indexOf('Practice targets'))
    expect(html).toContain('preload="metadata"')
    expect(html).not.toContain('autoPlay')
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

describe('bottom practice controls', () => {
  const drill = { id: 'free', title: 'Ball control', mode: 'practice', sets: 1 }
  it('keeps starting separate from recording a drill', () => {
    const html = renderToStaticMarkup(<PracticeView drill={drill} phase="ready" onPrimary={() => {}} onFinish={() => {}} />)
    expect(html).toMatch(/disabled="" aria-label="Finish practice"/)
    expect(html).toContain('aria-label="Start drill"')
    expect(html.indexOf('aria-label="Start drill"')).toBeLessThan(html.indexOf('aria-label="Quit practice"'))
    expect(html.indexOf('aria-label="Start drill"')).toBeLessThan(html.indexOf('aria-label="Finish practice"'))
  })
  it('keeps the stopwatch and pause action inside the same panel as completion', () => {
    const html = renderToStaticMarkup(<PracticeView drill={drill} phase="working" practiceSeconds={72} practicePaused onPrimary={() => {}} onTogglePracticePause={() => {}} />)
    const panel = html.slice(html.indexOf('aria-label="Practice controls"'))
    expect(panel).toContain('1:12')
    expect(panel).toContain('aria-label="Resume practice timer"')
    expect(panel).toContain('aria-label="Finish practice"')
    expect(panel).not.toMatch(/disabled="" aria-label="Finish practice"/)
    expect(html.slice(0, html.indexOf('aria-label="Practice controls"'))).not.toContain('role="timer"')
  })
  it('provides tap controls for actual repetitions and retains explicit set completion', () => {
    const html = renderToStaticMarkup(<PracticeView drill={{ ...drill, mode: 'reps', reps: 12 }} phase="working" actualValue={0} onActualChange={() => {}} onPrimary={() => {}} />)
    expect(html).toContain('aria-label="Add one repetition"')
    expect(html).toMatch(/disabled="" aria-label="Subtract one repetition"/)
    expect(html).toContain('aria-label="Repetitions completed" value="0"')
    expect(html).toContain('aria-label="Finish practice"')
  })
  it('allows paused timed work to be recorded without requiring the timer to resume', () => {
    const html = renderToStaticMarkup(<PracticeView drill={{ ...drill, mode: 'time', durationSec: 30 }} phase="ready" sets={[{ id: 'set-1', status: 'stopped', actual: 5 }]} onPrimary={() => {}} onRecordStopped={() => {}} />)
    expect(html).toContain('aria-label="Resume set"')
    expect(html).toContain('0:25')
    expect(html).not.toMatch(/disabled="" aria-label="Finish practice"/)
  })
})
