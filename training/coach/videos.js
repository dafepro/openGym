import { youtubeId } from '../src/domain/demonstration.js'
import { readLimited } from '../worker/http.js'
export async function verifyDemonstrations(plan, fetcher = fetch) {
  const verified = new Map()
  for (const drill of plan.drills) {
    const id = youtubeId(drill.demonstrationUrl)
    if (!id)
      throw new Error('Every drill needs a researched YouTube demonstration.')
    if (verified.has(id)) continue
    const url = `https://www.youtube.com/watch?v=${id}`
    const response = await fetcher(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { redirect: 'error', signal: AbortSignal.timeout(12000) },
    )
    if (!response.ok)
      throw new Error(
        'A demonstration is unavailable for embedding. Revise the brief to find another video.',
      )
    const metadata = JSON.parse(
      new TextDecoder().decode(await readLimited(response.body, 16000)),
    )
    if (
      metadata.provider_name !== 'YouTube' ||
      metadata.type !== 'video' ||
      typeof metadata.title !== 'string' ||
      !metadata.title.trim() ||
      metadata.title.length > 300 ||
      typeof metadata.author_name !== 'string' ||
      metadata.author_name.length > 200
    )
      throw new Error('Video metadata could not be verified.')
    verified.set(id, {
      videoId: id,
      url,
      title: metadata.title,
      author: metadata.author_name,
    })
  }
  return plan.drills.map((drill) =>
    verified.get(youtubeId(drill.demonstrationUrl)),
  )
}
