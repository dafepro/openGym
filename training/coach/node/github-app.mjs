import { createPrivateKey, sign } from 'node:crypto'
export function installationTokenProvider(
  env,
  fetcher = fetch,
  now = Date.now,
) {
  const app = env.COACH_GITHUB_APP_ID,
    installation = env.COACH_GITHUB_INSTALLATION_ID
  if (!/^\d+$/.test(app || '') || !/^\d+$/.test(installation || ''))
    throw new Error('Invalid coach GitHub App identity')
  const key = createPrivateKey(
    Buffer.from(env.COACH_GITHUB_APP_PRIVATE_KEY_B64 || '', 'base64'),
  )
  let cached, pending
  return async () => {
    if (cached && cached.expires > now() + 120000) return cached.token
    if (pending) return pending
    pending = (async () => {
      const stamp = Math.floor(now() / 1000)
      const encoded = (value) =>
        Buffer.from(JSON.stringify(value)).toString('base64url')
      const data = `${encoded({ alg: 'RS256', typ: 'JWT' })}.${encoded({ iat: stamp - 60, exp: stamp + 540, iss: app })}`
      const jwt = `${data}.${sign('RSA-SHA256', Buffer.from(data), key).toString('base64url')}`
      const response = await fetcher(
        `https://api.github.com/app/installations/${installation}/access_tokens`,
        {
          method: 'POST',
          redirect: 'error',
          headers: {
            Authorization: `Bearer ${jwt}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'QuickTrack-Coach',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            repositories: ['openGym'],
            permissions: {
              contents: 'write',
              pull_requests: 'write',
              issues: 'write',
              checks: 'read',
              statuses: 'read',
              ...(env.COACH_GITHUB_ACTIONS_ENABLED === 'true'
                ? { actions: 'write' }
                : {}),
            },
          }),
          signal: AbortSignal.timeout(15000),
        },
      )
      if (!response.ok)
        throw new Error('Coach GitHub App authentication failed')
      const result = await response.json()
      if (!result.token || !Number.isFinite(Date.parse(result.expires_at)))
        throw new Error('Invalid installation token')
      cached = { token: result.token, expires: Date.parse(result.expires_at) }
      return cached.token
    })()
    try {
      return await pending
    } finally {
      pending = null
    }
  }
}
