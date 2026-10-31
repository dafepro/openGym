import { useEffect, useId, useRef } from 'react'
import Icon from './Icon.jsx'

export default function Dialog({ title, children, onClose, actions, className = '' }) {
  const dialog = useRef(null)
  const heading = useId()
  useEffect(() => {
    const element = dialog.current
    const before = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    element.showModal()
    return () => { element.close(); document.body.style.overflow = overflow; if (before?.isConnected) before.focus?.({ preventScroll: true }) }
  }, [])
  return <dialog ref={dialog} className={`qt-dialog ${className}`} aria-labelledby={heading} onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === dialog.current) onClose() }}><div className="qt-dialog-inner"><header><h2 id={heading}>{title}</h2><button type="button" className="qt-icon-button" onClick={onClose} aria-label="Close dialog"><Icon name="close" /></button></header><div className="qt-dialog-body">{children}</div>{actions && <div className="qt-dialog-actions">{actions}</div>}</div></dialog>
}
