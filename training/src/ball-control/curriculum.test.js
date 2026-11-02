import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { BALL_CONTROL_DRILLS } from './curriculum.js'

const ids = ['bc-side-roll', 'bc-push-pull', 'bc-toe-taps', 'bc-inside-touches', 'bc-v-pull', 'bc-l-pull', 'bc-inside-outside', 'bc-stepover']
const manifest = JSON.parse(readFileSync(new URL('../../docs/ball-control/video-production-manifest.json', import.meta.url), 'utf8'))

describe('ball-control curriculum contract', () => {
  it('keeps eight stable drill IDs with complete original guidance', () => {
    expect(BALL_CONTROL_DRILLS.map(drill => drill.id)).toEqual(ids)
    for (const drill of BALL_CONTROL_DRILLS) {
      expect(Object.keys(drill).sort()).toEqual(['id', 'title', 'summary', 'setup', 'instructions', 'cues', 'commonMistakes', 'tracking', 'suggestedSeconds', 'videoId', 'promptId'].sort())
      expect(drill.title.trim().length).toBeGreaterThan(3)
      expect(drill.summary.trim().length).toBeGreaterThan(10)
      for (const field of ['setup', 'instructions', 'cues', 'commonMistakes']) {
        expect(drill[field].length).toBeGreaterThanOrEqual(2)
        expect(drill[field].every(item => typeof item === 'string' && item.trim().length > 10)).toBe(true)
      }
      expect(drill.suggestedSeconds).toBe(30)
      expect(drill.promptId).toBe(drill.id)
      expect(drill.videoId).toBe(`${drill.id}-front-v1`)
      expect(JSON.stringify(drill)).not.toMatch(/https?:\/\//)
    }
  })

  it('offers target arrivals only for the two supported roll paths', () => {
    expect(BALL_CONTROL_DRILLS.filter(drill => drill.tracking.kind === 'alternating-zones').map(drill => [drill.id, drill.tracking.axis, drill.tracking.metricLabel])).toEqual([
      ['bc-side-roll', 'horizontal', 'Target arrivals'],
      ['bc-push-pull', 'vertical', 'Target arrivals'],
    ])
    for (const drill of BALL_CONTROL_DRILLS.slice(2)) {
      expect(drill.tracking).toEqual({ kind: 'none', metricLabel: 'Manual repetitions' })
    }
  })

  it('maps every prospective app video to a pending production asset', () => {
    expect(manifest.assets).toHaveLength(16)
    expect(new Set(manifest.assets.map(asset => asset.mediaId)).size).toBe(16)
    for (const drill of BALL_CONTROL_DRILLS) {
      const shots = manifest.assets.filter(asset => asset.drillId === drill.id)
      expect(shots.map(asset => asset.angle)).toEqual(['front', 'oblique45'])
      expect(shots.find(asset => asset.angle === 'front').mediaId).toBe(drill.videoId)
      for (const shot of shots) {
        expect(shot.status).toBe('planned')
        expect(shot.approved).toBe(false)
        expect(shot.outputSha256).toBeNull()
        expect(shot.reviews.technique.status).toBe('pending')
        expect(shot.reviews.anatomyContact.status).toBe('pending')
      }
    }
  })
})
