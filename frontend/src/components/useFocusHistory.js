import { useEffect, useRef } from 'react'
import { useUI } from '../store/useUI.js'

// One same-URL entry owns an inline editor or the workout overview. The base Focus
// layout is the workout route, so Back leaves the page once its details are closed.
export default function useFocusHistory(open, dismiss) {
  const handler = useRef(dismiss)
  handler.current = dismiss
  // Reuse a surviving entry after a development remount or reload. Pushing another
  // marker on top would make the first Back press appear to do nothing.
  const entry = useRef(window.history?.state?.openGymFocus ? window.location.href : null)
  const suppress = useRef(false)
  const sheets = useUI(s => s.sheets?.length || 0)
  const push = () => {
    entry.current = window.location.href
    window.history.pushState({ ...window.history.state, openGymSheet: false, openGymFocus: true }, '')
  }
  useEffect(() => {
    if (open && !entry.current && !suppress.current) push()
    else if (!open && entry.current && !sheets) {
      const samePage = entry.current === window.location.href
      if (!samePage) entry.current = null
      else if (window.history.state?.openGymFocus) {
        entry.current = null
        suppress.current = true; window.history.back()
      }
    }
  }, [open, sheets])
  useEffect(() => {
    const pop = event => {
      if (suppress.current) {
        suppress.current = false
        // A fast reopen can occur before the asynchronous rewind arrives.
        if (useUI.getState().focusDetailsOpen && !entry.current) push()
        return
      }
      // Modals owns its own entries, above the workspace's entry.
      if (useUI.getState().sheets.length) return
      // A sheet closed by its own button rewinds onto this entry after its store
      // has already closed. That pop returns ownership; it does not dismiss focus.
      if (event.state?.openGymFocus) {
        // A completed workout, reload or route change may leave a marker behind.
        // Skip it automatically while closed instead of requiring an empty Back.
        if (!useUI.getState().focusDetailsOpen) {
          entry.current = null
          suppress.current = true; window.history.back()
        }
        return
      }
      if (!entry.current) return
      entry.current = null
      if (useUI.getState().focusDetailsOpen) {
        handler.current()
        if (useUI.getState().focusDetailsOpen) push()
      }
    }
    window.addEventListener('popstate', pop)
    return () => window.removeEventListener('popstate', pop)
  }, [])
}
