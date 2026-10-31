import { canonicalSkillTags, normalizeTrainingTags } from '../domain/metadata.js'

const label = value => { const text = value.replace(/^futbol:/, '').replace(/[-_]/g, ' '); return text.charAt(0).toUpperCase() + text.slice(1) }

export default function DrillMetadata({ metadata }) {
  if (!metadata) return null
  const skills = canonicalSkillTags(metadata)
  const other = normalizeTrainingTags(metadata.tags || []).filter(tag => !skills.includes(tag))
  const requirements = metadata.requirements
  const context = []
  if (requirements?.settings) context.push(...(requirements.settings.length ? requirements.settings.map(label) : ['Any setting']))
  if (requirements?.equipment) context.push(...(requirements.equipment.length ? requirements.equipment.map(label) : ['No equipment required']))
  if (requirements?.participants) {
    const { min, max, roles } = requirements.participants
    context.push(min === 1 && max === 1 ? 'Solo' : `${min}${max === min ? '' : max ? `–${max}` : '+'} people`)
    context.push(...roles.map(label))
  }
  if (requirements?.space) context.push(`${requirements.space.lengthM} × ${requirements.space.widthM} m`)
  if (!skills.length && !other.length && !context.length) return null
  return <section className="qt-drill-metadata" aria-label="Drill focus and context">{skills.length > 0 && <div><span>Focus</span><ul>{skills.map(tag => <li key={tag}>{label(tag)}</li>)}</ul></div>}{other.length > 0 && <div><span>Tags</span><ul>{other.map(tag => <li key={tag}>{label(tag)}</li>)}</ul></div>}{context.length > 0 && <div><span>Setup</span><ul>{[...new Set(context)].map(item => <li key={item}>{item}</li>)}</ul></div>}</section>
}
