import { expect, it } from 'vitest'
import { gymAppUrl, gymAppDestination, CLUB_ELITE } from './gym-app.js'
it('keeps dynamic gym codes external and refuses unsafe links', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'https://user:pass@example.com/', 'http://example.com/']) expect(gymAppUrl(url)).toBe(null)
  expect(gymAppDestination({ provider: 'club-elite' }, 'iPhone')).toBe(CLUB_ELITE.ios)
  expect(gymAppDestination({ provider: 'custom', url: 'https://gym.example/checkin' }, 'Android')).toBe('https://gym.example/checkin')
})
it('launches only the official Android package with an encoded official store fallback', () => {
  const link = gymAppDestination({ provider: 'club-elite', url: 'https://evil.example/' }, 'Mozilla/5.0 (Linux; Android 15)')
  expect(link).toBe(`intent://widget.dash.open#Intent;scheme=trainerize;package=com.trainerize.clubfitness;S.browser_fallback_url=${encodeURIComponent(CLUB_ELITE.android)};end`)
  expect(decodeURIComponent(link.match(/S.browser_fallback_url=([^;]+)/)[1])).toBe(CLUB_ELITE.android)
  expect(gymAppDestination({ provider: 'club-elite' }, 'Macintosh')).toBe(CLUB_ELITE.url)
  for (const url of [link, 'trainerize://widget.dash.open']) expect(gymAppDestination({ provider: 'custom', url }, 'Android')).toBe(null)
})
