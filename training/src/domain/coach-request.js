export const COACH_BRIEF_LIMIT = 1000
export function normalizeRecipient(value) {
  const item = typeof value === 'string' ? { address: value } : value
  if (
    !item ||
    typeof item !== 'object' ||
    Array.isArray(item) ||
    Object.keys(item).some(
      (key) => !['name', 'channel', 'address'].includes(key),
    )
  )
    throw new Error('Check the recipient details.')
  if (item.name != null && typeof item.name !== 'string')
    throw new Error('Use a short name for this recipient.')
  const name = item.name?.trim() || ''
  if (
    typeof item.address !== 'string' ||
    item.address.length > 254 ||
    typeof name !== 'string' ||
    name.length > 60 ||
    /[\u0000-\u001f\u007f]/.test(name)
  )
    throw new Error('Use a short name and a valid contact.')
  const valueText = item.address.trim()
  let channel, address
  if (/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(valueText)) {
    channel = 'email'
    address = valueText.toLowerCase()
  } else if (/^[+\d\s().-]+$/.test(valueText)) {
    let phone = valueText.replace(/[\s().-]/g, '')
      if (/^\d{10}$/.test(phone)) phone = '+1' + phone
    else if (/^1\d{10}$/.test(phone)) phone = '+' + phone
    if (
      !/^\+[1-9]\d{7,14}$/.test(phone) ||
      (phone.startsWith('+1') && phone.length !== 12)
    )
      throw new Error(
        'Use a 10-digit US/Canada number, or start with + and the country code.',
      )
    channel = 'sms'
    address = phone
  } else
    throw new Error(
      'Enter an email address or a phone number, such as (202) 555-0146.',
    )
  if (item.channel && item.channel !== channel)
    throw new Error(
      item.channel === 'email'
        ? 'Enter an email address, or choose Text.'
        : 'Enter a phone number, or choose Email.',
    )
  return { channel, address, ...(name ? { name } : {}) }
}
export function parseRecipients(value = []) {
  if (typeof value === 'string') {
    if (value.length > 6000) throw new Error('Use at most 20 recipients.')
    value = value
      .split(/[,;\n]+/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
  if (!Array.isArray(value) || value.length > 100)
    throw new Error('Use at most 20 recipients.')
  const result = []
  for (const entry of value) {
    const item = normalizeRecipient(entry)
    if (
      !result.some(
          (other) =>
            other.channel === item.channel && other.address === item.address,
        )
    )
      result.push(item)
  }
  if (result.length > 20) throw new Error('Use at most 20 recipients.')
  return result
}
export function collectRecipients(recipients, draft) {
  return parseRecipients([
    ...recipients,
    ...(draft?.address?.trim() || draft?.name?.trim() ? [draft] : []),
  ])
}
export function displayContact(item) {
  return item.channel === 'sms' && /^\+1\d{10}$/.test(item.address)
    ? item.address.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '+1 ($1) $2-$3')
    : item.address
}
export function validateCoachRequest(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
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
  // Accept the obsolete consent field from an older open tab, but never require it.
  return {
    id: value.id,
    brief: value.brief.trim(),
    recipients: parseRecipients(value.recipients),
  }
}
