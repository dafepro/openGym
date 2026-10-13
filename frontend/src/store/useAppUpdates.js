import { create } from 'zustand'
import { useStore } from './useStore.js'

export const useAppUpdates = create(() => ({ waiting: null, busy: false, error: '', dismissed: false }))
let registration = null
export async function startAppUpdates(sw = navigator.serviceWorker) {
  if (!sw) return
  try {
    registration = await sw.register('sw.js', { updateViaCache: 'none' })
    const detect = () => {
      if (registration.waiting && sw.controller) useAppUpdates.setState({ waiting: registration.waiting, dismissed: false })
    }
    detect()
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing
      installing?.addEventListener('statechange', detect)
    })
    sw.addEventListener('controllerchange', () => {
      // Another tab may accept the release. Only an explicit click in this tab
      // may reload it; its current workout remains usable and saved locally.
      if (!useAppUpdates.getState().busy) useAppUpdates.setState({ waiting: null })
    })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void registration.update().catch(() => {})
    })
  } catch { /* An offline first visit keeps the running app usable. */ }
}

export async function applyAppUpdate(sw = navigator.serviceWorker, reload = () => location.reload()) {
  const waiting = useAppUpdates.getState().waiting
  if (!waiting || useAppUpdates.getState().busy) return
  useAppUpdates.setState({ busy: true, error: '' })
  try {
    await useStore.getState().saveForUpdate()
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { cleanup(); reject(new Error('Update did not activate. Try again.')) }, 15000)
      const changed = () => { cleanup(); resolve() }
      const cleanup = () => { clearTimeout(timeout); sw.removeEventListener('controllerchange', changed) }
      sw.addEventListener('controllerchange', changed)
      // It may already have activated in another tab while the save completed.
      if (waiting.state === 'activated') changed()
      else waiting.postMessage({ type: 'UPLIFT_ACTIVATE' })
    })
    await useStore.getState().saveForUpdate()
    reload()
  } catch (e) { useAppUpdates.setState({ error: e.message }) }
  finally { useAppUpdates.setState({ busy: false }) }
}
