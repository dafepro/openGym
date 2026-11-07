export const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/
export function youtubeId(value) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.port)
      return null
    let id
    if (url.hostname === 'youtu.be') id = url.pathname.slice(1)
    else if (
      ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)
    ) {
      if (url.pathname === '/watch') id = url.searchParams.get('v')
      else
        id = /^\/(?:shorts|embed)\/([A-Za-z0-9_-]{11})\/?$/.exec(
          url.pathname,
        )?.[1]
    }
    return YOUTUBE_ID.test(id || '') ? id : null
  } catch {
    return null
  }
}
export const isYouTubeMedia = (media) =>
  media?.provider === 'youtube' &&
  YOUTUBE_ID.test(media.youtubeId || '') &&
  media.id === `youtube-${media.youtubeId}`
export const demonstrationThumbnail = (media) =>
  isYouTubeMedia(media)
    ? `https://i.ytimg.com/vi/${media.youtubeId}/hqdefault.jpg`
    : media?.poster
