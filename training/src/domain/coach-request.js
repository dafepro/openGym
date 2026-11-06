export const COACH_BRIEF_LIMIT = 1000
export function parseRecipients(value = '') {
  if (typeof value !== 'string' || value.length > 3000)
    throw new Error('Enter at most 20 email addresses or phone numbers.')
  const entries = [
    ...new Set(
      value
        .split(/[,;\n]+/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ]
  if (entries.length > 20) throw new Error('Use at most 20 recipients.')
  return entries
    .map((value) => {
      if (/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value) && value.length <= 254)
        return { channel: 'email', address: value.toLowerCase() }
      const phone = value.replace(/[\s().-]/g, '')
      if (/^\+[1-9]\d{7,14}$/.test(phone))
        return { channel: 'sms', address: phone }
      throw new Error(
        `Check “${value.slice(0, 60)}”. Phone numbers need a country code, such as +1.`,
      )
    })
    .filter(
      (item, index, array) =>
        array.findIndex(
          (other) =>
            other.channel === item.channel && other.address === item.address,
        ) === index,
    )
}
export function validateCoachRequest(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Object.keys(value).some(
      (key) => !['id', 'brief', 'recipients', 'consent'].includes(key),
    )
  )
    throw new Error('Invalid coaching request.')
  if (!/^[a-f0-9-]{36}$/.test(value.id || ''))
    throw new Error('A request identifier is required.')
  if (
    typeof value.brief !== 'string' ||
    value.brief.trim().length < 20 ||
    value.brief.length > COACH_BRIEF_LIMIT ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value.brief)
  )
    throw new Error('Describe the practice in 20–1,000 characters.')
  const recipients = parseRecipients(value.recipients)
  if (recipients.length && value.consent !== true)
    throw new Error(
      'Confirm these players or guardians expect the notification.',
    )
  return {
    id: value.id,
    brief: value.brief.trim(),
    recipients,
    consent: recipients.length > 0,
  }
}
