import { validateAssignment } from '../src/domain/content.js'
import { validatePlan } from './agent.js'
import { youtubeId } from '../src/domain/demonstration.js'
import { validateAdditions } from '../src/domain/public-practices.js'
export function compilePractice(job) {
  const { plan, videos } = job
  validatePlan(
    plan,
    new Set(
      plan.drills.flatMap((drill) => drill.sources.map((source) => source.url)),
    ),
  )
  if (!Array.isArray(videos) || videos.length !== plan.drills.length)
    throw new Error('Verified demonstrations required')
  const entry = {
    requestId: job.id,
    assignment: {
      id: `coach-${job.id}`,
      revision: 'v1',
      title: plan.title,
      note: plan.goal,
      status: 'archived',
      drills: plan.drills.map((drill, index) => ({
        id: `coach-${job.id}-${index + 1}`,
        title: drill.title,
        instructions: `Setup: ${drill.setup}\n${drill.instructions}\nFocus: ${drill.focus}`,
        mode: drill.mode,
        sets: drill.sets,
        ...(drill.mode === 'time'
          ? { durationSec: drill.durationSec }
          : { reps: drill.reps }),
        restSec: drill.restSec,
        side: drill.side,
        metadata: { version: 1, registryVersion: 1, tags: drill.tags },
        media: {
          id: `youtube-${youtubeId(drill.demonstrationUrl)}`,
          status: 'approved',
          provider: 'youtube',
          youtubeId: youtubeId(drill.demonstrationUrl),
          portrait: new URL(drill.demonstrationUrl).pathname.startsWith(
            '/shorts/',
          ),
          ...(drill.demonstrationStartSec != null
            ? {
                clipStartSec: drill.demonstrationStartSec,
                clipEndSec: drill.demonstrationEndSec,
              }
            : {}),
        },
      })),
    },
    sources: videos,
  }
  entry.assignment = validateAssignment(entry.assignment)
  validateAdditions({ schemaVersion: 1, practices: [entry] })
  return entry
}
const words = (text) => new Set(text.toLowerCase().match(/[a-z]{3,}/g) || [])
export function similarPractices(plan, assignments = []) {
  const proposed = new Set(
    plan.drills.flatMap((drill) => [...words(drill.title)]),
  )
  const tags = new Set(plan.drills.flatMap((drill) => drill.tags))
  return assignments
    .map((assignment) => {
      const existing = new Set(
        assignment.drills.flatMap((drill) => [...words(drill.title)]),
      )
      const skills = new Set(
        assignment.drills.flatMap((drill) => drill.metadata?.tags || []),
      )
      const sharedWords = [...proposed].filter((word) =>
        existing.has(word),
      ).length
      const sharedSkills = [...tags].filter((tag) => skills.has(tag)).length
      const titleScore =
        sharedWords / Math.max(1, new Set([...proposed, ...existing]).size)
      return {
        title: assignment.title,
        sharedSkills,
        score: titleScore,
        suggestion: titleScore >= 0.5 ? `${assignment.title} 2` : null,
      }
    })
    .filter((item) => item.score >= 0.2 || item.sharedSkills >= 2)
    .sort((a, b) => b.score - a.score || b.sharedSkills - a.sharedSkills)
    .slice(0, 3)
}
const md = (value) =>
  String(value)
    .replace(/[\`*_{}\[\]()<>#!|]/g, '\\$&')
    .replaceAll('@', '＠')
export function practicePRBody(job, overlap = []) {
  const contacts = job.recipients || []
  const counts = ['email', 'sms']
    .map(
      (channel) =>
        `${contacts.filter((item) => item.channel === channel).length} ${channel === 'sms' ? 'text' : 'email'}`,
    )
    .join(' · ')
  const drills = job.plan.drills
    .map((drill, index) => {
      const video = job.videos[index]
      const excerpt =
        drill.demonstrationStartSec != null
          ? `\n**Video excerpt:** ${drill.demonstrationStartSec}s–${drill.demonstrationEndSec}s (${drill.demonstrationEndSec - drill.demonstrationStartSec}s).\n`
          : ''
      const url =
        drill.demonstrationStartSec != null
          ? `${video.url}&t=${drill.demonstrationStartSec}s`
          : video.url
      return `### ${index + 1}. ${md(drill.title)}\n\n${drill.sets} × ${drill.mode === 'time' ? `${drill.durationSec}s` : `${drill.reps} reps`}${drill.side === 'each' ? ' each foot/side' : ''} · ${drill.restSec}s rest\n\n**Setup:** ${md(drill.setup)}\n\n${md(drill.instructions)}\n\n**Focus:** ${md(drill.focus)}\n${excerpt}\n[![Demonstration](https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg)](${url})\n\n[${md(video.title)}](${url}) — ${md(video.author)}\n`
    })
    .join('\n')
  const related = overlap.length
    ? overlap
        .map(
          (item) =>
            `- ${md(item.title)}: ${item.sharedSkills} shared skill labels.${item.suggestion ? ` Consider **${md(item.suggestion)}** if this is a progression.` : ' Compare the drill sequence before publishing.'}`,
        )
        .join('\n')
    : 'No close match found in the current catalog.'
  return `<!-- quicktrack-coach:v2:${job.id} -->\n## ${md(job.plan.title)}\n\n**Goal:** ${md(job.plan.goal)}\n\n${md(job.plan.overview)}\n\n**Submitted by:** ${job.submitterEmail ? (job.submitterEmail.toLowerCase() === '3bigdave@gmail.com' ? 'dafepro · Google-verified coach' : 'Google-verified authorized coach') : 'dafepro · approved issue'}\n**For:** ${contacts.length} ${contacts.length === 1 ? 'recipient' : 'recipients'} (${counts}). [Private recipient details and submitter](https://train.quicktrack.cc/#/coach). Contacts are never committed to this public repository.\n\n${drills}\n## Related practices\n\n${related}\n\nApprove this revision to publish after checks pass. Comment \`/coach your changes\` to revise this same PR.\n\nRouting: \`coach:practice\` · [Stored publishing instructions](https://github.com/dafepro/openGym/blob/codex/quicktrack-training-release/training/coach/PRACTICE_PUBLISHING.md).\n`
}
