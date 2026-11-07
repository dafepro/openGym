import { prompts } from './prompts.js'
import { youtubeId } from '../src/domain/demonstration.js'
import { verifyDemonstrations } from './videos.js'
const text = (max) => ({ type: 'string', minLength: 1, maxLength: max })
const object = (properties) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
})
export const planSchema = object({
  title: text(120),
  goal: text(240),
  overview: text(700),
  drills: {
    type: 'array',
    minItems: 1,
    maxItems: 12,
    items: object({
      title: text(120),
      setup: text(600),
      instructions: text(1200),
      focus: text(240),
      mode: { type: 'string', enum: ['time', 'reps'] },
      sets: { type: 'integer', minimum: 1, maximum: 10 },
      reps: { type: ['integer', 'null'], minimum: 1, maximum: 100 },
      durationSec: { type: ['integer', 'null'], minimum: 10, maximum: 1200 },
      restSec: { type: 'integer', minimum: 0, maximum: 300 },
      side: { type: 'string', enum: ['both', 'each'] },
      tags: { type: 'array', minItems: 1, maxItems: 12, items: { ...text(60), pattern: '^futbol:[a-z0-9]+(?:-[a-z0-9]+)*$' },
      },
      demonstrationUrl: text(1500),
      sources: {
        type: 'array',
        minItems: 1,
        maxItems: 5,
        items: object({ title: text(200), url: text(1500) }),
      },
    }),
  },
})
const plain = (value) =>
  value && typeof value === 'object' && !Array.isArray(value)
function valid(value, schema) {
  if (value === null)
    return Array.isArray(schema.type) && schema.type.includes('null')
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type
  if (type === 'object')
    return (
      plain(value) &&
      Object.keys(value).length === schema.required.length &&
      schema.required.every(
        (key) =>
          Object.hasOwn(value, key) &&
          valid(value[key], schema.properties[key]),
      )
    )
  if (type === 'array')
    return (
      Array.isArray(value) &&
      value.length >= (schema.minItems || 0) &&
      value.length <= schema.maxItems &&
      value.every((item) => valid(item, schema.items))
    )
  if (type === 'integer')
    return (
      Number.isInteger(value) &&
      value >= schema.minimum &&
      value <= schema.maximum
    )
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    (!schema.enum || schema.enum.includes(value)) &&
    (!schema.pattern || new RegExp(schema.pattern).test(value)) &&
    value.length >= (schema.minLength || 0) &&
    value.length <= (schema.maxLength || Infinity) &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  )
}
export function validatePlan(plan, sources) {
  if (!valid(plan, planSchema))
    throw new Error('The proposed practice did not match the required format.')
  if (/[\u0000-\u001f\u007f]/.test(plan.goal))
    throw new Error('The practice goal must be one printable focus cue.')
  for (const drill of plan.drills) {
    if (
      `Setup: ${drill.setup}\n${drill.instructions}\nFocus: ${drill.focus}`
        .length > 2000
    )
      throw new Error(
        'The combined drill instructions are too long for the player.',
      )
    if (
      drill.mode === 'time'
        ? drill.durationSec === null || drill.reps !== null
        : drill.reps === null || drill.durationSec !== null
    )
      throw new Error('The proposed targets need review.')
    if (
      !youtubeId(drill.demonstrationUrl) ||
      !sources.has(drill.demonstrationUrl) ||
      !drill.sources.some((source) => source.url === drill.demonstrationUrl)
    )
      throw new Error(
        'Every drill needs a video source found in the research results.',
      )
    for (const source of drill.sources) {
      const url = new URL(source.url)
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        !sources.has(source.url)
      )
        throw new Error(
          'A proposed source was not found in the research results.',
        )
    }
    if (drill.tags.some((tag) => !/^futbol:[a-z0-9-]+$/.test(tag)))
      throw new Error('Invalid drill labels.')
  }
  return plan
}
const outputText = (response) =>
  response.output
    ?.filter((item) => item.type === 'message')
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === 'output_text')
    .map((item) => item.text)
    .join('\n') || ''
