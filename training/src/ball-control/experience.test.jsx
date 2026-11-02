import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import BallControlExperience from './BallControlExperience.jsx'
import { resolveDemonstration } from './media.js'
describe('ball-control initial interface', () => {
  it('offers eight drills without camera permission or invented media', () => {
    const html = renderToStaticMarkup(<BallControlExperience />)
    expect(html.match(/class="bc-drill-option"/g)).toHaveLength(8); expect(html).toContain('Start 30-second round'); expect(html).toContain('Enable camera'); expect(html).toContain('Demonstration coming later'); expect(html).not.toContain('<video'); expect(html).not.toContain('<main'); expect(html).not.toContain('<nav'); expect(html).toContain('Frames stay on this device')
  })
  it('blocks new rounds for assigned practice and supports read-only browsing', () => {
    const html = renderToStaticMarkup(<BallControlExperience practiceActive disabled />)
    expect(html).toContain('Resume assigned practice'); expect(html).toContain('Read-only view'); expect(html).toMatch(/disabled=""><span>Start 30-second round/); expect(html).toMatch(/disabled=""><span>Enable camera/)
  })
  it('does not mount a camera off-route', () => { expect(renderToStaticMarkup(<BallControlExperience routeActive={false} />)).not.toContain('Enable camera') })
})
describe('approved catalog demonstrations', () => {
  const catalog = media => ({ assignments: [{ drills: media.map(item => ({ media: item })) }] })
  it('resolves exact first-party approved identities only', () => {
    expect(resolveDemonstration(catalog([{ id: 'demo', status: 'approved', path: '/media/demo' }]), 'demo').status).toBe('approved')
    for (const media of [{ id: 'demo', status: 'approved', path: 'https://example.com/demo' }, { id: 'demo', status: 'unavailable', path: '/media/demo' }]) expect(resolveDemonstration(catalog([media]), 'demo').status).toBe('unavailable')
    expect(resolveDemonstration(null, 'demo').status).toBe('unavailable')
  })
  it('preserves revocation over a stale approved duplicate', () => { expect(resolveDemonstration(catalog([{ id: 'demo', status: 'approved', path: '/media/demo' }, { id: 'demo', status: 'revoked' }]), 'demo').status).toBe('revoked') })
})
