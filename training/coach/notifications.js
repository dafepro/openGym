export const textSender = (env) =>
  /^\+1\d{10}$/.test(env.TWILIO_FROM || '') ? env.TWILIO_FROM : undefined

export function notificationChannels(env) {
  return {
    email: !!(env.RESEND_API_KEY && env.COACH_EMAIL_FROM),
    sms: !!(
      /^AC[a-fA-F0-9]{32}$/.test(env.TWILIO_ACCOUNT_SID || '') &&
      /^SK[a-fA-F0-9]{32}$/.test(env.TWILIO_API_KEY_SID || '') &&
      env.TWILIO_API_KEY_SECRET &&
      /^MG[a-fA-F0-9]{32}$/.test(env.TWILIO_MESSAGING_SERVICE_SID || '') &&
      textSender(env)
    ),
  }
}
export const smsReadyMessage = (job) =>
  `QuickTrack: Your soccer practice is ready. Reply STOP to opt out. ${job.practiceUrl}`

const optOutKeywords = new Set([
  'STOP',
  'STOPALL',
  'UNSUBSCRIBE',
  'CANCEL',
  'END',
  'QUIT',
  'REVOKE',
  'OPTOUT',
])

async function hasTextConsent(
  address,
  sender,
  endpoint,
  authorization,
  fetcher,
) {
  const query = new URLSearchParams({
    From: address,
    To: sender,
    PageSize: '50',
  })
  const response = await fetcher(`${endpoint}?${query}`, {
    headers: { Authorization: authorization },
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error('Could not verify text opt-in')
  const { messages, next_page_uri: more } = await response.json()
  if (!Array.isArray(messages)) throw new Error('Could not verify text opt-in')
  if (more) return false

  // Use only received commands from this handset to this dedicated number.
  // If there is no recent proof or the event order is ambiguous, withhold the text.
  let latest = 0
  let optedIn = false
  for (const message of messages) {
    if (
      message.direction !== 'inbound' ||
      message.status !== 'received' ||
      message.from !== address ||
      message.to !== sender
    )
      continue
    const keyword = message.body?.trim().toUpperCase()
    if (keyword !== 'START' && !optOutKeywords.has(keyword)) continue
    const date = Date.parse(message.date_sent || message.date_created)
    if (!Number.isFinite(date)) return false
    if (date > latest) {
      latest = date
      optedIn = keyword === 'START'
    } else if (date === latest && optOutKeywords.has(keyword)) {
      optedIn = false
    }
  }
  return optedIn
}

export async function sendReady(recipient, job, env, fetcher = fetch) {
  let response
  if (recipient.channel === 'email') {
    response = await fetcher('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `practice-${job.owner}-${job.id}-${recipient.index}`,
      },
      body: JSON.stringify({
        from: env.COACH_EMAIL_FROM,
        to: [recipient.address],
        subject: 'Your soccer practice is ready',
        text: `Your soccer practice is ready: ${job.publishedTitle || job.plan.title}. ${job.practiceUrl}`,
      }),
      signal: AbortSignal.timeout(15000),
    })
  } else {
    const message = smsReadyMessage(job)
    if (message.length > 1600)
      throw new Error('Use a compact practice pass for text notifications')
    if (!notificationChannels(env).sms)
      throw new Error('SMS configuration is invalid')
    if (!/^\+1\d{10}$/.test(recipient.address))
      return { status: 'unsupported_number' }
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`
    const authorization = `Basic ${btoa(`${env.TWILIO_API_KEY_SID}:${env.TWILIO_API_KEY_SECRET}`)}`
    if (
      !(await hasTextConsent(
        recipient.address,
        env.TWILIO_FROM,
        endpoint,
        authorization,
        fetcher,
      ))
    )
      return { status: 'opt_in_required' }
    response = await fetcher(endpoint, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: recipient.address,
        From: env.TWILIO_FROM,
        MessagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID,
        Body: message,
      }),
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    })
  }
  if (!response.ok)
    throw new Error('Notification provider did not accept the message')
  const result = await response.json()
  const id = result.id || result.sid
  if (
    typeof id !== 'string' ||
    !id ||
    id.length > 200 ||
    ['failed', 'undelivered', 'canceled'].includes(result.status)
  )
    throw new Error('Notification acceptance was not confirmed')
  return { id, status: 'accepted' }
}
