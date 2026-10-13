import { afterEach, describe, expect, it } from 'vitest'
import { brandCopy } from './brand.js'
import { _setLangState, t, tn } from './i18n-core.js'
import de from '../locales/de.js'
import { readFileSync } from 'node:fs'
import { contrast } from './accent.js'
import { ACCENTS, ACCENT_INK } from './format.js'

afterEach(() => _setLangState('en', {}, null, null))

describe('Uplift identity preserves user data and protocol compatibility', () => {
  it('brands English and inherited translations before interpolating user-owned names', () => {
    expect(t('Reload openGym')).toBe('Reload Uplift')
    expect(t('Made with openGym.')).toBe('Made with Uplift.')
    expect(t(undefined)).toBeUndefined()
    expect(t('this isn’t an openGym plan file')).toBe('this isn’t a Uplift plan file')
    expect(t('Hi {0}', 'openGym')).toBe('Hi openGym')
    expect(t('Powered by {0}', 'openGym')).toBe('Powered by openGym')
    _setLangState('de', de, null, null)
    expect(t('Reload openGym')).toContain('Uplift')
    expect(t('Powered by {0}', 'openGym')).toContain('openGym')
  })
  it('preserves directory names, namespace markers, URLs and interpolated backup paths', () => {
    const technical = 'Documents/openGym opengym-sync opengym_plan https://opengym.ch dafepro/openGym openGymFocus'
    expect(brandCopy(technical)).toBe(technical)
    expect(t('openGym can no longer write to “{0}”', '/backups/openGym')).toBe('Uplift can no longer write to “/backups/openGym”')
  })
  it('brands plural prose without rewriting supplied routine names', () => {
    _setLangState('ru', { '{0} openGym plans': { few: '{0} openGym: {1}', other: '{0} openGym: {1}' } }, null, null)
    expect(tn('{0} openGym plan', '{0} openGym plans', 2, 'openGym')).toBe('2 Uplift: openGym')
  })
})

describe('theme accessibility and install identity', () => {
  it('keeps all pastel preset button labels at text contrast', () => {
    for (const [key, fill] of Object.entries(ACCENTS)) expect(contrast(fill, ACCENT_INK[key]), key).toBeGreaterThanOrEqual(4.5)
  })
  it('keeps secondary labels and primary labels readable in both themes', () => {
    const css = readFileSync('src/uplift-theme.css', 'utf8')
    const tokens = selector => Object.fromEntries([...css.match(selector)[1].matchAll(/--([\w-]+):\s*(#[\da-f]+);/g)].map(m => [m[1], m[2]]))
    const dark = tokens(/:root \{([^}]+)\}/)
    const light = tokens(/:root\[data-theme="light"\] \{([^}]+)\}/)
    for (const theme of [dark, light]) {
      for (const key of ['bg', 'surface', 'surface-2']) expect(contrast(theme['label-2'], theme[key])).toBeGreaterThanOrEqual(4.5)
    }
    for (const key of ['green', 'blue', 'orange', 'purple', 'teal', 'red', 'pink', 'yellow']) expect(contrast('#ffffff', light[key]), key).toBeGreaterThanOrEqual(4.5)
  })
  it('installs as Uplift and preloads the same local font the theme uses', () => {
    const html = readFileSync('index.html', 'utf8')
    const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8'))
    expect(manifest.name).toBe('Uplift')
    expect(manifest.theme_color).toBe('#101214')
    expect(html).toContain('<title>Uplift</title>')
    expect(html).toContain('href="fonts/barlow-condensed-latin-600.woff2"')
    expect(readFileSync('public/fonts/barlow-condensed-latin-600.woff2').length).toBeGreaterThan(1000)
  })
})
