import { useEffect, useRef, useState } from 'react'
import { extractPracticeCode, readPracticeCode } from '../domain/practice-code.js'
import { Button, Notice } from './ui.jsx'

export default function PracticeImport({ catalog, onOpen }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const submit = async event => {
    event.preventDefault()
    if (pending) return
    setPending(true); setError('')
    try {
      await readPracticeCode(input, catalog)
      if (mounted.current) onOpen(extractPracticeCode(input))
    } catch (failure) { if (mounted.current) setError(failure.message) }
    finally { if (mounted.current) setPending(false) }
  }
  return <form className="pb-import" onSubmit={submit}>
    <p>Got a practice from your coach? Paste the link or complete code here.</p>
    <label className="qt-field">Practice link or code<textarea autoFocus value={input} onChange={event => setInput(event.target.value)} rows={4} maxLength={12300} spellCheck={false} autoCapitalize="none" placeholder="Paste a link or QT2 code" disabled={pending}/></label>
    {error && <Notice title="Check the code" tone="error">{error}</Notice>}
    <Button type="submit" disabled={pending || !input.trim()}>{pending ? 'Opening…' : 'Open practice'}</Button>
    <p className="qt-fine-print">For a QR code, open your phone’s camera and tap the link it finds.</p>
  </form>
}
