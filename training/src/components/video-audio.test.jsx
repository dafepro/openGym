import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import DrillDemonstration from './DrillDemonstration.jsx'

describe('help video audio defaults', () => {
  it('starts muted and offers audio independently of the rightmost play control', () => {
    const html = renderToStaticMarkup(<DrillDemonstration title="Demo" autoPlay media={{id:'clip',status:'approved',path:'/media/clip'}} />)
    expect(html).toContain('muted=""')
    expect(html).toContain('aria-label="Unmute video" aria-pressed="true"')
    expect(html.indexOf('qt-mute-toggle')).toBeLessThan(html.indexOf('qt-playback-toggle'))
    expect(html).toContain('aria-label="Play video"')
  })
})
