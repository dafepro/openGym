import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import { formatClock } from './ui.jsx'

// Only an approved, resolved first-party URL enters this component. It never discovers media.
export default function DrillDemonstration({ media, title, workActive = false, sample = false, onPlaybackError }) {
  const video = useRef(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rate, setRate] = useState(1)
  const [repeat, setRepeat] = useState(false)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(10)
  const [duration, setDuration] = useState(0)
  const src = media?.url || media?.path
  const approvedPath = typeof src === 'string' && /^\/media\/[a-zA-Z0-9/_-]+(?:\.[a-zA-Z0-9]+)?$/.test(src)
  const available = approvedPath && media?.status === 'approved'
  useEffect(() => { setError(false); setLoading(false); setRepeat(false); setRate(1); setDuration(0); setStart(0); setEnd(10) }, [src])
  useEffect(() => { if (workActive) video.current?.pause() }, [workActive])
  useEffect(() => { const player = video.current; return () => player?.pause() }, [src])
  const failed = () => { setError(true); setLoading(false); onPlaybackError?.() }
  const loaded = () => {
    const total = video.current?.duration || 0
    setDuration(Number.isFinite(total) ? total : 0)
    setEnd(Math.min(10, total || 10)); setLoading(false)
  }
  const changeRate = event => { const next = Number(event.target.value); setRate(next); if (video.current) video.current.playbackRate = next }
  const jumpBack = () => { if (video.current) video.current.currentTime = Math.max(0, video.current.currentTime - 5) }
  const repeatTime = () => { if (repeat && video.current && video.current.currentTime >= end && end > start) video.current.currentTime = start }
  const retry = () => { setError(false); setLoading(true); video.current?.load() }
  return <section className="qt-demonstration" aria-label={`Demonstration: ${title}`}>
    <div className="qt-media-frame">
      {available && <video ref={video} key={src} src={src} poster={media?.poster} controls playsInline preload="metadata" onError={failed} onLoadedMetadata={loaded} onCanPlay={() => setLoading(false)} onWaiting={() => setLoading(true)} onPlaying={() => setLoading(false)} onTimeUpdate={repeatTime} aria-label={`${title} demonstration`}>
        {media?.captions && <track kind="captions" src={media.captions} srcLang={media.captionLanguage || 'en'} label="Captions" default />}
      </video>}
      {(!available || error) && <div className="qt-media-unavailable"><div className="qt-pitch" aria-hidden="true"><i /><span /></div><span className="qt-media-symbol"><Icon name={error ? 'warning' : 'video'} size={28} /></span><strong>{error ? 'Video could not play' : sample ? 'Sample demonstration' : 'Demonstration unavailable'}</strong><p>{error ? 'Your practice progress is still here.' : sample ? 'Approved trainer footage will appear here.' : media?.status === 'revoked' ? 'This demonstration is no longer available.' : 'Read the instructions below while the video is unavailable.'}</p>{error && <button className="qt-media-retry" type="button" onClick={retry}>Retry video</button>}</div>}
      {loading && !error && <span className="qt-media-loading" role="status">Loading video…</span>}
      {!available && <span className="qt-media-type">{sample ? 'Sample · no footage' : 'No video'}</span>}
    </div>
    {available && !error && <div className="qt-media-tools"><button type="button" onClick={jumpBack} aria-label="Jump back 5 seconds"><Icon name="replay" size={18} />5s</button><label>Speed<select value={rate} onChange={changeRate} aria-label="Playback speed">{[0.5, 0.75, 1, 1.25, 1.5].map(value => <option value={value} key={value}>{value}×</option>)}</select></label><button type="button" aria-pressed={repeat} onClick={() => setRepeat(value => !value)} disabled={!duration || end <= start}>Repeat section</button>
      {repeat && <div className="qt-repeat-range"><label>From <input type="number" min="0" max={Math.max(0, end - 1)} step="1" value={start} onChange={e => setStart(Math.max(0, Math.min(end - 1, Number(e.target.value))))} />s</label><label>To <input type="number" min={start + 1} max={duration} step="1" value={end} onChange={e => setEnd(Math.max(start + 1, Math.min(duration, Number(e.target.value))))} />s</label><span>{formatClock(start)}–{formatClock(end)}</span></div>}
    </div>}
  </section>
}
