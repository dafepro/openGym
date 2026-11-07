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
  TWILIO_API_KEY_SID: `SK${'b'.repeat(32)}`,
  TWILIO_API_KEY_SECRET: 'synthetic-sms-key',
  TWILIO_MESSAGING_SERVICE_SID: `MG${'c'.repeat(32)}`,
  TWILIO_FROM: '+15557654321',
}
const inbound = (body, hour = 12) => ({
  body,
  from: sms.address,
  to: env.TWILIO_FROM,
  direction: 'inbound',
  status: 'received',
  date_created: `2026-11-06T${hour}:00:00Z`,
})
describe('notification adapters', () => {
  it('advertises only fully configured channels', () => {
    expect(
      notificationChannels({
        RESEND_API_KEY: 'alone',
        TWILIO_API_KEY_SECRET: 'alone',
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
  it('checks handset consent before using a restricted key to send', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ messages: [inbound('STOP', 11), inbound('START')] }),
      )
      .mockResolvedValueOnce(
        Response.json({ sid: 'SMsynthetic', status: 'queued' }),
      )
    expect(await sendReady(sms, job, env, fetcher)).toEqual({
      id: 'SMsynthetic',
      status: 'accepted',
    })
    const [lookup, checkOptions] = fetcher.mock.calls[0]
    expect(new URL(lookup).searchParams.get('From')).toBe(sms.address)
    expect(new URL(lookup).searchParams.get('To')).toBe(env.TWILIO_FROM)
    const [url, options] = fetcher.mock.calls[1]
    expect(url).toBe(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
    )
    expect(options.body.get('To')).toBe(sms.address)
    expect(options.body.get('MessagingServiceSid')).toBe(
      env.TWILIO_MESSAGING_SERVICE_SID,
    )
    expect(options.body.get('Body')).toBe(
      `QuickTrack: Your soccer practice is ready. Reply STOP to opt out. ${job.practiceUrl}`,
    )
    expect(checkOptions.headers.Authorization).toBe(
      options.headers.Authorization,
    )
    expect(atob(options.headers.Authorization.slice(6))).toBe(
      `${env.TWILIO_API_KEY_SID}:${env.TWILIO_API_KEY_SECRET}`,
    )
    for (const result of [{}, { sid: 'SMfailed', status: 'failed' }])
      await expect(
        sendReady(
          sms,
          job,
          env,
          vi
            .fn()
            .mockResolvedValueOnce(
              Response.json({ messages: [inbound('START')] }),
            )
            .mockResolvedValueOnce(Response.json(result)),
        ),
      ).rejects.toThrow(/not confirmed/)
  })
  it('withholds texts without a verified START or after a STOP', async () => {
    for (const messages of [
      [],
      [inbound('START'), inbound('STOP', 13)],
      [inbound('STOP'), inbound('START')],
      [{ ...inbound('START'), from: '+15551239999' }],
    ]) {
      const fetcher = vi.fn(async () => Response.json({ messages }))
      expect(await sendReady(sms, job, env, fetcher)).toEqual({
        status: 'opt_in_required',
      })
      expect(fetcher).toHaveBeenCalledTimes(1)
    }
    const fetcher = vi.fn()
    expect(
      await sendReady({ ...sms, address: '+447700900123' }, job, env, fetcher),
    ).toEqual({ status: 'unsupported_number' })
    expect(fetcher).not.toHaveBeenCalled()
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
