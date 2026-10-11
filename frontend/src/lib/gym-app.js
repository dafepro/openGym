export const CLUB_ELITE = {
  label: 'Club Elite +',
  url: 'https://www.clubfitness.us/app/',
  android: 'https://play.google.com/store/apps/details?id=com.trainerize.clubfitness',
  ios: 'https://apps.apple.com/us/app/club-elite/id1604620814',
}
export function gymAppUrl(value) {
  try {
    const u = new URL(value)
    return u.protocol === 'https:' && !u.username && !u.password ? u.href : null
  } catch { return null }
}
export function gymAppDestination(card, agent = navigator.userAgent) {
  if (card.provider === 'club-elite') return /android/i.test(agent) ? CLUB_ELITE.android : /iphone|ipad|ipod/i.test(agent) ? CLUB_ELITE.ios : CLUB_ELITE.url
  return gymAppUrl(card.url)
}
