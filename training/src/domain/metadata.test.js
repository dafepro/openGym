import { describe, expect, it } from 'vitest'
import { syntheticCatalog } from '../../fixtures/catalog.js'
import { createSession, validateAssignment, validateCatalog, validateSession } from './index.js'
import { canonicalSkillTags, drillFeasibility, normalizeTrainingTag, SKILL_REGISTRY_VERSION, validateDrillMetadata } from './metadata.js'
const metadata = extra => ({ version: 1, registryVersion: 1, tags: ['futbol:receiving', 'Coach blue'], ...extra })
describe('bounded optional soccer drill metadata', () => {
  it('preserves existing catalogs and snapshots without metadata', () => {
    expect(validateCatalog(syntheticCatalog)).toEqual(syntheticCatalog)
    const old = createSession(syntheticCatalog.assignments[0], { id: 'metadata-old', now: 1000 })
    expect(validateSession(old)).toEqual(old)
  })
  it('normalizes versioned canonical aliases without inventing custom semantics', () => {
    expect(SKILL_REGISTRY_VERSION).toBe(1)
    expect(normalizeTrainingTag(' FUTBOL:Receiving ')).toBe('futbol:first-touch')
    expect(canonicalSkillTags(metadata({ tags: ['futbol:control', 'futbol:ball-control', 'futbol:unregistered', 'Coach blue'] }))).toEqual(['futbol:ball-control'])
    expect(canonicalSkillTags()).toEqual([])
  })
  it('retains optional metadata in immutable session snapshots', () => {
    const assignment = structuredClone(syntheticCatalog.assignments[0])
    assignment.drills[0].metadata = metadata()
    const session = createSession(assignment, { id: 'metadata-new', now: 1000 })
    assignment.drills[0].metadata.tags[0] = 'futbol:shooting'
    expect(session.assignment.drills[0].metadata.tags[0]).toBe('futbol:receiving')
    expect(validateAssignment(session.assignment)).toEqual(session.assignment)
    expect(validateSession(session)).toEqual(session)
  })
  it.each([
    { version: 2 }, { registryVersion: 99 }, { tags: Array(33).fill('x') }, { tags: ['x'.repeat(65)] },
    { tags: ['bad\nlabel'] }, { privateOperatorNotes: 'not child-facing' },
    { requirements: { participants: { min: 0, roles: [] } } },
    { requirements: { participants: { min: 2, max: 1, roles: [] } } },
    { requirements: { participants: { min: 2 } } },
    { requirements: { equipment: ['ball'], arbitraryUrl: 'https://example.test' } },
    { requirements: { space: { lengthM: Infinity, widthM: 2 } } },
  ])('rejects invalid extension %j', extra => {
    expect(() => validateDrillMetadata(metadata(extra))).toThrow()
  })
})
describe('context feasibility is explicit', () => {
  const drill = { metadata: metadata({ requirements: {
    settings: ['outdoor'], equipment: ['ball', 'cones'], participants: { min: 2, max: 3, roles: ['passer'] }, space: { lengthM: 10, widthM: 5 },
  } }) }
  const context = { setting: 'outdoor', equipment: ['ball', 'cones'], participants: { count: 2, roles: ['passer'] }, space: { lengthM: 5, widthM: 10 } }
  it('accepts known equipment, partner roles, setting and rotated space', () => {
    expect(drillFeasibility(drill, context)).toEqual({ eligible: true, issues: [], metadataKnown: true })
  })
  it('reports missing equipment, partner, roles, space and setting separately', () => {
    const result = drillFeasibility(drill, { setting: 'indoor', equipment: ['ball'], participants: { count: 1, roles: [] }, space: { lengthM: 3, widthM: 3 } })
    expect(result.eligible).toBe(false)
    expect(result.issues.map(issue => issue.code)).toEqual(['setting-mismatch', 'missing-equipment', 'participant-count-mismatch', 'missing-participant-role', 'insufficient-space'])
  })
  it('treats missing requirement metadata as unknown rather than no requirements', () => {
    expect(drillFeasibility({}, context).issues.map(issue => issue.code)).toEqual(['unknown-setting', 'unknown-equipment', 'unknown-participants', 'unknown-space'])
    expect(drillFeasibility({ metadata: metadata() }, { equipment: [] }).eligible).toBe(false)
    expect(drillFeasibility(drill, { participants: { count: 2 } }).issues[0].code).toBe('unknown-participant-roles')
  })
  it('accepts explicit no-kit and solo declarations but never infers them from tags/title', () => {
    expect(drillFeasibility({ metadata: metadata({ requirements: { equipment: [], participants: { min: 1, max: 1, roles: [] }, settings: [], space: { lengthM: 0, widthM: 0 } } }) }, { setting: 'home', equipment: [], participants: { count: 1 }, space: { lengthM: 0, widthM: 0 } }).eligible).toBe(true)
    expect(drillFeasibility({ title: 'Solo no equipment', metadata: metadata({ tags: ['solo', 'no equipment'] }) }, { equipment: [], participants: { count: 1 } }).eligible).toBe(false)
  })
})
