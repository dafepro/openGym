import Disclosure from './Disclosure.jsx'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPracticeCode } from '../domain/practice-code.js'
import { Button, Notice } from './ui.jsx'

function PracticeQR({ link }) {
  const [matrix, setMatrix] = useState(null)
  const [error, setError] = useState(false)
  const frame = useRef(null)
  const [pixels, setPixels] = useState(0)
  useEffect(() => {
    let current = true
    setError(false); setMatrix(null)
    if (!link) return () => { current = false }
    import('qrcode').then(({ default: QRCode }) => {
      const result = QRCode.create(link, { errorCorrectionLevel: 'M' }).modules
      if (current) setMatrix(result)
    }).catch(() => { if (current) setError(true) })
    return () => { current = false }
  }, [link])
  useLayoutEffect(() => {
    if (!matrix || !frame.current) return
    const resize = () => {
      const ratio = window.devicePixelRatio || 1
      const cells = matrix.size + 8
      const scale = Math.floor(frame.current.clientWidth * ratio / cells)
      setPixels(scale >= 2 ? cells * scale / ratio : 0)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(frame.current)
    window.addEventListener('resize', resize)
    return () => { observer.disconnect(); window.removeEventListener('resize', resize) }
  }, [matrix])
  if (error) return <p className="qt-fine-print">This practice is too detailed for a QR code. Use Copy link.</p>
  if (!matrix) return <div className="pb-qr-placeholder" role="status">Preparing QR…</div>
  const path = []
  for (let y = 0; y < matrix.size; y++) for (let x = 0; x < matrix.size; x++) if (matrix.data[y * matrix.size + x]) path.push(`M${x + 4} ${y + 4}h1v1h-1z`)
  return <div ref={frame} className="pb-qr-frame" style={{ maxWidth: Math.min(400, (matrix.size + 8) * 4), marginInline: 'auto' }}>{pixels ? <svg style={{ width: pixels, height: pixels }} className="pb-practice-qr" viewBox={`0 0 ${matrix.size + 8} ${matrix.size + 8}`} role="img" aria-label="Scan to open this practice" shapeRendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d={path.join('')} fill="#242824"/></svg> : <p className="qt-fine-print">Use Copy link, or open this pass on a larger screen to scan it.</p>}</div>
}

export default function PracticeShare({ assignment, catalog }) {
  const [share, setShare] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const linkField = useRef(null)
  const codeField = useRef(null)
  const [fallbackCopy, setFallbackCopy] = useState(null)
  useEffect(() => {
    let current = true
    setShare(null); setError(''); setMessage('')
    createPracticeCode(assignment, window.location.origin, catalog).then(value => { if (current) setShare(value) }).catch(failure => { if (current) setError(failure.message) })
    return () => { current = false }
  }, [assignment, catalog])
  const copy = async (value, kind) => {
    try { await navigator.clipboard.writeText(value); setMessage('Copied. Ready to send.') }
    catch { setFallbackCopy({ kind }); setDetailsOpen(true); setMessage(`Select the ${kind} below to copy it.`) }
  }
  useEffect(() => {
    if (!detailsOpen || !fallbackCopy) return
    const field = fallbackCopy.kind === 'code' ? codeField.current : linkField.current
    let live = true
    const frame = requestAnimationFrame(async () => {
      const reveal = field?.closest('.qt-reveal')
      reveal?.getBoundingClientRect()
      await Promise.all((reveal?.getAnimations() || []).map(animation => animation.finished.catch(() => {})))
      if (live) { field?.focus(); field?.select(); setFallbackCopy(null) }
    })
    return () => { live = false; cancelAnimationFrame(frame) }
  }, [detailsOpen, fallbackCopy])
  if (error) return <Notice title="Could not create a code" tone="error">{error}</Notice>
  return <div className="pb-share-card">
    <p className="qt-eyebrow">Practice pass · {share?.label || "Preparing code"}</p>
    <h2>{assignment.title}</h2>
    <PracticeQR key={share?.link || "pending"} link={share?.link}/>
    <p>Scan with your phone camera to open and save this practice.</p>
    <div className="qt-field-grid"><Button icon="share" disabled={!share} onClick={() => copy(share.link, 'link')}>Copy link</Button><Button variant="secondary" disabled={!share} onClick={() => copy(share.code, 'code')}>Copy code</Button></div>
    {share && <Disclosure className="pb-share-details" summary="View link and code" open={detailsOpen} onOpenChange={setDetailsOpen}><label className="qt-field">Practice link<textarea ref={linkField} readOnly value={share.link} onFocus={event => event.target.select()}/></label><label className="qt-field">Practice code<textarea ref={codeField} readOnly value={share.code} onFocus={event => event.target.select()}/></label></Disclosure>}
    <p className="qt-fine-print">Includes drills, instructions and targets. Anyone with the link can open it.</p>
    <p role="status">{message}</p>
  </div>
}
