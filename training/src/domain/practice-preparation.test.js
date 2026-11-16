import { describe, expect, it } from 'vitest'
import { practicePreparation } from './practice-preparation.js'

const drill = (extra = {}) => ({ mode: 'time', sets: 2, side: 'each', durationSec: 30, restSec: 20, ...extra })
const metadata = (requirements) => ({ version: 1, registryVersion: 1, tags: ['futbol:control'], requirements })

describe('preparation from prescribed work', () => {
  it('counts both feet and prescribed rests, without adding a final rest', () => {
    const practice = { drills: [drill(), drill({ sets: 1, side: 'both', durationSec: 60, restSec: 90 })] }
    const before = structuredClone(practice)
    expect(practicePreparation(practice)).toMatchObject({ workSeconds: 180, restSeconds: 80, openEnded: false })
    expect(practice).toEqual(before)
  })
  it('never invents a rep cadence or a duration for self-paced work', () => {
    const result = practicePreparation({
      drills: [drill({ mode: 'reps', reps: 100 }), drill({ mode: 'practice', sets: 1, side: 'both', restSec: null })]
    })
    expect(result).toMatchObject({ workSeconds: 0, restSeconds: 80, openEnded: true })
  })
  it('keeps unknown requirements distinct from explicitly empty equipment', () => {
    const known = drill({ metadata: metadata({ equipment: [] }) })
    expect(practicePreparation({ drills: [known] })).toMatchObject({
      equipment: [],
      missing: { equipment: false, space: true, participants: true }
    })
    expect(practicePreparation({ drills: [known, drill()] }).missing.equipment).toBe(true)
  })
  it('combines setup conservatively, normalizes labels and retains missing data', () => {
    const result = practicePreparation({
      drills: [
        drill({
          metadata: metadata({
            equipment: ['ball', 'cones'],
            space: { lengthM: 6, widthM: 10 },
            participants: { min: 2, max: 4, roles: ['partner'] }
          })
        }),
        drill({
          metadata: metadata({
            equipment: ['Ball'],
            space: { lengthM: 8, widthM: 4 },
            participants: { min: 3, max: 6, roles: ['partner'] }
          })
        }),
        drill()
      ]
    })
    expect(result).toMatchObject({
      equipment: ['Ball', 'Cones'],
      space: { lengthM: 10, widthM: 6 },
      participants: { min: 3, max: 4, varies: false, roles: ['Partner'] },
      focus: ['Ball control'],
      missing: { equipment: true, space: true, participants: true }
    })
  })
  it('does not present incompatible player counts as one feasible group', () => {
    const result = practicePreparation({
      drills: [1, 2].map((n) => drill({ metadata: metadata({ participants: { min: n, max: n, roles: [] } }) }))
    })
    expect(result.participants.varies).toBe(true)
  })
  it('keeps video reference separate from athletic preparation', () => {
    const result = practicePreparation({ drills: [drill({ mode: 'watch', sets: 1, side: 'both' })] })
    expect(result).toMatchObject({ reviewOnly: true, workSeconds: 0, restSeconds: 0 })
  })
})
