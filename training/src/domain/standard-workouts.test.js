import { describe, it, expect } from 'vitest'
import { standardWorkouts, standardDrills, workoutSummary } from './standard-workouts.js'
import { validateAssignment, createSession } from './index.js'
import { canonicalSkillTags } from './metadata.js'

describe('public starter practice library', () => {
  it('provides twenty valid, independently startable practices without approving media', () => {
    expect(standardWorkouts).toHaveLength(20)
    expect(new Set(standardWorkouts.map(item => item.assignment.id)).size).toBe(20)
    const ids = standardWorkouts.flatMap(item => item.assignment.drills.map(drill => drill.id))
    expect(new Set(ids).size).toBe(ids.length)
    for (const item of standardWorkouts) {
      expect(() => validateAssignment(item.assignment)).not.toThrow()
      expect(item.sources.length).toBeGreaterThan(0)
      expect(createSession(item.assignment, { id: 'test', now: 1000 }).rows.length).toBeGreaterThan(0)
      for (const drill of item.assignment.drills) {
        expect(drill.media.status).toBe('unavailable')
        expect(drill.media.url).toBeUndefined()
        expect(canonicalSkillTags(drill.metadata).length).toBeGreaterThan(0)
        expect(drill.metadata.requirements.participants.min).toBeGreaterThanOrEqual(1)
      }
    }
  })
  it('includes skill and movement labels in independent drill copies', () => {
    const drills = standardDrills()
    const tags = new Set(drills.flatMap(drill => canonicalSkillTags(drill.metadata)))
    for (const tag of ['agility', 'endurance', 'passing', 'shooting', 'dribbling', 'balance']) expect(tags.has(`futbol:${tag}`)).toBe(true)
    drills[0].title = 'Changed draft'
    expect(standardDrills()[0].title).not.toBe('Changed draft')
  })
  it('includes rest between drills and sides, but not after the final row', () => {
    for (const { assignment } of standardWorkouts) {
      const rows = createSession(assignment, { id: 'summary', now: 1000 }).rows
      const seconds = rows.reduce((sum, row, index) => sum + (row.mode === 'time' ? row.target : 0) + (index < rows.length - 1 ? assignment.drills.find(drill => drill.id === row.drillId).restSec : 0), 0)
      expect(workoutSummary(assignment).seconds).toBe(seconds)
      expect(workoutSummary(assignment).hasReps).toBe(rows.some(row => row.mode === 'reps'))
    }
  })
})
