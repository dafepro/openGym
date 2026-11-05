import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import TrainingShell from './TrainingShell.jsx'

const render = props => renderToStaticMarkup(<TrainingShell builder {...props}><p>Page content</p></TrainingShell>)
const landmark = html => html.match(/<nav\b[\s\S]*?<\/nav>/)?.[0]

describe('persistent main navigation', () => {
  it('keeps the same two destinations in the document across browsing and workout routes', () => {
    for (const page of ['today', 'build', 'organizer', 'me', 'practice']) {
      const html = render({ page, practice: page === 'practice' })
      const nav = landmark(html)
      expect(nav).toBeDefined()
      expect(nav.match(/<button\b/g)).toHaveLength(2)
      expect(nav).not.toContain('<span>Today</span>')
      expect(nav).toContain('<span>Practice</span>')
      expect(nav).toContain('<span>Me</span>')
      // Page snapshots contain only main. The fixed landmark must be a sibling.
      expect(html.indexOf('</main>')).toBeLessThan(html.indexOf('<nav'))
    }
  })
  it('immediately removes the departing bar from keyboard and accessibility navigation while allowing its exit animation', () => {
    const nav = landmark(render({ page: 'practice', practice: true }))
    expect(nav).toContain('data-visible="false"')
    expect(nav).toContain('aria-hidden="true"')
    expect(nav).toContain('inert=""')
    // Neither hidden nor display:none: the bar must remain renderable on exit.
    expect(nav).not.toContain(' hidden=')
    expect(nav).not.toContain('display:')
  })
  it('keeps visible routes interactive and identifies exactly one destination', () => {
    for (const page of ['today', 'build', 'organizer', 'me', 'shared']) {
      const nav = landmark(render({ page }))
      expect(nav).toContain('data-visible="true"')
      expect(nav).not.toContain('aria-hidden="true" inert=')
      expect(nav).not.toContain('inert=')
      expect(nav.match(/aria-current="page"/g)).toHaveLength(1)
    }
  })
  it('groups saved sessions and organizer under Practice, keeping history within Me', () => {
    for (const page of ['today', 'build', 'organizer', 'shared']) {
      const nav = landmark(render({ page }))
      expect(nav).toMatch(/aria-current="page"[^>]*>[\s\S]*?<span>Practice<\/span>/)
    }
    expect(landmark(render({ page: 'history' }))).toMatch(/aria-current="page"[^>]*>[\s\S]*?<span>Me<\/span>/)
  })
  it('offers the organizer as a compact optional header action outside active work', () => {
    expect(render({ onOrganize: () => {} })).toContain('class="qt-organizer-link"')
    expect(render({ practice: true, onOrganize: () => {} })).not.toContain('class="qt-organizer-link"')
  })
})
