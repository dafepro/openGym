export function stopStream(stream) { stream?.getTracks?.().forEach(track => track.stop()) }
// Generation ownership prevents late permission responses from reviving a camera.
export function createCameraSession({ request, onStream, onError, onStopped }) {
  let generation = 0
  let stream = null
  const release = () => { const previous = stream; stream = null; stopStream(previous) }
  function stop() { generation += 1; release(); onStopped?.() }
  async function start(facingMode) {
    const token = ++generation
    release()
    onStopped?.()
    try {
      const next = await request({ audio: false, video: { facingMode: { ideal: facingMode }, width: { ideal: 640 }, height: { ideal: 480 } } })
      if (token !== generation) { stopStream(next); return }
      stream = next
      const unavailable = message => { if (token === generation) { stop(); onError(new Error(message)) } }
      next.getVideoTracks().forEach(track => {
        track.addEventListener('ended', () => unavailable('The camera stopped. Enable it again to continue.'), { once: true })
        track.addEventListener('mute', () => unavailable('The camera feed was interrupted. Enable it again and recalibrate to continue.'), { once: true })
      })
      onStream(next)
    } catch (error) { if (token === generation) { release(); onError(error) } }
  }
  return { start, stop }
}
export function cameraError(error) {
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return 'Camera access was denied. Allow camera access in your browser settings, then retry. Timed practice still works.'
  if (error?.name === 'NotFoundError') return 'No camera was found. Connect a camera or continue with timed practice.'
  if (error?.name === 'NotReadableError') return 'The camera is busy. Close other camera apps and retry.'
  return error?.message || 'The camera could not start. Try again or continue with timed practice.'
}
