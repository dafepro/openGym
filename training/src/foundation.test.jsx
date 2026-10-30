import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from './App.jsx'
import { APP_CONFIG, TRAINING_DEMO } from './config.js'
import { routeFromHash } from './lib/routes.js'

describe('training foundation boundaries', () => {
  it('uses its own runtime identities and requires explicit demo opt-in', () => {
    expect(TRAINING_DEMO).toBe(false)
    expect(APP_CONFIG.storageDatabase).toBe('quicktrack-training')
    expect(APP_CONFIG.cachePrefix).toBe('quicktrack-training-')
    expect(APP_CONFIG.catalogPath).toBe('/api/catalog')
  })

  it('renders a loading shell without a password or invented assignment', () => {
    const html = renderToStaticMarkup(<App />)
    expect(html).toContain('Opening your practice…')
    expect(html).not.toContain('type="password"')
    expect(html).not.toContain('Sample assignment')
    expect(html).not.toContain('<video')
    expect(html).not.toContain('Practice complete')
  })

  it('routes only recognized local destinations and falls back to Today', () => {
    expect(routeFromHash('#/build')).toBe('build')
    expect(routeFromHash('#/shared/encoded-plan')).toBe('shared')
    expect(routeFromHash('#/history')).toBe('history')
    expect(routeFromHash('#/practice')).toBe('practice')
    expect(routeFromHash('#/today')).toBe('today')
    expect(routeFromHash('#/unrecognized')).toBe('today')
    expect(routeFromHash('https://example.com')).toBe('today')
  })
})
