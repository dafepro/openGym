import { validateAssignment, validateCatalog } from './content.js'
const canonical = (value) =>
  JSON.stringify(value, (_, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([a], [b]) => a.localeCompare(b)),
        )
      : item,
  )
export function validateAdditions(value) {
  if (
    !value ||
    Object.keys(value).sort().join(',') !== 'practices,schemaVersion' ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.practices) ||
    value.practices.length > 200
  )
    throw new Error('Invalid public practice collection')
  if (new TextEncoder().encode(JSON.stringify(value)).length > 700000)
    throw new Error('Public practice collection is full')
  const ids = new Set()
  for (const entry of value.practices) {
    if (
      !entry ||
      Object.keys(entry).sort().join(',') !== 'assignment,requestId,sources' ||
      !/^[a-f0-9-]{36}$/.test(entry.requestId || '') ||
      ids.has(entry.requestId)
    )
      throw new Error('Invalid practice entry')
    ids.add(entry.requestId)
    const assignment = validateAssignment(entry.assignment)
    if (
      assignment.id !== `coach-${entry.requestId}` ||
      assignment.status !== 'archived' ||
      assignment.revision !== 'v1' ||
      !assignment.note ||
      assignment.drills.length > 12
    )
      throw new Error('Invalid published practice identity')
    if (
      !Array.isArray(entry.sources) ||
      entry.sources.length !== assignment.drills.length
    )
      throw new Error('Every drill requires reviewed sources')
    for (const [index, source] of entry.sources.entries()) {
      if (
        !source ||
        Object.keys(source).sort().join(',') !== 'author,title,url,videoId' ||
        source.videoId !== assignment.drills[index].media.youtubeId ||
        source.url !== `https://www.youtube.com/watch?v=${source.videoId}` ||
        typeof source.title !== 'string' ||
        !source.title.trim() ||
        source.title.length > 300 ||
        typeof source.author !== 'string' ||
        source.author.length > 200
      )
        throw new Error('Invalid demonstration provenance')
    }
    if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(JSON.stringify(assignment)))
      throw new Error('Public practices cannot contain contact details')
  }
  return value
}
export function appendPractice(collection, entry) {
  validateAdditions(collection)
  if (collection.practices.some((item) => item.requestId === entry.requestId))
    throw new Error('This practice is already published')
  return validateAdditions({
    schemaVersion: 1,
    practices: [...collection.practices, entry],
  })
}
export function assertAppendOnly(previous, next) {
  validateAdditions(previous)
  validateAdditions(next)
  if (
    next.practices.length !== previous.practices.length + 1 ||
    canonical(next.practices.slice(0, -1)) !== canonical(previous.practices)
  )
    throw new Error(
      'A practice PR must append exactly one practice without changing published entries',
    )
}
export async function publicEdition(baseRevision, practices) {
  if (!practices.length) return baseRevision
  const bytes = new TextEncoder().encode(canonical(practices))
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16)
  const revision = `${baseRevision}--c${practices.length}-${hash}`
  if (revision.length > 128) throw new Error('Catalog edition is too long')
  return revision
}
export async function extendCatalog(
  base,
  additions,
  count = additions.practices.length,
) {
  validateAdditions(additions)
  if (
    !Number.isInteger(count) ||
    count < 0 ||
    count > additions.practices.length
  )
    throw new Error('Unknown public practice edition')
  if (!count) return base
  const practices = additions.practices.slice(0, count)
  return validateCatalog({
    ...base,
    revision: await publicEdition(base.revision, practices),
    assignments: [
      ...base.assignments,
      ...practices.map((item) => item.assignment),
    ],
  })
}
export function splitPublicEdition(revision) {
  const match = /^(.+)--c([1-9]\d{0,2})-([a-f0-9]{16})$/.exec(revision)
  return match ? { baseRevision: match[1], count: Number(match[2]) } : null
}