export async function response(env, body, fetcher = fetch) {
  const result = await fetcher('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: env.OPENAI_MODEL, store: false, ...body }),
    signal: AbortSignal.timeout(90000),
  })
  if (!result.ok)
    throw new Error('The practice assistant is temporarily unavailable.')
  const data = await result.json()
  if (data.status !== 'completed' || data.error)
    throw new Error(
      'The practice assistant did not finish. Please retry later.',
    )
  return data
}
const format = (name, schema) => ({
  format: { type: 'json_schema', name, strict: true, schema },
})
export async function researchPractice(brief, env, fetcher = fetch,
  context = {},
) {
  // Contacts never reach the model. Remove accidental contact details in the brief too.
  const redact = (value) =>
    value
      .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[contact removed]')
    .replace(/\+?\d[\d ().-]{7,}\d/g, '[contact removed]')
  const input = redact(brief)
  context = JSON.parse(redact(JSON.stringify(context)))
  const screeningInput = JSON.stringify({
    brief: input,
    feedback: context.feedback || '',
  })
  if (
    /ignore (all |previous |prior )?instructions|system prompt|api[ _-]?key|reveal.*secret|execute.*(command|code)|<\/?(system|developer)>/i.test(
      screeningInput,
    )
  )
    return {
      rejected: true,
      reason:
        'Describe the soccer practice, equipment, and player’s focus only.',
    }
  const gate = await response(
    env,
    {
      instructions: prompts.gate,
      input: screeningInput,
      max_output_tokens: 350,
      text: format(
        'coach_gate',
        object({ accepted: { type: 'boolean' }, reason: text(200) }),
      ),
    },
    fetcher,
  )
  const verdict = JSON.parse(outputText(gate))
  if (verdict.accepted !== true)
    return {
      rejected: true,
      reason:
        'Describe a soccer practice with a clear training goal, equipment, and available time.',
    }
  const research = await response(
    env,
    {
      instructions: prompts.research,
      input: JSON.stringify({ brief: input, ...context }),
      tools: [{ type: 'web_search' }],
      include: ['web_search_call.action.sources'],
      max_tool_calls: 3,
      max_output_tokens: 4500,
    },
    fetcher,
  )
  const sources = new Set(
    research.output?.flatMap((item) =>
      item.type === 'web_search_call'
        ? (item.action?.sources || []).map((source) => source.url)
        : (item.content || []).flatMap((content) =>
            (content.annotations || [])
              .filter((a) => a.type === 'url_citation')
              .map((a) => a.url),
          ),
    ) || [],
  )
  if (!sources.size)
    throw new Error(
      'No verifiable coaching sources were found. Refine the request.',
    )
  const generated = await response(
    env,
    {
      instructions: prompts.compose,
      input: JSON.stringify({
        brief: input,
        context,
        research: outputText(research),
        sources: [...sources],
      }),
      max_output_tokens: 6000,
      text: format('soccer_practice', planSchema),
    },
    fetcher,
  )
  const plan = validatePlan(JSON.parse(outputText(generated)), sources)
  return { plan, videos: await verifyDemonstrations(plan, fetcher) }
}
export function issueBody(reference, plan) {
  // No raw brief, addresses, access tokens, executable commands or auto-publish labels.
  const payload = JSON.stringify(
    {
      schema: 'quicktrack-coach-practice-v1',
      request: reference,
      goal: plan.goal,
      practice: plan,
      publication: 'coach-review-required',
    },
    null,
    2,
  )
    .replaceAll('`', '\\u0060')
    .replaceAll('@', '\\u0040')
  return `## ${plan.title.replaceAll('@', '＠')}\n\n${plan.goal.replaceAll('@', '＠').replaceAll('`', '′')}\n\nLabel: \`coach:practice\`. Publication instructions: [coach/PRACTICE_PUBLISHING.md](https://github.com/dafepro/openGym/blob/codex/quicktrack-training-release/training/coach/PRACTICE_PUBLISHING.md).\n\n\`\`\`json\n${payload}\n\`\`\`\n`
}
