import { lazy, Suspense, useEffect, useState } from 'react'
import { APP_CONFIG } from './config.js'
import { useHashRoute } from './lib/routes.js'
import TrainingExperience from './components/TrainingExperience.jsx'
import TrainingShell from './components/TrainingShell.jsx'
import { LoadingState, Notice } from './components/ui.jsx'
import { fetchTrainingCatalog } from './controllers/training-catalog.js'
import { ROUTES } from './lib/routes.js'
import useTrainingController from './controllers/useTrainingController.js'

// Compile-time branching removes the sample module entirely from the default build.
const DemoShell = __TRAINING_DEMO__ ? lazy(() => import('./demo/DemoShell.jsx')) : null
const PrivatePreviewShell = __TRAINING_PRIVATE_PREVIEW__ ? lazy(() => import('./preview/PrivatePreviewShell.jsx')) : null

export default function App() {
  const route = useHashRoute()
  if (PrivatePreviewShell) return <Suspense fallback={<p role="status">Opening local private preview…</p>}><PrivatePreviewShell route={route} /></Suspense>
  if (DemoShell) return <Suspense fallback={<p role="status">Opening sample preview…</p>}><DemoShell route={route} /></Suspense>
  return <TrainingApplication route={route} />
}

function TrainingApplication({ route }) {
  const [catalog, setCatalog] = useState(null)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const controller = useTrainingController({ databaseName: APP_CONFIG.storageDatabase, suspended: !catalog })
  useEffect(() => {
    const abort = new AbortController()
    setError(null)
    fetchTrainingCatalog(fetch, abort.signal).then(content => { if (!abort.signal.aborted) setCatalog(content) }).catch(failure => {
      if (!abort.signal.aborted) setError(failure.message)
    })
    return () => abort.abort()
  }, [attempt])
  if (!catalog) return <TrainingShell page={route} sourceUrl={APP_CONFIG.sourceUrl} onNavigate={page => { window.location.hash = ROUTES[page] }}>
    {error ? <Notice title="Practice could not be loaded" tone="warning" action="Try again" onAction={() => setAttempt(value => value + 1)}>{error}</Notice> : <LoadingState label="Opening your practice…" />}
  </TrainingShell>
  return <TrainingExperience route={route} catalog={catalog} controller={controller} sample={catalog.synthetic === true} />
}
