import { github, REVIEWER_ID } from './github.js'
import { digest } from '../worker/http.js'
import { validatePlan } from './agent.js'
import { youtubeId } from '../src/domain/demonstration.js'
import { verifyDemonstrations } from './videos.js'
export async function approvedIssue(env, number) {
  const issue = await github(env, `/issues/${number}`)
  if (
    issue.pull_request ||
    issue.state !== 'open' ||
    !issue.labels.some((label) => label.name === 'coach:approved')
  )
    return null
  const trustedAuthor =
    issue.user?.id === REVIEWER_ID ||
    (issue.user?.type === 'Bot' &&
      issue.user.login ===
        `${env.COACH_GITHUB_APP_SLUG || 'quicktrack-coach-publisher'}[bot]`)
  if (!trustedAuthor) return null
  const events = await github(env, `/issues/${number}/events?per_page=100`)
  if (events.length >= 100) return null
  const approval = events
    .filter(
      (event) =>
        ['labeled', 'unlabeled'].includes(event.event) &&
        event.label?.name === 'coach:approved',
    )
    .at(-1)
  if (
    approval?.event !== 'labeled' ||
    approval.actor?.id !== REVIEWER_ID ||
    Date.parse(issue.updated_at) > Date.parse(approval.created_at)
  )
    return null
  return {
    issue,
    bodyHash: await digest(issue.body || ''),
    approvedAt: approval.created_at,
  }
}
export function issuePlan(body) {
  if (typeof body !== 'string' || body.length > 60000)
    throw new Error('Invalid approved practice issue')
  const match = /```json\s*([\s\S]*?)```/.exec(body)
  const payload = JSON.parse(match?.[1] || '')
  if (payload.schema !== 'quicktrack-coach-practice-v1' || !payload.practice)
    throw new Error('Unsupported practice issue format')
  const plan = structuredClone(payload.practice)
  for (const drill of plan.drills || [])
    drill.demonstrationUrl ||= drill.sources?.find((source) =>
      youtubeId(source.url),
    )?.url
  return validatePlan(
    plan,
    new Set(
      plan.drills.flatMap((drill) => drill.sources.map((source) => source.url)),
    ),
  )
}
export async function importApprovedIssue(queue, profile) {
  const env = queue.env
  const issues = await github(
    env,
    '/issues?state=open&labels=coach%3Aapproved&per_page=20',
  )
  for (const item of issues.filter((issue) => !issue.pull_request)) {
    const marker = `issue:${item.number}`
    if (await queue.ctx.storage.get(marker)) continue
    const approved = await approvedIssue(env, item.number)
    if (!approved) continue
    // A durable marker and normal admission path prevent repeated imports/charges.
    const id = crypto.randomUUID()
    let plan, videos, reason
    try {
      plan = issuePlan(approved.issue.body)
      videos = await verifyDemonstrations(plan, env.TEST_FETCH || fetch)
    } catch {
      reason =
        'The approved issue needs the structured practice format and a valid demonstration for every drill.'
    }
    const existing = await queue.ctx.storage.list({ prefix: 'job:' })
    if (
      [...existing.values()].some(
        (job) => job.sourceIssueNumber === item.number,
      )
    )
      continue
    await queue.ctx.storage.transaction(async (tx) => {
      await tx.put(`job:${id}`, {
        id,
        owner: profile.owner,
        brief: 'Imported from an approved practice issue.',
        recipients: [],
        recipientCount: 0,
        submitterEmail: profile.email,
        createdAt: Date.now(),
        status: reason ? 'attention' : 'creating_pr',
        reason,
        plan,
        videos,
        sourceIssueNumber: item.number,
        issueUrl: approved.issue.html_url,
        issueApproval: {
          bodyHash: approved.bodyHash,
          approvedAt: approved.approvedAt,
        },
        nextPollAt: Date.now(),
      })
      await tx.put(marker, { id, importedAt: Date.now() })
    })
    break
  }
}
export async function issueStillApproved(job, env) {
  if (!job.sourceIssueNumber || !job.issueApproval || job.revisions)
    return false
  const current = await approvedIssue(env, job.sourceIssueNumber)
  return (
    !!current &&
    current.bodyHash === job.issueApproval.bodyHash &&
    current.approvedAt === job.issueApproval.approvedAt
  )
}
