import { expect, it } from 'vitest'
import { buildStarterProgramme } from './starter.js'
import { saveProgramme, startProgramme, endProgramme } from './programmes.js'
import { refillAfter } from './rotation.js'

it.each([3, 5])('runs the SL %i×5 prescription across two weeks and a missed day', (sets) => {
  const id = 'sl-' + sets + 'x5'
  const build = () => buildStarterProgramme(id, 'My block')
  const {
    routines: [a, b],
    programme
  } = build()
  const rows = (r) => r.ex.map((e) => [e.id, e.sets, e.reps, e.weight])
  expect(rows(a)).toEqual([
    ['0043', sets, 5, 0],
    ['0025', sets, 5, 0],
    ['0027', sets, 5, 0]
  ])
  expect(rows(b)).toEqual([
    ['0043', sets, 5, 0],
    ['1162', sets, 5, 0],
    ['0032', 1, 5, 0]
  ])
  a.ex[0].sets = 2
  expect(build().routines[0].ex[0].sets).toBe(sets)
  const s = { routines: [a, b], workouts: [], week: {}, programmes: {} }
  saveProgramme(s, programme)
  startProgramme(s, programme.id, '2026-11-02', 1)
  // Wednesday's B is logged a day late. Subsequent rest days move along with it.
  for (const [next, due, done, after] of [
    [a, '02', '02', '04'],
    [b, '04', '05', '07'],
    [a, '07', '07', '10'],
    [b, '10', '10', '12'],
    [a, '12', '12', '14'],
    [b, '14', '14', '17']
  ]) {
    expect(s.queue).toMatchObject({ ids: [next.id], startsOn: '2026-11-' + due })
    const workout = { routineId: next.id, d: '2026-11-' + done, start: Date.parse('2026-11-' + done) }
    s.workouts.push(workout)
    expect(refillAfter(s, workout, workout.d, workout.start + 1)).toBe(true)
    expect(s.queue.startsOn).toBe('2026-11-' + after)
  }
  expect(s.queue.ids).toEqual([a.id])
  endProgramme(s)
  expect(s.queue).toBeNull()
  expect(s.workouts).toHaveLength(6)
})
