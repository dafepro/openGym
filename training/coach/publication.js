import { compilePractice } from './compiler.js'
import { github } from './github.js'
import { validateCatalog } from '../src/domain/content.js'
import {
  createPracticeCode,
  readPracticeCode,
} from '../src/domain/practice-code.js'
import { readLimited } from '../worker/http.js'
const canonical = (value) =>
  JSON.stringify(value, (_, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([a], [b]) => a.localeCompare(b)),
        )
      : item,
  )
export async function publishedPractice(job, env) {
  const fetcher = env.TEST_FETCH || fetch
  const response = await fetcher(`${env.APP_ORIGIN}/api/catalog`, {
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) return null
  const catalog = validateCatalog(
    JSON.parse(
      new TextDecoder().decode(await readLimited(response.body, 1048576)),
    ),
  )
  const expected = compilePractice(job).assignment
  const assignment = catalog.assignments.find(
    (item) => item.id === expected.id && item.revision === expected.revision,
  )
  if (!assignment) return null
  if (canonical(assignment) !== canonical(expected))
    throw new Error('The live practice differs from the approved practice')
  const source = await fetcher(`${env.APP_ORIGIN}/source.html`, {
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  })
  if (!source.ok) return null
  const html = new TextDecoder().decode(await readLimited(source.body, 65536))
  const liveSha =
    /github\.com\/dafepro\/openGym\/tree\/([a-f0-9]{40})\/training/.exec(
      html,
    )?.[1]
  if (!liveSha || !/^[a-f0-9]{40}$/.test(job.mergeSha || '')) return null
  if (liveSha !== job.mergeSha) {
    const comparison = await github(
      env,
      `/compare/${job.mergeSha}...${liveSha}`,
    )
    if (!['ahead', 'identical'].includes(comparison.status)) return null
  }
  const pass = await createPracticeCode(assignment, env.APP_ORIGIN, catalog)
  const decoded = await readPracticeCode(pass.code, catalog)
  if (
    decoded.title !== assignment.title ||
    decoded.note !== assignment.note ||
    decoded.drills.length !== assignment.drills.length
  )
    throw new Error('The published practice pass could not be verified')
  return {
    practiceUrl: pass.link,
    publishedTitle: assignment.title,
    publishedSourceSha: liveSha,
    status: 'ready',
    reason: undefined,
  }
}
