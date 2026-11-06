// Called by the reviewed content-publication pipeline after the practice is live.
// Secrets come from the environment; contacts never appear in arguments or logs.
import { createHmac } from 'node:crypto'
import { readFile } from 'node:fs/promises'
const [reference, file] = process.argv.slice(2)
if (!/^[a-f0-9]{64}\.[a-f0-9-]{36}$/.test(reference || '') || !file)
  throw new Error(
    'Usage: node publish-ready.mjs owner.request-id publication.json',
  )
const secret = process.env.COACH_READY_SECRET
if (!secret || secret.length < 32)
  throw new Error('COACH_READY_SECRET must be configured securely.')
const input = JSON.parse(await readFile(file, 'utf8'))
if (
  Object.keys(input).some((key) => !['practiceUrl', 'sourceSha'].includes(key))
)
  throw new Error('Publication needs practiceUrl and sourceSha only.')
const origin = 'https://train.quicktrack.cc'
const url = new URL(input.practiceUrl)
if (
  url.origin !== origin ||
  url.pathname !== '/' ||
  url.search ||
  !url.hash.startsWith('#/shared/') ||
  !/^[a-f0-9]{40}$/.test(input.sourceSha || '')
)
  throw new Error('Use the published practice pass URL and source SHA.')
const path = `/api/coach/ready/${reference.replace('.', '/')}`
const timestamp = String(Date.now()),
  body = JSON.stringify(input)
const signature = createHmac('sha256', secret)
  .update(`${timestamp}.${path}.${body}`)
  .digest('hex')
const response = await fetch(origin + path, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-QuickTrack-Timestamp': timestamp,
    'X-QuickTrack-Signature': signature,
  },
  body,
  signal: AbortSignal.timeout(30000),
})
if (!response.ok)
  throw new Error(
    `Publication confirmation failed (${response.status}); check the coach request. No retry was attempted.`,
  )
const result = await response.json()
console.log(JSON.stringify({ request: reference, status: result.status }))
