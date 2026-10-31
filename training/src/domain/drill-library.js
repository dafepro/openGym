// Only locally approved media can be offered as a playable demonstration.
export const hasDemonstration = drill => drill.media?.status === 'approved' && /^\/media\/[^/]+$/.test(drill.media?.path || '')

export function orderDrillsByVideo(candidates, order = 'first') {
  if (order === 'only') return candidates.filter(({ drill }) => hasDemonstration(drill))
  if (order === 'first') return [...candidates].sort((a, b) => Number(hasDemonstration(b.drill)) - Number(hasDemonstration(a.drill)))
  return candidates
}
