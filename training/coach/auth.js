let certificates
const decode = (text) =>
  Uint8Array.from(
    atob(text.replaceAll('-', '+').replaceAll('_', '/')),
    (char) => char.charCodeAt(0),
  )
const claims = (text) => JSON.parse(new TextDecoder().decode(decode(text)))
// Verify the signed assertion, not the easily forged authenticated-email header.
export async function coachProfile(
  request,
  env,
  fetcher = fetch,
  now = Date.now(),
) {
  if (
    !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(
      env.COACH_ACCESS_ISSUER || '',
    ) ||
    !env.COACH_ACCESS_AUD
  )
    throw new Error('Coach sign-in is not configured.')
  const token = request.headers.get('Cf-Access-Jwt-Assertion') || ''
  if (token.length > 12000 || token.split('.').length !== 3) return null
  try {
    const [head, body, signature] = token.split('.'),
      header = claims(head),
      payload = claims(body)
    if (
      header.alg !== 'RS256' ||
      payload.iss !== env.COACH_ACCESS_ISSUER ||
      !Array.isArray(payload.aud) ||
      !payload.aud.includes(env.COACH_ACCESS_AUD) ||
      typeof payload.sub !== 'string' ||
      !payload.sub ||
      !Number.isFinite(payload.exp) ||
      payload.exp * 1000 <= now ||
      (payload.nbf && payload.nbf * 1000 > now)
    )
      return null
    if (
      !certificates ||
      certificates.issuer !== env.COACH_ACCESS_ISSUER ||
      certificates.expires <= now
    ) {
      const response = await fetcher(
        `${env.COACH_ACCESS_ISSUER}/cdn-cgi/access/certs`,
        { signal: AbortSignal.timeout(10000) },
      )
      if (!response.ok) return null
      const { keys } = await response.json()
      if (!Array.isArray(keys) || keys.length > 20) return null
      certificates = {
        issuer: env.COACH_ACCESS_ISSUER,
        keys,
        expires: now + 300000,
      }
    }
    const { keys } = certificates
    const jwk = keys?.find((key) => key.kid === header.kid && key.kty === 'RSA')
    if (!jwk) return null
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    if (
      !(await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        key,
        decode(signature),
        new TextEncoder().encode(`${head}.${body}`),
      ))
    )
      return null
    // The VM also enforces its own allowlist, independent of edge policy edits.
    if (
      env.COACH_ALLOWED_EMAILS &&
      !env.COACH_ALLOWED_EMAILS.split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
        .includes(String(payload.email || '').toLowerCase())
    )
      return null
    return {
      identity: `${payload.iss}|${payload.sub}`,
      email: String(payload.email || '').toLowerCase(),
    }
  } catch {
    return null
  }
}
export async function coachIdentity(
  request,
  env,
  fetcher = fetch,
  now = Date.now(),
) {
  return (await coachProfile(request, env, fetcher, now))?.identity || null
}
export async function verifyReadySignature(
  request,
  body,
  env,
  now = Date.now(),
) {
  const timestamp = request.headers.get('X-QuickTrack-Timestamp') || ''
  const signature = request.headers.get('X-QuickTrack-Signature') || ''
  if (
    !env.COACH_READY_SECRET ||
    !/^\d{13}$/.test(timestamp) ||
    Math.abs(now - Number(timestamp)) > 300000 ||
    !/^[a-f0-9]{64}$/.test(signature)
  )
    return false
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.COACH_READY_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  return crypto.subtle.verify(
    'HMAC',
    key,
    Uint8Array.from(signature.match(/../g), (value) => parseInt(value, 16)),
    new TextEncoder().encode(
      `${timestamp}.${new URL(request.url).pathname}.${body}`,
    ),
  )
}
