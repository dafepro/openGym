import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'

export default function Dialog({ title, children, onClose, actions, className = '' }) {
  const dialog = useRef(null)
  const heading = useId()
  const [closing, setClosing] = useState(false)
  const closeTimer = useRef(null)
  const requestClose = () => {
    if (closeTimer.current) return
    dialog.current?.querySelectorAll('video').forEach(video => video.pause())
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { onClose(); return }
    setClosing(true)
    closeTimer.current = window.setTimeout(onClose, 180)
  }
  useEffect(() => {
    const element = dialog.current
    const before = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    element.showModal()
    return () => { window.clearTimeout(closeTimer.current); element.close(); document.body.style.overflow = overflow; if (before?.isConnected) before.focus?.({ preventScroll: true }) }
  }, [])
  useLayoutEffect(() => {
    const element = dialog.current
    // A confirmation can replace a detail inside the same open dialog.
    // If its triggering button disappeared, restore focus to a safe control.
    if (element?.open && !element.contains(document.activeElement)) element.querySelector('[aria-label="Close dialog"]')?.focus({ preventScroll: true })
  }, [title])
  const actionContent = typeof actions === 'function' ? actions(requestClose) : actions
  return <dialog ref={dialog} className={`qt-dialog ${className}${closing ? ' qt-dialog--closing' : ''}`} aria-labelledby={heading} onCancel={event => { event.preventDefault(); requestClose() }} onClick={event => { if (event.target === dialog.current) requestClose() }}><div className="qt-dialog-inner"><header><h2 id={heading}>{title}</h2><button type="button" className="qt-icon-button" onClick={requestClose} aria-label="Close dialog"><Icon name="close" /></button></header><div className="qt-dialog-body">{children}</div>{actionContent && <div className="qt-dialog-actions">{actionContent}</div>}</div></dialog>
}
