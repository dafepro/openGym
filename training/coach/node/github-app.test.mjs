import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, verify } from 'node:crypto'
import { installationTokenProvider } from './github-app.mjs'
test('publisher mints a repository-scoped short-lived token, coalesces requests and renews before expiry', async () => {
  const pair = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const env = {
    COACH_GITHUB_APP_ID: '123',
    COACH_GITHUB_INSTALLATION_ID: '456',
    COACH_GITHUB_APP_PRIVATE_KEY_B64: Buffer.from(
      pair.privateKey.export({ type: 'pkcs8', format: 'pem' }),
    ).toString('base64'),
  }
  let now = Date.now(),
    calls = 0
  const provider = installationTokenProvider(
    env,
    async (url, options) => {
      calls++
      assert.equal(
        url,
        'https://api.github.com/app/installations/456/access_tokens',
      )
      assert.equal(options.redirect, 'error')
      const [header, payload, signature] =
        options.headers.Authorization.slice(7).split('.')
      assert.equal(
        verify(
          'RSA-SHA256',
          Buffer.from(`${header}.${payload}`),
          pair.publicKey,
          Buffer.from(signature, 'base64url'),
        ),
        true,
      )
      const claims = JSON.parse(Buffer.from(payload, 'base64url'))
      assert.equal(claims.iss, '123')
      assert.equal(claims.exp - claims.iat, 600)
      const scope = JSON.parse(options.body)
      assert.deepEqual(scope.repositories, ['openGym'])
      assert.deepEqual(scope.permissions, {
        contents: 'write',
        pull_requests: 'write',
        issues: 'write',
        checks: 'read',
        statuses: 'read',
      })
      return Response.json({
        token: `synthetic-${calls}`,
        expires_at: new Date(now + 3600000).toISOString(),
      })
    },
    () => now,
  )
  assert.deepEqual(await Promise.all([provider(), provider(), provider()]), [
    'synthetic-1',
    'synthetic-1',
    'synthetic-1',
  ])
  assert.equal(calls, 1)
  now += 3500000
  assert.equal(await provider(), 'synthetic-2')
  assert.equal(calls, 2)
})
