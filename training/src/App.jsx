import { lazy, Suspense } from 'react'
import { APP_CONFIG } from './config.js'
import { ROUTES, useHashRoute } from './lib/routes.js'
import TrainingShell from './components/TrainingShell.jsx'
import { EmptyState, PageHeading } from './components/ui.jsx'

// Compile-time branching removes the sample module entirely from the default build.
const DemoShell = __TRAINING_DEMO__ ? lazy(() => import('./demo/DemoShell.jsx')) : null

export default function App() {
  const route = useHashRoute()
  if (DemoShell) return <Suspense fallback={<p role="status">Opening sample preview…</p>}><DemoShell route={route} /></Suspense>
  return <TrainingShell page={route} sourceUrl={APP_CONFIG.sourceUrl} onNavigate={page => { window.location.hash = ROUTES[page] }}>
    <PageHeading eyebrow="Family practice" title={route === 'history' ? 'History' : 'Ready when you are.'} />
    <EmptyState title="Training is not connected yet">Family access and your trainer’s assignments will appear here when setup is complete. There are no assignments available in this build.</EmptyState>
  </TrainingShell>
}
