import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import PlayPauseIcon from './PlayPauseIcon.jsx'
import { formatClock } from './ui.jsx'

// Only an approved, resolved first-party URL enters this component. It never discovers media.
export default function DrillDemonstration({ media, title, workActive = false, autoPlay = false, playerRef, sample = false, onPlaybackError }) {
  const localVideo = useRef(null)
  const video = playerRef || localVideo
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rate, setRate] = useState(1)
  const [repeat, setRepeat] = useState(false)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(10)
  const [duration, setDuration] = useState(0)
  const [portrait, setPortrait] = useState(false)
  const src = media?.url || media?.path
  const approvedPath = typeof media?.id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(media.id) && src === `/media/${media.id}`
  const available = approvedPath && media?.status === 'approved'
  useEffect(() => { setError(false); setLoading(false); setRepeat(false); setRate(1); setDuration(0); setStart(0); setEnd(10); setPortrait(!!video.current && video.current.videoHeight > video.current.videoWidth); if (video.current) video.current.playbackRate = 1 }, [src, title, available])
  useEffect(() => { if (workActive && !autoPlay) video.current?.pause() }, [workActive, autoPlay])
  useEffect(() => { if (autoPlay && available) { const attempt = video.current?.play(); attempt?.catch(() => setPlaying(false)) } }, [autoPlay, available, src])
  useEffect(() => { const player = video.current; return () => player?.pause() }, [src, title, available])
  const failed = () => { setError(true); setLoading(false); onPlaybackError?.() }
  const loaded = () => {
    const total = video.current?.duration || 0
    setPortrait((video.current?.videoHeight || 0) > (video.current?.videoWidth || 0))
    setDuration(Number.isFinite(total) ? total : 0)
    setEnd(Math.min(10, total || 10)); setLoading(false)
  }
  const changeRate = event => { const next = Number(event.target.value); setRate(next); if (video.current) video.current.playbackRate = next }
  const jumpBack = () => { if (video.current) video.current.currentTime = Math.max(0, video.current.currentTime - 5) }
  const repeatTime = () => { if (repeat && video.current && (video.current.currentTime >= end || video.current.currentTime < start) && end > start) video.current.currentTime = start }
  const togglePlayback = () => { if (!video.current) return; if (video.current.paused) video.current.play()?.catch(() => setPlaying(false)); else video.current.pause() }
  const loopRecent = () => { const finish = Math.min(duration, video.current?.currentTime || 5); const begin = Math.max(0, finish - 5); setStart(begin); setEnd(finish); setRepeat(true); if (video.current) video.current.currentTime = begin }
  const gap = Math.min(.5, duration)
  const setLoopStart = value => { const next = Math.max(0, Math.min(end - gap, value)); setStart(next); if (video.current) video.current.currentTime = next }
  const setLoopEnd = value => { const next = Math.min(duration, Math.max(start + gap, value)); setEnd(next); if (video.current && video.current.currentTime >= next) video.current.currentTime = start }
  const ended = () => { setPlaying(false); if (repeat && video.current) { video.current.currentTime = start; video.current.play()?.catch(() => setPlaying(false)) } }
  const retry = () => { setError(false); setLoading(true); video.current?.load() }
  return <section className="qt-demonstration" aria-label={`Demonstration: ${title}`}>
    {sample && available && <p className="qt-playback-sample">Playback test clip · not a drill demonstration</p>}
    <div className="qt-media-frame" data-portrait={portrait ? 'true' : undefined}>
      {available && <video ref={video} key={src} src={src} poster={media?.poster} controls playsInline autoPlay={autoPlay} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={ended} onError={failed} onLoadedMetadata={loaded} onCanPlay={() => setLoading(false)} onWaiting={() => setLoading(true)} onPlaying={() => setLoading(false)} onTimeUpdate={repeatTime} aria-label={`${title} demonstration`}>
        {media?.captions && <track kind="captions" src={media.captions} srcLang={media.captionLanguage || 'en'} label="Captions" default />}
      </video>}
      {(!available || error) && <div className="qt-media-unavailable"><div className="qt-pitch" aria-hidden="true"><i /><span /></div><span className="qt-media-symbol"><Icon name={error ? 'warning' : 'video'} size={28} /></span><strong>{error ? 'Video could not play' : sample ? 'Sample demonstration' : 'Demonstration unavailable'}</strong><p>{error ? 'Your practice progress is still here.' : sample ? 'Approved trainer footage will appear here.' : media?.status === 'revoked' ? 'This demonstration is no longer available.' : 'Read the instructions below while the video is unavailable.'}</p>{error && <button className="qt-media-retry" type="button" onClick={retry}>Retry video</button>}</div>}
      {loading && !error && <span className="qt-media-loading" role="status">Loading video…</span>}
      {!available && <span className="qt-media-type">{sample ? 'Sample · no footage' : 'No video'}</span>}
    </div>
    {available && !error && <>
      <div className="qt-media-tools"><button type="button" className="qt-playback-toggle" onClick={togglePlayback} aria-label={playing ? 'Pause video' : 'Play video'}><PlayPauseIcon playing={playing} /></button><button type="button" onClick={jumpBack} aria-label="Jump back 5 seconds"><Icon name="replay" size={18} />5s</button><label>Speed<select value={rate} onChange={changeRate} aria-label="Playback speed">{[0.5, 0.75, 1, 1.25, 1.5].map(value => <option value={value} key={value}>{value}×</option>)}</select></label><button type="button" aria-pressed={repeat} onClick={() => { if (!repeat && video.current) video.current.currentTime = start; setRepeat(value => !value) }} disabled={!duration || end <= start}>Repeat</button></div>
      {repeat && <div className="qt-loop-editor">
        <div className="qt-loop-labels"><span>A · {formatClock(Math.floor(start))}</span><span>B · {formatClock(Math.floor(end))}</span></div>
        <div className="qt-loop-track" style={{ '--loop-start': `${start / duration * 100}%`, '--loop-end': `${end / duration * 100}%` }}>
          <input type="range" aria-label="Repeat start" aria-valuetext={`A: ${formatClock(Math.floor(start))}`} min="0" max={duration} step="0.1" value={start} onChange={event => setLoopStart(Number(event.target.value))} />
          <input type="range" aria-label="Repeat end" aria-valuetext={`B: ${formatClock(Math.floor(end))}`} min="0" max={duration} step="0.1" value={end} onChange={event => setLoopEnd(Number(event.target.value))} />
        </div><p>Drag the handles to choose what repeats.</p>
      </div>}
      <button type="button" className="qt-loop-recent" onClick={loopRecent} disabled={!duration}><Icon name="replay" size={16} />Loop last 5s</button>
    </>}
  </section>
}
