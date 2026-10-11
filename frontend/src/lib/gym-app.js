export const CLUB_ELITE = {
  label: 'Club Elite +',
  url: 'https://www.clubfitness.us/app/',
  android: 'https://play.google.com/store/apps/details?id=com.trainerize.clubfitness',
  ios: 'https://apps.apple.com/us/app/club-elite/id1604620814',
}
// Verified against Club Elite 8.18.4's BROWSABLE handler and a real Chrome tap.
// Scope Trainerize's shared scheme to this app; missing installs go to its official store.
const clubEliteIntent = `intent://widget.dash.open#Intent;scheme=trainerize;package=com.trainerize.clubfitness;S.browser_fallback_url=${encodeURIComponent(CLUB_ELITE.android)};end`
export function gymAppUrl(value) {
  try {
    const u = new URL(value)
    return u.protocol === 'https:' && !u.username && !u.password ? u.href : null
  } catch { return null }
}
export function gymAppDestination(card, agent = navigator.userAgent) {
  if (card.provider === 'club-elite') return /android/i.test(agent) ? clubEliteIntent : /iphone|ipad|ipod/i.test(agent) ? CLUB_ELITE.ios : CLUB_ELITE.url
  return gymAppUrl(card.url)
}
