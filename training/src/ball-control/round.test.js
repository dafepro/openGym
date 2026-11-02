import { describe, expect, it } from 'vitest'
import { createRound, elapsedMs, observeRound, summarizeRound, transitionRound } from './round.js'
const ready = () => createRound({ id: 'round-one', drillId: 'bc-side-roll', durationSeconds: 30, date: '2026-11-01T12:00:00.000Z' })
describe('ball-control observed round', () => {
  it('excludes paused/background time and requires explicit resumption', () => {
    let round = transitionRound(ready(), 'start', 100)
    round = transitionRound(round, 'pause', 5100)
    expect(elapsedMs(round, 100000)).toBe(5000)
    round = transitionRound(round, 'resume', 100000)
    round = transitionRound(round, 'finish', 102500)
    expect(summarizeRound(round)).toMatchObject({ practiceSeconds: 7.5, completedDuration: false, cameraUsed: false, targetArrivals: null, manualRepetitions: null })
  })
  it('makes rapid duplicate commands idempotent, including duplicate finish', () => {
    let round = transitionRound(ready(), 'start', 0)
    expect(transitionRound(round, 'start', 2000)).toBe(round)
    round = transitionRound(round, 'pause', 3500)
    expect(transitionRound(round, 'pause', 4000)).toBe(round)
    round = transitionRound(round, 'finish', 5000)
    expect(transitionRound(round, 'finish', 999999)).toBe(round)
    expect(transitionRound(round, 'resume', 999999)).toBe(round)
    expect(round.elapsedMs).toBe(3500)
  })
  it('caps duration and keeps measurement sources distinct', () => {
    let round = transitionRound(ready(), 'start', 1000)
    round = transitionRound({ ...round, cameraUsed: true, targetArrivals: 3, manualRepetitions: 8 }, 'finish', 40000)
    expect(summarizeRound(round)).toMatchObject({ practiceSeconds: 30, completedDuration: true, manualRepetitions: 8, cameraUsed: true, targetArrivals: 3, metricSources: { targetArrivals: 'experimental-camera', manualRepetitions: 'manual', practiceSeconds: 'observed-timer' } })
  })
  it('requires finish and distinguishes no camera from observed zero', () => {
    expect(() => summarizeRound(ready())).toThrow('Finish')
    const round = transitionRound(transitionRound(ready(), 'start', 0), 'finish', 0)
    expect(summarizeRound(round).metricSources.targetArrivals).toBeNull()
    expect(() => createRound({ id: 'a', drillId: 'b', durationSeconds: -1 })).toThrow()
  })
})

describe('camera deadline enforcement between timer ticks', () => {
  it('accepts an in-time arrival but refuses observation or arrivals at/after expiry', () => {
    let round = transitionRound(ready(), 'start', 1000)
    round = observeRound(round, { cameraObserved: true, arrivalIncrement: 1 }, 30999)
    expect(round.targetArrivals).toBe(1)
    round = observeRound(round, { cameraObserved: true, arrivalIncrement: 4 }, 31000)
    expect(round.phase).toBe('finished'); expect(round.targetArrivals).toBe(1)
    expect(summarizeRound(round).practiceSeconds).toBe(30)
    expect(observeRound(round, { arrivalIncrement: 99 }, 31001)).toBe(round)
    const neverObserved = observeRound(transitionRound(ready(), 'start', 0), { cameraObserved: true }, 30001)
    expect(summarizeRound(neverObserved).targetArrivals).toBeNull()
  })
})
