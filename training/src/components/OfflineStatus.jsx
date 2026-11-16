import { createContext, useContext } from 'react'
import '../styles/offline-status.css'
import { Notice } from './ui.jsx'

export const OfflineContext = createContext(null)
export default function OfflineStatus() {
  const state = useContext(OfflineContext)
  if (!state) return null
  const local = state.source !== 'live' || !state.online || state.error
  if (!local && !state.cacheError && !state.shellError) return null
  return (
    <Notice
      className="pb-offline-status"
      title={
        local ? (state.source === 'recovered' ? 'Recovered practices' : 'Saved library') : 'Offline setup incomplete'
      }
      tone="warning"
      action={state.checking ? undefined : local ? 'Retry' : 'Retry offline setup'}
      onAction={state.retry}
    >
      {local ? (
        <>
          {state.source === 'recovered'
            ? 'Recovered on this device; not a new coach assignment. '
            : 'The library may be out of date. '}
          Videos and coach actions need a connection.
        </>
      ) : (
        state.cacheError || state.shellError
      )}
    </Notice>
  )
}
