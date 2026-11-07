import { useEffect, useRef } from 'react'
let sdk
function loadSDK() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (sdk) return sdk
  sdk = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    const timeout = setTimeout(() => {
      sdk = null
      reject(new Error('Video player unavailable'))
    }, 15000)
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout)
      previous?.()
      resolve(window.YT)
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => {
      clearTimeout(timeout)
      script.remove()
      sdk = null
      reject(new Error('Video player unavailable'))
    }
    document.head.append(script)
  })
  return sdk
}
// Adapt the documented iframe API to the media controls used by hosted footage.
// The iframe exists only while the player has explicitly opened the demonstration.
export default function YouTubeVideo({
  videoId,
  portrait,
  clipStartSec = 0,
  clipEndSec,
  mediaRef,
  ...callbacks
}) {
  const container = useRef(null),
    latest = useRef(callbacks)
  latest.current = callbacks
  useEffect(() => {
    let cancelled = false,
      player,
      adapter,
      timer,
      lastDuration = 0,
      clipEnded = false
    const length = () =>
      Math.max(
        0,
        Math.min(player.getDuration() || 0, clipEndSec ?? Infinity) -
          clipStartSec,
      )
    const mount = document.createElement('iframe')
    mount.referrerPolicy = 'strict-origin-when-cross-origin'
    mount.allow = 'autoplay; fullscreen; encrypted-media'
    mount.title = `${latest.current.title} demonstration`
    mount.src = `https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&playsinline=1&controls=0&rel=0&start=${clipStartSec}${clipEndSec != null ? `&end=${clipEndSec}` : ''}&origin=${encodeURIComponent(window.location.origin)}`
    container.current.append(mount)
    const readyTimeout = setTimeout(() => {
      if (!cancelled && !adapter) latest.current.onError?.()
    }, 20000)
    loadSDK()
      .then((YT) => {
        if (cancelled) return
        player = new YT.Player(mount, {
          host: 'https://www.youtube-nocookie.com',
          videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            controls: 0,
            playsinline: 1,
            rel: 0,
            start: clipStartSec,
            ...(clipEndSec != null ? { end: clipEndSec } : {}),
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (cancelled) return
              clearTimeout(readyTimeout)
              const iframe = player.getIframe()
              iframe.setAttribute(
                'referrerpolicy',
                'strict-origin-when-cross-origin',
              )
              iframe.setAttribute(
                'allow',
                'autoplay; fullscreen; encrypted-media',
              )
              iframe.setAttribute(
                'title',
                `${latest.current.title} demonstration`,
              )
              let mute = true
              adapter = {
                get currentTime() {
                  return Math.max(
                    0,
                    (player.getCurrentTime() || 0) - clipStartSec,
                  )
                },
                set currentTime(value) {
                  clipEnded = false
                  player.seekTo(
                    clipStartSec + Math.max(0, Math.min(length(), value)),
                    true,
                  )
                },
                get duration() {
                  return length()
                },
                get paused() {
                  return player.getPlayerState() !== 1
                },
                get muted() {
                  return mute
                },
                set muted(value) {
                  mute = !!value
                  mute ? player.mute() : player.unMute()
                },
                defaultMuted: true,
                volume: 1,
                textTracks: [],
                videoHeight: portrait ? 1280 : 360,
                videoWidth: portrait ? 720 : 640,
                get playbackRate() {
                  return player.getPlaybackRate()
                },
                set playbackRate(value) {
                  player.setPlaybackRate(value)
                },
                play() {
                  if (clipEnded) {
                    clipEnded = false
                    player.seekTo(clipStartSec, true)
                  }
                  player.playVideo()
                  return Promise.resolve()
                },
                pause() {
                  player.pauseVideo()
                },
                load() {
                  player.mute()
                  player.loadVideoById({
                    videoId,
                    startSeconds: clipStartSec,
                    ...(clipEndSec != null ? { endSeconds: clipEndSec } : {}),
                  })
                },
              }
              mediaRef.current = adapter
              player.mute()
              if (clipStartSec) player.seekTo(clipStartSec, true)
              latest.current.onCanPlay?.()
              if (latest.current.autoPlay) player.playVideo()
              timer = setInterval(() => {
                if (cancelled) return
                const duration = length()
                if (duration > 0 && duration !== lastDuration) {
                  lastDuration = duration
                  latest.current.onLoadedMetadata?.()
                }
                latest.current.onTimeUpdate?.()
                if (
                  clipEndSec != null &&
                  player.getCurrentTime() >= clipEndSec &&
                  !clipEnded
                ) {
                  clipEnded = true
                  player.pauseVideo()
                  latest.current.onEnded?.()
                }
              }, 200)
            },
            onStateChange: (event) => {
              if (cancelled) return
              if (event.data === 1) {
                latest.current.onPlay?.()
                latest.current.onPlaying?.()
              }
              if (event.data === 2 || event.data === 5) {
                latest.current.onPause?.()
                latest.current.onCanPlay?.()
              }
              if (event.data === 0 && !clipEnded) {
                clipEnded = true
                latest.current.onEnded?.()
              }
              if (event.data === 3) latest.current.onWaiting?.()
            },
            onError: () => {
              if (!cancelled) latest.current.onError?.()
            },
          },
        })
        // The Referer must be set before the first iframe navigation (YouTube error 153).
        const iframe = player.getIframe?.()
        if (iframe) iframe.referrerPolicy = 'strict-origin-when-cross-origin'
      })
      .catch(() => {
        if (!cancelled) latest.current.onError?.()
      })
    return () => {
      cancelled = true
      clearTimeout(readyTimeout)
      clearInterval(timer)
      player?.destroy()
      mount.remove()
      if (mediaRef.current === adapter) mediaRef.current = null
    }
  }, [videoId, portrait, mediaRef, clipStartSec, clipEndSec])
  return <div ref={container} className="qt-youtube-surface" />
}
