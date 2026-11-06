export function notificationChannels(env) {
  return {
    email: !!(env.RESEND_API_KEY && env.COACH_EMAIL_FROM),
    sms: !!(
      /^AC[a-fA-F0-9]{32}$/.test(env.TWILIO_ACCOUNT_SID || '') &&
      env.TWILIO_AUTH_TOKEN &&
      /^\+[1-9]\d{7,14}$/.test(env.TWILIO_FROM || '')
    ),
  }
}
export const readyMessage = (job) =>
  `Your soccer practice is ready: ${job.publishedTitle || job.plan.title}. ${job.practiceUrl}`
export async function sendReady(recipient, job, env, fetcher = fetch) {
  const message = readyMessage(job)
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
        text: message,
      }),
      signal: AbortSignal.timeout(15000),
    })
  } else {
    if (message.length > 1600)
      throw new Error('Use a compact practice pass for text notifications')
    if (!/^AC[a-fA-F0-9]{32}$/.test(env.TWILIO_ACCOUNT_SID || ''))
      throw new Error('SMS configuration is invalid')
    response = await fetcher(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: recipient.address,
          From: env.TWILIO_FROM,
          Body: message,
        }),
        signal: AbortSignal.timeout(15000),
      },
    )
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
