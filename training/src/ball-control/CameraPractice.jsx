import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../components/ui.jsx'
import { createCameraSession, cameraError } from './camera-session.js'
import { createFrameFreshness } from './frame-freshness.js'
import { sampleBallColor, detectBall } from './vision/tracker.js'
import { createTargetCounter, validateTargets } from './vision/targets.js'

export default function CameraPractice({ working, disabled, roundKey, supportsScoring, onArrivals, onObservation }) {
  const [status, setStatus] = useState('off')
  const [error, setError] = useState('')
  const [facing, setFacing] = useState('environment')
  const [stream, setStream] = useState(null)
  const [profile, setProfile] = useState(null)
  const [targets, setTargets] = useState([])
  const [detection, setDetection] = useState(null)
  const [tracking, setTracking] = useState('lost')
  const [expected, setExpected] = useState(null)
  const [tool, setTool] = useState('sample')
  const [cursor, setCursor] = useState({ x: .5, y: .5 })
  const [aspect, setAspect] = useState(4 / 3)
  const video = useRef(null), frame = useRef(null), view = useRef(null), session = useRef(null), scorer = useRef(null), previous = useRef(null), lastFrameAt = useRef(-Infinity)
  const arrivalCallback = useRef(onArrivals)
  const observationCallback = useRef(onObservation)
  observationCallback.current = onObservation
  arrivalCallback.current = onArrivals
  const invalidate = useCallback(() => { setProfile(null); setTargets([]); setDetection(null); setTracking('lost'); setExpected(null); previous.current = null; scorer.current = null; setTool('sample'); lastFrameAt.current = -Infinity }, [])

  useEffect(() => {
    let mounted = true
    session.current = createCameraSession({
      request: constraints => navigator.mediaDevices.getUserMedia(constraints),
      onStream: next => { if (mounted) { setStream(next); setStatus('on'); setError('') } },
      onError: issue => { if (mounted) { setError(cameraError(issue)); setStatus('off') } },
      onStopped: () => { if (mounted) { setStream(null); setStatus('off'); invalidate() } },
    })
    const hide = () => { if (document.visibilityState === 'hidden') session.current.stop() }
    const leave = () => session.current.stop()
    document.addEventListener('visibilitychange', hide)
    window.addEventListener('pagehide', leave)
    return () => { mounted = false; session.current.stop(); document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', leave) }
  }, [invalidate])
  useEffect(() => { if (disabled) session.current?.stop() }, [disabled])
  useEffect(() => {
    const element = video.current
    if (!element) return
    element.srcObject = stream
    if (stream) element.play().catch(() => { setError('Tap the preview to start camera playback.') })
    return () => { element.pause(); element.srcObject = null }
  }, [stream])
  useEffect(() => {
    if (!stream) return
    let lastRect = view.current?.getBoundingClientRect()
    const changed = () => {
      const rect = view.current?.getBoundingClientRect()
      if (rect && lastRect && (Math.abs(rect.width - lastRect.width) > 1 || Math.abs(rect.height - lastRect.height) > 1)) { lastRect = rect; invalidate(); setError('Preview size changed. Sample the ball and set both targets again.') }
    }
    const orientation = () => { invalidate(); setError('Orientation changed. Sample the ball and set both targets again.') }
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(changed) : null
    if (view.current) observer?.observe(view.current)
    window.addEventListener('resize', changed); window.addEventListener('orientationchange', orientation)
    return () => { observer?.disconnect(); window.removeEventListener('resize', changed); window.removeEventListener('orientationchange', orientation) }
  }, [stream, invalidate])
  useEffect(() => {
    scorer.current = null; setExpected(null); setTracking('acquiring')
    if (!working || !supportsScoring || !profile || !validateTargets(targets)) return
    try { scorer.current = { counter: createTargetCounter(targets, { aspectRatio: aspect }), count: 0 } }
    catch (issue) { setError(issue.message); setTargets([]) }
  }, [working, roundKey, supportsScoring, profile, targets, aspect])
  useEffect(() => {
    if (!stream) return
    let animation, frameCallback, stopped = false, last = -Infinity, dimensions = '', presentedToken = null
    const element = video.current
    const freshness = createFrameFreshness()
    const presentationFrames = typeof element?.requestVideoFrameCallback === 'function'
    const presented = (_timestamp, metadata) => {
      if (stopped) return
      presentedToken = metadata.presentedFrames ?? metadata.mediaTime
      frameCallback = element.requestVideoFrameCallback(presented)
    }
    if (presentationFrames) frameCallback = element.requestVideoFrameCallback(presented)
    const tick = timestamp => {
      if (stopped) return
      const element = video.current
      if (timestamp - last >= 90) {
        last = timestamp
        const readable = element?.readyState >= 2 && element.videoWidth && element.videoHeight
        const freshnessState = freshness.observe(readable ? presentationFrames ? presentedToken : element.currentTime : null, timestamp)
        if (!freshnessState.fresh) {
          if (freshnessState.lost) {
            previous.current = null; setDetection(null); setTracking('lost'); setExpected(null)
            if (working && scorer.current) scorer.current.counter.update(null, timestamp)
          }
          animation = requestAnimationFrame(tick)
          return
        }
        lastFrameAt.current = timestamp
        const size = `${element.videoWidth}:${element.videoHeight}`
        if (dimensions && dimensions !== size) { invalidate(); setError('Camera dimensions changed. Recalibrate before scoring.') }
        dimensions = size
        const ratio = element.videoWidth / element.videoHeight
        setAspect(ratio)
        const canvas = frame.current
        canvas.width = 256; canvas.height = Math.max(1, Math.round(256 / ratio))
        try {
          const context = canvas.getContext('2d', { willReadFrequently: true })
          context.drawImage(element, 0, 0, canvas.width, canvas.height)
          const found = profile ? detectBall(context.getImageData(0, 0, canvas.width, canvas.height), profile, previous.current) : null
          previous.current = found; setDetection(found)
          setTracking(found ? (found.confidence >= .65 ? 'tracking' : 'acquiring') : 'lost')
          const active = scorer.current
          if (working && active) {
            if (found?.confidence >= .65) observationCallback.current?.()
            const result = active.counter.update(found, timestamp)
            const increment = result.count - active.count
            active.count = result.count
            if (increment > 0) arrivalCallback.current(increment)
            setTracking(result.tracking); setExpected(result.expectedTarget)
          }
        } catch (issue) { scorer.current = null; setError(`Camera analysis stopped: ${issue.message}`); session.current.stop() }
      }
      animation = requestAnimationFrame(tick)
    }
    animation = requestAnimationFrame(tick)
    return () => { stopped = true; cancelAnimationFrame(animation); if (frameCallback !== undefined) element?.cancelVideoFrameCallback?.(frameCallback) }
  }, [stream, profile, working, invalidate])

  const enable = nextFacing => {
    if (disabled) return
    setError('')
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setError('Camera access needs a supported browser on HTTPS. Timed practice is ready without it.'); return }
    session.current.start(nextFacing); setStatus('requesting')
  }
  const mark = point => {
    if (working || disabled || !stream) return
    setCursor(point); setError('')
    if (tool === 'sample') {
      const canvas = frame.current
      try {
        if (!canvas?.width || video.current?.readyState < 2 || performance.now() - lastFrameAt.current > 250) throw new Error('Wait until the camera preview is visible, then sample the ball.')
        setProfile(sampleBallColor(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height), point)); setTargets([]); setTool('a')
      } catch (issue) { setError(issue.message) }
    } else {
      const index = tool === 'a' ? 0 : 1
      const next = [...targets]; next[index] = { ...point, radius: .075 }
      if (index === 1 && !next[0]) { setError('Set target A first.'); setTool('a'); return }
      if (next.length === 2) {
        try { if (!validateTargets(next)) throw new Error('Keep targets separated and fully inside the image.'); createTargetCounter(next, { aspectRatio: aspect }) }
        catch (issue) { setError(issue.message); return }
      }
      setTargets(next); if (index === 0) setTool('b')
    }
  }
  const keyboard = event => {
    const moves = { ArrowLeft: [-.02, 0], ArrowRight: [.02, 0], ArrowUp: [0, -.02], ArrowDown: [0, .02] }
    if (moves[event.key]) { event.preventDefault(); const [x, y] = moves[event.key]; setCursor(current => ({ x: Math.min(.98, Math.max(.02, current.x + x)), y: Math.min(.98, Math.max(.02, current.y + y)) })) }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); mark(cursor) }
  }
  const ready = profile && targets.length === 2
  return <section className="bc-card bc-camera" aria-labelledby="bc-camera-title">
    <div className="bc-section-heading"><div><p className="qt-eyebrow">Optional · device only</p><h2 id="bc-camera-title" tabIndex={-1}>Camera lab</h2></div><span className="bc-pill">Experimental</span></div>
    <p className="bc-muted">See the ball move between two targets. This observes arrivals, not foot contact or correct technique. Frames stay on this device; nothing is recorded or uploaded.</p>
    <label className="bc-field">Camera<select value={facing} disabled={disabled || working} onChange={event => { setFacing(event.target.value); if (status !== 'off') enable(event.target.value) }}><option value="environment">Rear / environment</option><option value="user">Front / selfie</option></select></label>
    {status === 'off' ? <Button variant="secondary" disabled={disabled} onClick={() => enable(facing)}>Enable camera</Button> : <Button variant="secondary" onClick={() => session.current.stop()}>{status === 'requesting' ? 'Cancel camera request' : 'Disable camera'}</Button>}
    {status === 'requesting' && <p role="status" className="bc-muted">Waiting for browser permission. You can cancel this request.</p>}
    {error && <p className="bc-error" role="alert">{error}</p>}
    {stream && <>
      <p className="bc-muted">Prop your phone securely. Keep both feet, the ball and the full practice area visible. The preview is unmirrored. Pause the round to change calibration.</p>
      <div ref={view} className="bc-camera-view" style={{ aspectRatio: aspect }} tabIndex={0} role="button" aria-label={`Calibration preview. ${tool === 'sample' ? 'Sample ball color' : `Set target ${tool.toUpperCase()}`}. Use arrow keys to move the crosshair, then Enter to place.`} aria-disabled={working || disabled} onKeyDown={keyboard} onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); mark({ x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) }); video.current?.play().catch(() => {}) }}>
        <video ref={video} muted playsInline aria-label="Live unmirrored camera preview" onLoadedMetadata={event => { const element = event.currentTarget; if (element.videoWidth) setAspect(element.videoWidth / element.videoHeight) }} />
        <svg viewBox={`0 0 1000 ${1000 / aspect}`} aria-hidden="true">
          {targets.map((target, index) => <g key={index}><circle cx={target.x * 1000} cy={target.y * 1000 / aspect} r={target.radius * 1000} className={expected === index ? 'bc-target bc-target-next' : 'bc-target'} /><text x={target.x * 1000} y={target.y * 1000 / aspect} textAnchor="middle" dy=".35em">{index === 0 ? 'A' : 'B'}</text></g>)}
          {detection && <circle cx={detection.x * 1000} cy={detection.y * 1000 / aspect} r={Math.max(8, detection.radius * 1000)} className="bc-detected" />}
          {!working && <g className="bc-crosshair"><path d={`M${cursor.x * 1000 - 13},${cursor.y * 1000 / aspect}h26 M${cursor.x * 1000},${cursor.y * 1000 / aspect - 13}v26`} /></g>}
        </svg>
      </div>
      <div className="bc-calibration" aria-label="Calibration tools">{[['sample', '1 · Sample ball'], ['a', '2 · Target A'], ['b', '3 · Target B']].map(([value, label]) => <button type="button" key={value} aria-pressed={tool === value} disabled={working || disabled || value !== 'sample' && !profile} onClick={() => setTool(value)}>{label}</button>)}</div>
      <p className="bc-muted">{tool === 'sample' ? 'Tap a clearly colored patch of the ball. Avoid glare, white panels and shadows.' : `Park the ball at endpoint ${tool.toUpperCase()}, then tap the visible center of the ball. Repeat at the other endpoint. Choose separated endpoints within comfortable reach, with the whole ball away from the image edges. Targets mark projected ball centers in this image.`} Keyboard: focus the preview, move with arrows, press Enter.</p>
      <p className="bc-tracking" role="status">{!profile ? 'Sample the ball to begin.' : !ready ? 'Ball color sampled · set both targets.' : `${tracking === 'tracking' ? 'Ball observed' : tracking === 'acquiring' ? 'Acquiring a stable ball' : 'Ball not found'} · ${working && supportsScoring ? expected === null ? 'Hold the ball in either target to arm' : `Next target: ${expected === 0 ? 'A' : 'B'}` : 'Scoring waits for active practice'}`}</p>
      {!supportsScoring && <p className="bc-muted">This drill uses timed guidance and optional manual repetitions. Camera arrivals are supported only for the two sole-roll drills.</p>}
      {ready && <p className="bc-muted">Targets ready. Park the ball at a calibrated endpoint, hold briefly, then roll to the other endpoint. Loss of visibility requires a fresh stable observation before scoring resumes.</p>}
    </>}
    <canvas ref={frame} hidden aria-hidden="true" />
  </section>
}
