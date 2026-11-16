import { useCallback, useEffect, useRef, useState } from 'react'

// Account records never enter the offline practice cache. Ignore responses from
// an old role/unmounted screen, and clear records when authentication expires.
export default function useAssignments(coach) {
  const endpoint = `/api/${coach ? 'coach' : 'player'}/assignments`
  const generation = useRef(0)
  const [state, setState] = useState({ records: [], loading: true, signedIn: false, error: '', auth: false })
  const [busy, setBusy] = useState(false)
  const refresh = useCallback(async () => {
    const request = ++generation.current
    try {
      const response = await fetch(endpoint, { redirect: 'error' })
      const data = await response.json()
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          if (request === generation.current)
            setState({ records: [], loading: false, signedIn: false, auth: true, error: '' })
          return
        }
        throw new Error(data.error || 'Could not load assignments')
      }
      if (!Array.isArray(data.records)) throw new Error('Assignments unavailable')
      if (request === generation.current)
        setState({ records: data.records, loading: false, signedIn: true, auth: false, error: '' })
    } catch (error) {
      if (request === generation.current)
        setState({
          records: [],
          loading: false,
          signedIn: false,
          auth: false,
          error: error instanceof TypeError ? 'Reconnect or sign in again to load assignments.' : error.message
        })
    }
  }, [endpoint])
  useEffect(() => {
    setState({ records: [], loading: true, signedIn: false, auth: false, error: '' })
    void refresh()
    return () => {
      generation.current++
    }
  }, [refresh])
  async function mutate(input) {
    if (busy) return false
    setBusy(true)
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        redirect: 'error'
      })
      const data = await response.json()
      if (!response.ok) {
        if (response.status === 401 || response.status === 403)
          setState((s) => ({ ...s, records: [], signedIn: false, auth: true }))
        throw new Error(data.error || 'Could not save')
      }
      await refresh()
      return true
    } catch (error) {
      setState((s) => ({ ...s, error: error.message }))
      return false
    } finally {
      setBusy(false)
    }
  }
  return { ...state, busy, refresh, mutate }
}
