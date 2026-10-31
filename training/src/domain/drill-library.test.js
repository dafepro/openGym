import { describe, it, expect } from 'vitest'
import { hasDemonstration, orderDrillsByVideo } from './drill-library.js'
const entry = (id, media) => ({ candidateId: id, drill: { media } })
const written = entry('written', { status: 'unavailable' })
const video = entry('video', { status: 'approved', path: '/media/clip' })
const external = entry('external', { status: 'approved', path: 'https://example.com/clip' })
describe('video library ordering', () => {
  it('puts playable video drills first without changing recommendation order within groups', () => {
    const source = [written, video, external]
    expect(orderDrillsByVideo(source)).toEqual([video, written, external])
    expect(source).toEqual([written, video, external])
  })
  it('filters only playable approved demonstrations and can restore all drills', () => {
    expect(orderDrillsByVideo([written, video, external], 'only')).toEqual([video])
    expect(orderDrillsByVideo([written, video], 'all')).toEqual([written, video])
    expect(hasDemonstration(external.drill)).toBe(false)
  })
})
