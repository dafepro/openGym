import { validateAssignment } from '../domain/content.js'
import { validateSession } from '../domain/session.js'
export const consent =
  'Accepting shares only the results and notes you explicitly send for this assignment with its coach. Other practice history stays private.'
const text = (value, max) => {
  if (typeof value !== 'string' || value.length > max) throw new Error('Invalid text')
  return value.trim()
}
export function createAssignment(input, owner, now = Date.now()) {
  const email = text(input.email, 254).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a player email')
  const due = input.due || null
  if (due && (!/^\d{4}-\d{2}-\d{2}$/.test(due) || !Number.isFinite(Date.parse(due))))
    throw new Error('Invalid due date')
  return {
    id: crypto.randomUUID(),
    owner,
    email,
    practice: validateAssignment(input.practice),
    due,
    createdAt: now,
    revision: 0,
    status: 'pending',
    result: null,
    comment: '',
    reviewedAt: null
  }
}
export function changeAssignment(record, input, role, now = Date.now()) {
  if (input.revision !== record.revision) throw new Error('Assignment changed. Reload before trying again.')
  const next = structuredClone(record)
  if (role === 'player' && input.action === 'accept' && record.status === 'pending') {
    next.status = 'accepted'
    next.acceptedAt = now
    next.consentVersion = 1
  } else if (role === 'player' && input.action === 'submit' && record.status === 'accepted') {
    validateSession(input.session)
    if (
      input.session.status === 'active' ||
      JSON.stringify(input.session.assignment) !== JSON.stringify(record.practice)
    )
      throw new Error('Choose a finished session of this exact practice version')
    // Only this assignment's work is transmitted, never a profile or history export.
    next.result = {
      sessionId: input.session.id,
      status: input.session.status,
      rows: input.session.rows,
      sentAt: now,
      note: text(input.note || '', 1000)
    }
    next.status = 'submitted'
  } else if (role === 'coach' && input.action === 'review' && record.status === 'submitted') {
    next.comment = text(input.comment || '', 1000)
    next.reviewedAt = now
    next.status = 'reviewed'
  } else throw new Error('This action is not available')
  next.revision++
  return next
}
