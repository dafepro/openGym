import { lazy, Suspense } from 'react'
import { APP_CONFIG } from './config.js'
import { useHashRoute } from './lib/routes.js'
import TrainingExperience from './components/TrainingExperience.jsx'
import FamilyAccessView from './views/FamilyAccessView.jsx'
import useFamilyAccess from './controllers/useFamilyAccess.js'
import useTrainingController from './controllers/useTrainingController.js'

// Compile-time branching removes the sample module entirely from the default build.
const DemoShell = __TRAINING_DEMO__ ? lazy(() => import('./demo/DemoShell.jsx')) : null
const PrivatePreviewShell = __TRAINING_PRIVATE_PREVIEW__ ? lazy(() => import('./preview/PrivatePreviewShell.jsx')) : null

export default function App() {
  const route = useHashRoute()
  if (PrivatePreviewShell) return <Suspense fallback={<p role="status">Opening local private preview…</p>}><PrivatePreviewShell route={route} /></Suspense>
  if (DemoShell) return <Suspense fallback={<p role="status">Opening sample preview…</p>}><DemoShell route={route} /></Suspense>
  return <FamilyApplication route={route} />
}

function FamilyApplication({ route }) {
  const access = useFamilyAccess()
  const controller = useTrainingController({ databaseName: APP_CONFIG.storageDatabase, suspended: !access.authenticated })
  const panel = <FamilyAccessView route={route} access={access} returning={!!controller.active || controller.progress.sessions.length > 0} />
  if (!access.catalog) return panel
  return <TrainingExperience route={route} catalog={access.catalog} controller={controller} sample={access.catalog.synthetic === true} accessPending={access.pending} suspended={!access.authenticated} accessPanel={panel} onMediaError={() => access.check({ refreshCatalog: false })} onRenewAccess={access.renew} onLogout={access.logout} accessNotice={access.notice} />
}
