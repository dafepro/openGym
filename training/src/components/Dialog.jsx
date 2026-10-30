import { useEffect, useId, useRef } from 'react'
import Icon from './Icon.jsx'

export default function Dialog({ title, children, onClose, actions }) {
  const dialog = useRef(null)
  const heading = useId()
  useEffect(() => {
    const element = dialog.current
    const before = document.activeElement
    element.showModal()
    return () => { element.close(); if (before?.isConnected) before.focus?.() }
  }, [])
  return <dialog ref={dialog} className="qt-dialog" aria-labelledby={heading} onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === dialog.current) onClose() }}><div className="qt-dialog-inner"><header><h2 id={heading}>{title}</h2><button type="button" className="qt-icon-button" onClick={onClose} aria-label="Close dialog"><Icon name="close" /></button></header><div className="qt-dialog-body">{children}</div>{actions && <div className="qt-dialog-actions">{actions}</div>}</div></dialog>
}
