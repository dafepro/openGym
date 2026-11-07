import { issueStillApproved } from './approved-issues.js'
import { readLimited } from '../worker/http.js'
import {
  appendPractice,
  assertAppendOnly,
  validateAdditions,
} from '../src/domain/public-practices.js'
import {
  compilePractice,
  practicePRBody,
  similarPractices,
} from './compiler.js'
export const REPOSITORY = 'dafepro/openGym'
export const RELEASE_BRANCH = 'codex/quicktrack-training-release'
export const PRACTICE_PATH = 'training/public/practice-additions.json'
export const REVIEWER_ID = 313492551
export const REQUIRED_CHECKS = [
  'Verify isolated training app',
  'Playbook browser journeys (linux-chromium)',
  'Playbook browser journeys (macos-webkit)',
]
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
export async function github(env, path, method = 'GET', data) {
  if (
    env.COACH_GITHUB_REPOSITORY !== REPOSITORY ||
    !path.startsWith('/') ||
    path.includes('..') ||
    path.includes('://')
  )
    throw new Error('Invalid GitHub destination')
  const token = env.COACH_GITHUB_ACCESS_TOKEN
    ? await env.COACH_GITHUB_ACCESS_TOKEN()
    : env.COACH_GITHUB_TOKEN
  const response = await (env.TEST_FETCH || fetch)(
    `https://api.github.com/repos/${REPOSITORY}${path}`,
    {
      method,
      redirect: 'error',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'QuickTrack-Coach',
        'Content-Type': 'application/json',
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
      signal: AbortSignal.timeout(20000),
    },
  )
  if (!response.ok)
    throw Object.assign(
      new Error('GitHub could not complete this operation.'),
      { status: response.status },
    )
  if (response.status === 204) return null
  return JSON.parse(
    new TextDecoder().decode(await readLimited(response.body, 2000000)),
  )
}
async function optional(env, path) {
  try {
    return await github(env, path)
  } catch (error) {
    if (error.status === 404) return null
    throw error
  }
}
export async function repositoryPractices(env, ref) {
  const file = await github(
    env,
    `/contents/${PRACTICE_PATH}?ref=${encodeURIComponent(ref)}`,
  )
  if (file.encoding !== 'base64' || file.size > 750000)
    throw new Error('Invalid public practice file')
  return validateAdditions(
    JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(file.content.replace(/\s/g, '')), (c) =>
          c.charCodeAt(0),
        ),
      ),
    ),
  )
}
async function labels(env, number) {
  // A missing label is harmless to the data write, but never grants approval.
  try {
    await github(env, '/labels', 'POST', {
      name: 'coach:practice',
      color: '526447',
      description:
        'Validated soccer practice data; use the stored coach publishing workflow.',
    })
  } catch (error) {
    if (error.status !== 422) throw error
  }
  await github(env, `/issues/${number}/labels`, 'POST', {
    labels: ['coach:practice'],
  })
}
export async function writePracticePR(job, env) {
  const branch = `coach-practice-${job.id}`,
    entry = compilePractice(job)
  const base = await github(env, `/git/ref/heads/${RELEASE_BRANCH}`)
  const baseSha = base.object.sha
  const previous = await repositoryPractices(env, baseSha)
  if (previous.practices.some((item) => item.requestId === job.id))
    throw new Error('This practice has already been merged')
  const next = appendPractice(previous, entry)
  const existing = await optional(env, `/git/ref/heads/${branch}`)
  let headSha = existing?.object.sha
  let current
  if (headSha) current = await repositoryPractices(env, headSha)
  if (!equal(current, next)) {
    if (existing && (!job.headSha || headSha !== job.headSha))
      throw new Error(
        'The practice branch changed outside this request. Review it before continuing.',
      )
    const commit = await github(env, `/git/commits/${baseSha}`)
    const tree = await github(env, '/git/trees', 'POST', {
      base_tree: commit.tree.sha,
      tree: [
        {
          path: PRACTICE_PATH,
          mode: '100644',
          type: 'blob',
          content: JSON.stringify(next, null, 2) + '\n',
        },
      ],
    })
    const created = await github(env, '/git/commits', 'POST', {
      message: `Add soccer practice: ${job.plan.title}`.replaceAll('@', '＠'),
      tree: tree.sha,
      parents: [...new Set([headSha, baseSha].filter(Boolean))],
    })
    if (existing)
      await github(env, `/git/refs/heads/${branch}`, 'PATCH', {
        sha: created.sha,
        force: false,
      })
    else
      await github(env, '/git/refs', 'POST', {
        ref: `refs/heads/${branch}`,
        sha: created.sha,
      })
    headSha = created.sha
  }
  const matches = await github(
    env,
    `/pulls?state=all&head=dafepro%3A${encodeURIComponent(branch)}&base=${encodeURIComponent(RELEASE_BRANCH)}&per_page=10`,
  )
  if (!Array.isArray(matches) || matches.length > 1)
    throw new Error('Ambiguous practice pull request')
  let pr = matches[0]
  if (pr?.state === 'closed')
    return {
      prNumber: pr.number,
      prUrl: pr.html_url,
      headSha,
      status: pr.merged_at ? 'publishing' : 'closed',
      mergeSha: pr.merge_commit_sha,
    }
  let assignments = previous.practices.map((item) => item.assignment)
  try {
    const response = await (env.TEST_FETCH || fetch)(
      `${env.APP_ORIGIN}/api/catalog`,
      { redirect: 'error', signal: AbortSignal.timeout(10000) },
    )
    if (response.ok)
      assignments = JSON.parse(
        new TextDecoder().decode(await readLimited(response.body, 1048576)),
      ).assignments
  } catch {
    /* Repository practices still provide a useful overlap comparison. */
  }
  const body = practicePRBody(job, similarPractices(job.plan, assignments))
  if (pr)
    pr = await github(env, `/pulls/${pr.number}`, 'PATCH', {
      title: job.plan.title.replaceAll('@', '＠'),
      body,
    })
  else
    pr = await github(env, '/pulls', 'POST', {
      title: job.plan.title.replaceAll('@', '＠'),
      body,
      head: branch,
      base: RELEASE_BRANCH,
      draft: false,
    })
  if (!Number.isSafeInteger(pr.number) || pr.number < 1)
    throw new Error('Invalid pull request response')
  await labels(env, pr.number)
  return {
    prNumber: pr.number,
    prUrl: `https://github.com/${REPOSITORY}/pull/${pr.number}`,
    headSha,
    status: 'submitted',
    reason: undefined,
  }
}
export function approvalDecision(
  pr,
  reviews,
  checks,
  files,
  job,
  slug = 'quicktrack-coach-publisher',
  approvedIssue = false,
) {
  if (
    pr.state !== 'open' ||
    pr.draft ||
    pr.user?.type !== 'Bot' ||
    pr.user.login !== `${slug}[bot]` ||
    pr.head?.repo?.full_name !== REPOSITORY ||
    pr.base?.ref !== RELEASE_BRANCH ||
    pr.head?.ref !== `coach-practice-${job.id}` ||
    pr.head.sha !== job.headSha
  )
    return false
  if (
    !files.length ||
    files.length !== 1 ||
    files[0].filename !== PRACTICE_PATH ||
    files[0].status !== 'modified'
  )
    return false
  const latest = reviews
    .filter(
      (review) =>
        review.user?.id === REVIEWER_ID &&
        ['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state),
    )
    .sort((a, b) => b.id - a.id)[0]
  if (latest?.state === 'CHANGES_REQUESTED' || latest?.state === 'DISMISSED')
    return false
  if (
    !approvedIssue &&
    (latest?.state !== 'APPROVED' || latest.commit_id !== pr.head.sha)
  )
    return false
  return REQUIRED_CHECKS.every((name) =>
    checks.some(
      (check) =>
        check.name === name &&
        check.app?.slug === 'github-actions' &&
        check.status === 'completed' &&
        check.conclusion === 'success',
    ),
  )
}
export function nextFeedback(reviews, comments, job) {
  const items = [
    ...reviews
      .filter(
        (item) =>
          item.user?.id === REVIEWER_ID &&
          item.state === 'CHANGES_REQUESTED' &&
          item.body?.trim(),
      )
      .map((item) => ({
        id: `review-${item.id}`,
        at: item.submitted_at,
        text: item.body,
      })),
    ...comments
      .filter(
        (item) =>
          item.user?.id === REVIEWER_ID &&
          /^\/coach\s+\S/i.test(item.body || ''),
      )
      .map((item) => ({
        id: `comment-${item.id}`,
        at: item.created_at,
        text: item.body.replace(/^\/coach\s+/i, ''),
      })),
  ]
    .filter((item) => !(job.feedbackIds || []).includes(item.id))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  const item = items.at(-1)
  if (!item) return null
  return {
    ...item,
    consumed: items.map((item) => item.id),
    text: item.text.slice(0, 1000),
  }
}
export async function inspectPracticePR(job, env) {
  const pr = await github(env, `/pulls/${job.prNumber}`)
  if (pr.merged) return { status: 'publishing', mergeSha: pr.merge_commit_sha }
  if (pr.state === 'closed')
    return {
      status: 'closed',
      reason: 'The pull request was closed without publication.',
    }
  const reviews = await github(
    env,
    `/pulls/${job.prNumber}/reviews?per_page=100`,
  )
  const comments = await github(
    env,
    `/issues/${job.prNumber}/comments?per_page=100`,
  )
  if (reviews.length >= 100 || comments.length >= 100)
    throw new Error('This request needs a manual review of its discussion.')
  const feedback = nextFeedback(reviews, comments, job)
  if (feedback) return { feedback }
  if (pr.head.sha !== job.headSha)
    return {
      status: 'attention',
      reason:
        'This PR changed outside the assistant. Review the new revision before continuing.',
    }
  const baseNow = await github(env, `/git/ref/heads/${RELEASE_BRANCH}`)
  const latestBase = await repositoryPractices(env, baseNow.object.sha)
  const branchData = await repositoryPractices(env, job.headSha)
  if (!equal(branchData.practices.slice(0, -1), latestBase.practices)) {
    // Rebuild only the allowlisted data against the latest base. A new head
    // invalidates the old review and reruns CI without another model call.
    return writePracticePR(job, env)
  }
  const checks = await github(
    env,
    `/commits/${job.headSha}/check-runs?per_page=100&filter=latest`,
  )
  const files = await github(env, `/pulls/${job.prNumber}/files?per_page=100`)
  if (checks.total_count >= 100)
    throw new Error('Too many checks to verify safely')
  if (
    !approvalDecision(
      pr,
      reviews,
      checks.check_runs || [],
      files,
      job,
      env.COACH_GITHUB_APP_SLUG,
      await issueStillApproved(job, env),
    )
  )
    return { status: 'submitted' }
  const before = await repositoryPractices(env, pr.base.sha),
    after = await repositoryPractices(env, pr.head.sha)
  assertAppendOnly(before, after)
  if (!equal(after.practices.at(-1), compilePractice(job)))
    throw new Error('The reviewed practice differs from the request')
  const merged = await github(env, `/pulls/${job.prNumber}/merge`, 'PUT', {
    sha: job.headSha,
    merge_method: 'squash',
  })
  if (!merged.merged) throw new Error('GitHub did not confirm the merge')
  return { status: 'publishing', mergeSha: merged.sha, reason: undefined }
}
