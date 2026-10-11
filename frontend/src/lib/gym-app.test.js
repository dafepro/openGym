import { expect, it } from 'vitest'
import { gymAppUrl, gymAppDestination, CLUB_ELITE } from './gym-app.js'
it('keeps dynamic gym codes external and refuses unsafe links', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'https://user:pass@example.com/', 'http://example.com/']) expect(gymAppUrl(url)).toBe(null)
  expect(gymAppDestination({ provider: 'club-elite' }, 'Android')).toBe(CLUB_ELITE.android)
  expect(gymAppDestination({ provider: 'club-elite' }, 'iPhone')).toBe(CLUB_ELITE.ios)
  expect(gymAppDestination({ provider: 'custom', url: 'https://gym.example/checkin' }, 'Android')).toBe('https://gym.example/checkin')
})
