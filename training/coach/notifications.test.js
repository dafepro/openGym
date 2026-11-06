import { describe, expect, it, vi } from 'vitest'
import { notificationChannels, sendReady } from './notifications.js'
const job = {
  id: 'request-one',
  owner: 'coach-one',
  plan: { title: 'Close control' },
  practiceUrl: 'https://train.quicktrack.cc/#/shared/QT3.example',
}
const email = { channel: 'email', address: 'parent@example.org', index: 0 },
  sms = { channel: 'sms', address: '+15551234567', index: 1 }
const env = {
  RESEND_API_KEY: 'synthetic-email-key',
  COACH_EMAIL_FROM: 'coach@example.org',
  TWILIO_ACCOUNT_SID: `AC${'a'.repeat(32)}`,
  TWILIO_AUTH_TOKEN: 'synthetic-sms-key',
  TWILIO_FROM: '+15557654321',
}
describe('notification adapters', () => {
  it('advertises only fully configured channels', () => {
    expect(
      notificationChannels({
        RESEND_API_KEY: 'alone',
        TWILIO_AUTH_TOKEN: 'alone',
      }),
    ).toEqual({ email: false, sms: false })
    expect(notificationChannels(env)).toEqual({ email: true, sms: true })
    expect(
      notificationChannels({ ...env, TWILIO_ACCOUNT_SID: 'wrong' }).sms,
    ).toBe(false)
    expect(
      notificationChannels({ ...env, TWILIO_FROM: '5551234567' }).sms,
    ).toBe(false)
  })
  it('uses a stable email idempotency key and sends only the published link', async () => {
    const fetcher = vi.fn(async () => Response.json({ id: 'receipt-one' }))
    expect(await sendReady(email, job, env, fetcher)).toEqual({
      id: 'receipt-one',
      status: 'accepted',
    })
    const [url, options] = fetcher.mock.calls[0],
      body = JSON.parse(options.body)
    expect(url).toBe('https://api.resend.com/emails')
    expect(options.headers['Idempotency-Key']).toBe(
      'practice-coach-one-request-one-0',
    )
    expect(body.to).toEqual([email.address])
    expect(body.text).toContain(job.practiceUrl)
    expect(body.text).not.toContain(env.RESEND_API_KEY)
  })
  it('encodes international SMS recipients correctly and requires a provider receipt', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ sid: 'SMsynthetic', status: 'queued' }),
    )
    expect(await sendReady(sms, job, env, fetcher)).toEqual({
      id: 'SMsynthetic',
      status: 'accepted',
    })
    const [url, options] = fetcher.mock.calls[0]
    expect(url).toBe(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
    )
    expect(options.body.get('To')).toBe(sms.address)
    expect(options.body.get('Body')).toContain(job.practiceUrl)
    for (const result of [{}, { sid: 'SMfailed', status: 'failed' }])
      await expect(
        sendReady(sms, job, env, async () => Response.json(result)),
      ).rejects.toThrow(/not confirmed/)
  })
  it('refuses oversized SMS content before any provider request', async () => {
    const fetcher = vi.fn()
    await expect(
      sendReady(
        sms,
        { ...job, practiceUrl: job.practiceUrl + 'x'.repeat(1600) },
        env,
        fetcher,
      ),
    ).rejects.toThrow(/compact/)
    expect(fetcher).not.toHaveBeenCalled()
  })
})
