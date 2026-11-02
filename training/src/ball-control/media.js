// Approval is supplied by the existing catalog. Never derive approval from an ID.
export function resolveDemonstration(catalog, videoId) {
  const matches = (catalog?.assignments || []).flatMap(assignment => assignment.drills || []).map(drill => drill.media).filter(media => media?.id === videoId)
  if (matches.some(media => media.status === 'revoked')) return { id: videoId, status: 'revoked' }
  return matches.find(media => media.status === 'approved' && (media.url || media.path) === `/media/${videoId}`) || { id: videoId, status: 'unavailable' }
}
