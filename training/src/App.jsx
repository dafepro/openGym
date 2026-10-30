import { lazy, Suspense } from 'react'
import { APP_CONFIG } from './config.js'
import { useHashRoute } from './lib/routes.js'
import TrainingExperience from './components/TrainingExperience.jsx'
import FamilyAccessView from './views/FamilyAccessView.jsx'
import useFamilyAccess from './controllers/useFamilyAccess.js'

// Compile-time branching removes the sample module entirely from the default build.
const DemoShell = __TRAINING_DEMO__ ? lazy(() => import('./demo/DemoShell.jsx')) : null

export default function App() {
  const route = useHashRoute()
  if (DemoShell) return <Suspense fallback={<p role="status">Opening sample preview…</p>}><DemoShell route={route} /></Suspense>
  return <FamilyApplication route={route} />
}

function FamilyApplication({ route }) {
  const access = useFamilyAccess()
  const panel = <FamilyAccessView route={route} access={access} returning={!!access.catalog} />
  if (!access.catalog) return panel
  return <TrainingExperience route={route} catalog={access.catalog} databaseName={APP_CONFIG.storageDatabase} suspended={!access.authenticated} accessPanel={panel} onMediaError={() => access.check({ refreshCatalog: false })} onRenewAccess={access.renew} onLogout={access.logout} accessNotice={access.notice} />
}
