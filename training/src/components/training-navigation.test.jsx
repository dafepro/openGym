import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import TrainingShell from './TrainingShell.jsx'
const render = props => renderToStaticMarkup(<TrainingShell {...props}><p>Page content</p></TrainingShell>)
describe('compact header navigation', () => {
  it('puts Practice and a circular Me control above the page, with no bottom tabs', () => {
    const html=render({page:'today'})
    expect(html).toContain('aria-label="Practice"')
    expect(html).toContain('class="pb-profile-link"')
    expect(html).toContain('aria-label="Me"')
    expect(html.indexOf('</nav>')).toBeLessThan(html.indexOf('<main'))
    expect(html).not.toContain('qt-navigation--playbook')
  })
  it('keeps the header mounted but inert during active work', () => {
    const html=render({page:'practice',practice:true})
    expect(html).toContain('data-visible="false" aria-hidden="true" inert=""')
  })
  it('identifies the profile destination and offers a way home', () => {
    const html=render({page:'me'})
    expect(html).toContain('aria-label="Me" aria-current="page"')
    expect(html).toContain('aria-label="Practice"')
  })
})
