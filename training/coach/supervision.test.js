import { it, expect } from 'vitest'
import { inspectWorkflow, inspectPublication } from './github.js'
import { response } from './agent.js'
const sha = 'a'.repeat(40),
  job = {
    id: '12345678-1234-4234-8234-123456789abc',
    mergeSha: sha,
    prNumber: 39,
    prUrl: 'https://github.com/dafepro/openGym/pull/39',
  }
const run = {
  id: 77,
  head_sha: sha,
  path: '.github/workflows/training-checks.yml',
  head_repository: { full_name: 'dafepro/openGym' },
  event: 'pull_request',
  status: 'completed',
  conclusion: 'failure',
  run_attempt: 1,
  html_url: 'https://github.com/dafepro/openGym/actions/runs/77',
}
const env = (fetcher) => ({
  COACH_GITHUB_REPOSITORY: 'dafepro/openGym',
  COACH_GITHUB_TOKEN: 'synthetic',
  COACH_GITHUB_ACTIONS_ENABLED: 'true',
  TEST_FETCH: fetcher,
})
it('retries one exact workflow revision and rejects unrelated runs', async () => {
  const environment = env(async () => Response.json({ workflow_runs: [run] }))
  expect(
    (await inspectWorkflow(job, environment, sha, 'training-checks.yml'))
      .retryCI,
  ).toBe(77)
  expect(
    (
      await inspectWorkflow(
        { ...job, ciRetriedRunIds: [77] },
        environment,
        sha,
        'training-checks.yml',
      )
    ).retryCI,
  ).toBeUndefined()
  for (const change of [
    { head_sha: 'b'.repeat(40) },
    { event: 'push' },
    { path: '.github/workflows/evil.yml' },
    { head_repository: { full_name: 'fork/openGym' } },
    { run_attempt: 2 },
  ]) {
    const r = await inspectWorkflow(
      job,
      env(async () =>
        Response.json({ workflow_runs: [{ ...run, ...change }] }),
      ),
      sha,
      'training-checks.yml',
    )
    expect(r.retryCI).toBeUndefined()
  }
})
it('trusts only publisher deployment receipts for this request and merge', async () => {
  const receipt = {
    schema: 1,
    requestId: job.id,
    sourceSha: sha,
    stage: 'retrying_deploy',
    message: 'Retrying deployment.',
    url: 'https://github.com/dafepro/deploy/actions/runs/55',
  }
  const comment = {
    user: { login: 'quicktrack-coach-publisher[bot]' },
    body:
      '<!-- quicktrack-deployment:v1 -->\n```json\n' +
      JSON.stringify(receipt) +
      '\n```',
  }
  const environment = env(async (url) =>
    Response.json(
      url.includes('/comments') ? [comment] : { workflow_runs: [] },
    ),
  )
  expect((await inspectPublication(job, environment)).progress.stage).toBe(
    'retrying_deploy',
  )
  comment.user.login = 'someone'
  expect((await inspectPublication(job, environment)).progress.stage).toBe(
    'waiting_build',
  )
})
it('classifies unfinished research without exposing provider details', async () => {
  await expect(
    response(
      { OPENAI_MODEL: 'synthetic', OPENAI_API_KEY: 'synthetic' },
      { text: { format: { name: 'research' } } },
      async () =>
        Response.json({
          status: 'incomplete',
          incomplete_details: { reason: 'max_output_tokens' },
        }),
    ),
  ).rejects.toMatchObject({ code: 'output_limit' })
})
