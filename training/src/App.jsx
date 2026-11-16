import { lazy, Suspense, useEffect, useState } from 'react'
import { APP_CONFIG } from './config.js'
import { useHashRoute } from './lib/routes.js'
import TrainingExperience from './components/TrainingExperience.jsx'
import TrainingShell from './components/TrainingShell.jsx'
import TextAlertsView from './views/TextAlertsView.jsx'
import { LoadingState, Notice } from './components/ui.jsx'
import useOfflineCatalog from './controllers/useOfflineCatalog.js'
import { prepareOfflineShell } from './controllers/offline-shell.js'
import { OfflineContext } from './components/OfflineStatus.jsx'
import { ROUTES } from './lib/routes.js'
import useTrainingController from './controllers/useTrainingController.js'

// Compile-time branching removes the sample module entirely from the default build.
const DemoShell = __TRAINING_DEMO__ ? lazy(() => import('./demo/DemoShell.jsx')) : null
const PrivatePreviewShell = __TRAINING_PRIVATE_PREVIEW__
  ? lazy(() => import('./preview/PrivatePreviewShell.jsx'))
  : null

export default function App() {
  const route = useHashRoute()
  if (PrivatePreviewShell) return <Suspense fallback={<TrainingShell page={route} localPreview><LoadingState label="Opening local preview…" /></TrainingShell>}><PrivatePreviewShell route={route} /></Suspense>
  if (DemoShell) return <Suspense fallback={<TrainingShell page={route} sample><LoadingState label="Opening sample practice…" /></TrainingShell>}><DemoShell route={route} /></Suspense>
  if (route === 'texts') return <TrainingShell page={route} sourceUrl={APP_CONFIG.sourceUrl} onNavigate={page => { window.location.hash = ROUTES[page] }}><TextAlertsView /></TrainingShell>
  return <TrainingApplication route={route} />
}

function TrainingApplication({ route }) {
  const controller = useTrainingController({ databaseName: APP_CONFIG.storageDatabase })
  const state = useOfflineCatalog(controller, APP_CONFIG.storageDatabase)
  const { catalog, error, checking, retry } = state
  const [shellError, setShellError] = useState(null)
  useEffect(() => {
    // Production only: samples and private previews never install an offline shell.
    if (!import.meta.env.PROD) return
    if (!('serviceWorker' in navigator)) {
      setShellError('This browser cannot reopen the app offline. Keep this tab open while practicing.')
      return
    }
    let disposed = false
    prepareOfflineShell(navigator.serviceWorker)
      .then(() => {
        if (!disposed) setShellError(null)
      })
      .catch(() => {
        if (!disposed)
          setShellError(
            'The app could not be prepared for offline reopening. Keep this tab open and reconnect to try again.'
          )
      })
    return () => {
      disposed = true
    }
  }, [state.online, state.retryToken])
  if (!catalog)
    return (
      <TrainingShell
        page={route}
        sourceUrl={APP_CONFIG.sourceUrl}
        onNavigate={(page) => {
          window.location.hash = ROUTES[page]
        }}
      >
        {error && !checking ? (
          <Notice title="No practice available offline yet" tone="warning" action="Try again" onAction={retry}>
            Connect once to load the library. Any existing progress is kept on this device.
          </Notice>
        ) : (
          <LoadingState label="Opening your practice…" />
        )}
        {controller.error && (
          <Notice title="Local progress needs attention" tone="warning">
            {controller.error}
          </Notice>
        )}
      </TrainingShell>
    )
  return (
    <OfflineContext.Provider value={{ ...state, shellError }}>
      <TrainingExperience route={route} catalog={catalog} controller={controller} sample={catalog.synthetic === true} />
    </OfflineContext.Provider>
  )
}
