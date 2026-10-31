import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import PlayPauseIcon from './PlayPauseIcon.jsx'
import Reveal from './Reveal.jsx'
import { formatClock } from './ui.jsx'

const loopClock = seconds => { const tenths = Math.round(seconds * 10); return `${formatClock(Math.floor(tenths / 10))}.${tenths % 10}` }

// Only an approved, resolved first-party URL enters this component. It never discovers media.
export default function DrillDemonstration({ media, title, workActive = false, autoPlay = false, playerRef, sample = false, onPlaybackError }) {
  const playerFrame = useRef(null)
  const localVideo = useRef(null)
  const video = playerRef || localVideo
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rate, setRate] = useState(1)
  const [repeat, setRepeat] = useState(false)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(10)
  const [duration, setDuration] = useState(0)
  const [loopBounds, setLoopBounds] = useState([0, 20])
  const [portrait, setPortrait] = useState(false)
  const [position, setPosition] = useState(0)
  const [captions, setCaptions] = useState(!!media?.captions)
  const [fullscreen, setFullscreen] = useState(false)
  const src = media?.url || media?.path
  const approvedPath = typeof media?.id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(media.id) && src === `/media/${media.id}`
  const available = approvedPath && media?.status === 'approved'
  useEffect(() => { setError(false); setLoading(false); setPlaying(false); setPosition(0); setCaptions(!!media?.captions); setMuted(true); if (video.current) video.current.muted = true; setRepeat(false); setRate(1); setDuration(0); setStart(0); setEnd(10); setPortrait(!!video.current && video.current.videoHeight > video.current.videoWidth); if (video.current) video.current.playbackRate = 1 }, [src, title, available])
  useEffect(() => { if (workActive && !autoPlay) video.current?.pause() }, [workActive, autoPlay])
  useEffect(() => { if (autoPlay && available) { const attempt = video.current?.play(); attempt?.catch(() => setPlaying(false)) } }, [autoPlay, available, src])
  useEffect(() => { const player = video.current; return () => player?.pause() }, [src, title, available])
  useEffect(() => {
    const changed = () => setFullscreen(document.fullscreenElement === playerFrame.current)
    document.addEventListener('fullscreenchange', changed)
    return () => document.removeEventListener('fullscreenchange', changed)
  }, [])
  const failed = () => { setError(true); setLoading(false); onPlaybackError?.() }
  const loaded = () => {
    const total = video.current?.duration || 0
    setPortrait((video.current?.videoHeight || 0) > (video.current?.videoWidth || 0))
    setDuration(Number.isFinite(total) ? total : 0)
    setEnd(Math.min(10, total || 10)); setLoading(false)
  }
  const changeRate = event => { const next = Number(event.target.value); setRate(next); if (video.current) video.current.playbackRate = next }
  const jumpBack = () => { if (video.current) seek(video.current.currentTime - 5) }
  const repeatTime = () => {
    if (!video.current) return
    if (repeat && (video.current.currentTime >= end || video.current.currentTime < start) && end > start) video.current.currentTime = start
    setPosition(video.current.currentTime)
  }
  const seek = value => {
    if (!video.current) return
    const next = Math.max(0, Math.min(duration, value))
    if (repeat && (next < start || next > end)) setRepeat(false)
    video.current.currentTime = next; setPosition(next)
  }
  const toggleCaptions = () => {
    const next = !captions; setCaptions(next)
    for (const track of video.current?.textTracks || []) track.mode = next ? 'showing' : 'hidden'
  }
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else if (playerFrame.current?.requestFullscreen) await playerFrame.current.requestFullscreen()
      else video.current?.webkitEnterFullscreen?.()
    } catch { /* The inline player remains fully usable if fullscreen is unavailable. */ }
  }
  const togglePlayback = () => { if (!video.current) return; if (video.current.paused) video.current.play()?.catch(() => setPlaying(false)); else video.current.pause() }
  const toggleMuted = () => { if (video.current) { video.current.muted = !muted; if (!video.current.muted && video.current.volume === 0) video.current.volume = 1; setMuted(video.current.muted) } }
  const frameLoop = (begin, finish) => setLoopBounds([Math.max(0, begin - 5), Math.min(duration, finish + 5)])
  const toggleRepeat = () => {
    if (repeat) { setRepeat(false); return }
    const begin = Math.max(0, Math.min(video.current?.currentTime || 0, duration - Math.min(10, duration)))
    const finish = Math.min(duration, begin + 10)
    setStart(begin); setEnd(finish); frameLoop(begin, finish); setRepeat(true)
    if (video.current) video.current.currentTime = begin
  }
  const loopRecent = () => { const finish = Math.min(duration, video.current?.currentTime || 5); const begin = Math.max(0, finish - 5); setStart(begin); setEnd(finish); frameLoop(begin, finish); setRepeat(true); if (video.current) video.current.currentTime = begin }
  const gap = Math.min(.5, duration)
  const setLoopStart = value => { const next = Math.max(0, Math.min(end - gap, value)); setStart(next); if (video.current) video.current.currentTime = next }
  const setLoopEnd = value => { const next = Math.min(duration, Math.max(start + gap, value)); setEnd(next); if (video.current && video.current.currentTime >= next) video.current.currentTime = start }
  const ended = () => { setPlaying(false); if (repeat && video.current) { video.current.currentTime = start; video.current.play()?.catch(() => setPlaying(false)) } }
  const retry = () => { setError(false); setLoading(true); video.current?.load() }
  return <section ref={playerFrame} className={`qt-demonstration${repeat ? ' is-repeating' : ''}`} aria-label={`Demonstration: ${title}`}>
    {sample && available && <p className="qt-playback-sample">Playback test clip · not a drill demonstration</p>}
    <div className="qt-media-frame" data-portrait={portrait ? 'true' : undefined} data-landscape={duration > 0 && !portrait ? 'true' : undefined}>
      {available && <video ref={video} key={src} src={src} poster={media?.poster} playsInline muted={muted} onVolumeChange={() => setMuted(!!video.current?.muted || video.current?.volume === 0)} autoPlay={autoPlay} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={ended} onError={failed} onLoadedMetadata={loaded} onCanPlay={() => setLoading(false)} onWaiting={() => setLoading(true)} onPlaying={() => setLoading(false)} onTimeUpdate={repeatTime} onClick={togglePlayback} aria-label={`${title} demonstration`}>
        {media?.captions && <track kind="captions" src={media.captions} srcLang={media.captionLanguage || 'en'} label="Captions" default />}
      </video>}
      {available && !error && <div className="qt-video-overlay-tools">{media?.captions && <button type="button" aria-label={captions ? 'Hide captions' : 'Show captions'} aria-pressed={captions} onClick={toggleCaptions}>CC</button>}<button type="button" aria-label={fullscreen ? 'Exit fullscreen' : 'View video fullscreen'} onClick={toggleFullscreen}><Icon name="expand" size={18} /></button></div>}
      {(!available || error) && <div className="qt-media-unavailable"><div className="qt-pitch" aria-hidden="true"><i /><span /></div><span className="qt-media-symbol"><Icon name={error ? 'warning' : 'video'} size={28} /></span><strong>{error ? 'Video could not play' : sample ? 'Sample demonstration' : 'Demonstration unavailable'}</strong><p>{error ? 'Your practice progress is still here.' : sample ? 'Approved trainer footage will appear here.' : media?.status === 'revoked' ? 'This demonstration is no longer available.' : 'Read the instructions below while the video is unavailable.'}</p>{error && <button className="qt-media-retry" type="button" onClick={retry}>Retry video</button>}</div>}
      {loading && !error && <span className="qt-media-loading" role="status">Loading video…</span>}
      {!available && <span className="qt-media-type">{sample ? 'Sample · no footage' : 'No video'}</span>}
    </div>
    {available && !error && <>
      <div className="qt-video-scrubber"><span>{formatClock(Math.floor(position))}</span><input type="range" min="0" max={duration || 1} step="0.1" value={Math.min(position, duration)} disabled={!duration} aria-label="Video position" aria-valuetext={`${formatClock(Math.floor(position))} of ${formatClock(Math.floor(duration))}`} onChange={event => seek(Number(event.target.value))} style={{ '--played': `${duration ? position / duration * 100 : 0}%` }} /><span>{formatClock(Math.floor(duration))}</span></div>
      <div className="qt-media-tools"><button type="button" onClick={jumpBack} aria-label="Jump back 5 seconds"><Icon name="replay" size={18} />5s</button><label>Speed<select value={rate} onChange={changeRate} aria-label="Playback speed">{[0.5, 0.75, 1, 1.25, 1.5].map(value => <option value={value} key={value}>{value}×</option>)}</select></label><button type="button" className="qt-repeat-toggle" aria-label="Repeat section" aria-pressed={repeat} onClick={toggleRepeat} disabled={!duration || end <= start}><Icon name="replay" size={18} /><span>Repeat</span></button><button type="button" className="qt-mute-toggle" aria-label={muted ? 'Unmute video' : 'Mute video'} aria-pressed={muted} onClick={toggleMuted}><span className={`qt-sound-icon${muted ? ' is-muted' : ''}`}><Icon name="volume" /><Icon name="muted" /></span></button><button type="button" className="qt-playback-toggle" onClick={togglePlayback} aria-label={playing ? 'Pause video' : 'Play video'}><PlayPauseIcon playing={playing} /></button></div>
      <Reveal open={repeat} className="qt-loop-reveal"><div className="qt-loop-editor">
        <div className="qt-loop-labels"><span>A · {loopClock(start)}</span><span>B · {loopClock(end)}</span></div>
        <div className="qt-loop-track" style={{ '--loop-start': `${(start - loopBounds[0]) / (loopBounds[1] - loopBounds[0] || 1) * 100}%`, '--loop-end': `${(end - loopBounds[0]) / (loopBounds[1] - loopBounds[0] || 1) * 100}%` }}>
          <input type="range" aria-label="Repeat start" aria-valuetext={`A: ${loopClock(start)}`} min={loopBounds[0]} max={loopBounds[1]} step="0.1" value={start} onChange={event => setLoopStart(Number(event.target.value))} />
          <input type="range" aria-label="Repeat end" aria-valuetext={`B: ${loopClock(end)}`} min={loopBounds[0]} max={loopBounds[1]} step="0.1" value={end} onChange={event => setLoopEnd(Number(event.target.value))} />
        </div><div className="qt-loop-footer"><span>Drag A and B · zoomed section</span><button type="button" className="qt-loop-recent" onClick={loopRecent} disabled={!duration}><Icon name="replay" size={16} />Loop last 5s</button></div>
      </div></Reveal>
    </>}
  </section>
}
