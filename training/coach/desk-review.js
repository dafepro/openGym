import { validatePlan } from './agent.js'

// Match the existing single-operator publishing authority. A signed coach
// identity alone must not expand who may approve publication.
export const DESK_REVIEWER = '3bigdave@gmail.com'
export const canReview = (profile) => profile?.email === DESK_REVIEWER
export const deskApproved = (job) =>
  job.deskApproval?.headSha === job.headSha &&
  job.deskApproval?.owner === job.owner &&
  job.deskApproval?.email === DESK_REVIEWER

export function editedPlan(plan, targets) {
  if (!Array.isArray(targets) || targets.length !== plan.drills.length)
    throw new Error('Keep every drill in this revision.')
  const next = structuredClone(plan)
  next.drills = next.drills.map((drill, index) => {
    const target = targets[index]
    const allowed = ['sets', 'reps', 'durationSec', 'restSec', 'side']
    if (!target || typeof target !== 'object' || Object.keys(target).some((key) => !allowed.includes(key)))
      throw new Error('Only practice targets can be edited here.')
    return { ...drill, ...target }
  })
  return validatePlan(next, new Set(plan.drills.flatMap((drill) => drill.sources.map((source) => source.url))))
}

export function reviewChange(job, input, reviewer, now = Date.now()) {
  if (!canReview(reviewer)) throw new Error('Only the publishing coach can approve or revise this practice.')
  if (job.status !== 'submitted' || !/^[a-f0-9]{40}$/.test(input.headSha || '') || input.headSha !== job.headSha)
    throw new Error('The practice changed. Reload the latest review before continuing.')
  const next = { ...job, deskApproval: undefined, reason: undefined, progress: undefined, nextPollAt: now }
  if (input.action === 'approve') {
    next.deskApproval = { headSha: job.headSha, owner: job.owner, email: reviewer.email, at: now }
  } else if (input.action === 'targets') {
    next.plan = editedPlan(job.plan, input.targets)
    if (
      input.targets.every((target, index) =>
        Object.entries(target).every(([key, value]) => value === job.plan.drills[index][key])
      )
    )
      throw new Error('Change a target before saving.')
    next.status = 'creating_pr'
    next.revisions = (job.revisions || 0) + 1
  } else if (input.action === 'revise') {
    if (typeof input.feedback !== 'string' || !input.feedback.trim() || input.feedback.length > 1000)
      throw new Error('Describe the changes in 1–1000 characters.')
    if ((job.revisions || 0) >= 3)
      throw new Error('The revision limit is reached. Start a new brief or open technical details.')
    next.status = 'retrying_revision'
    next.revisions = (job.revisions || 0) + 1
    next.revisionFeedback = input.feedback.trim()
    next.revisionRetries = 0
  } else throw new Error('Unknown review action.')
  return next
}
