import { useId, useLayoutEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import { createPortal } from 'react-dom'

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
  // Close the native modal before React detaches it. Passive cleanup happens
  // after removal and can leave the browser's modal inertness on the main page.
  useLayoutEffect(() => {
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
  const content = <dialog ref={dialog} aria-busy={closing || undefined} className={`qt-dialog ${className}${closing ? ' qt-dialog--closing' : ''}`} aria-labelledby={heading} onCancel={event => { event.preventDefault(); requestClose() }} onClick={event => { if (event.target === dialog.current) requestClose() }}><div className="qt-dialog-inner"><header><h2 id={heading}>{title}</h2><button type="button" className="qt-icon-button" onClick={requestClose} aria-label="Close dialog"><Icon name="close" /></button></header><div key={title} className="qt-dialog-body">{children}</div>{actionContent && <div className="qt-dialog-actions">{actionContent}</div>}</div></dialog>
  // Native modals live outside animated/cloned page content.
  return typeof document === 'undefined' ? content : createPortal(content, document.body)
}
