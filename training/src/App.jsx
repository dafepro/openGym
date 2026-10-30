import { lazy, Suspense } from 'react'
import { APP_CONFIG } from './config.js'
import { ROUTES, useHashRoute } from './lib/routes.js'

// Compile-time branching removes the sample module entirely from the default build.
const DemoShell = __TRAINING_DEMO__ ? lazy(() => import('./demo/DemoShell.jsx')) : null

export default function App() {
  const route = useHashRoute()
  if (DemoShell) return <Suspense fallback={<p role="status">Opening sample preview…</p>}><DemoShell route={route} /></Suspense>
  return <div className="training-shell">
    <a className="skip-link" href="#main" onClick={event => { event.preventDefault(); document.getElementById('main')?.focus() }}>Skip to content</a>
    <header className="site-header"><a className="wordmark" href={ROUTES.today}>QUICKTRACK <span>TRAINING</span></a><span className="family-label">Family practice</span></header>
    <main id="main" tabIndex={-1}>
      <p className="eyebrow">{route === 'history' ? 'Your training record' : route === 'practice' ? 'Practice' : 'Today'}</p>
      <h1>{route === 'history' ? 'Training history' : 'Ready when you are.'}</h1>
      <section className="status-card" aria-labelledby="access-heading">
        <span className="status-mark" aria-hidden="true">Q</span>
        <h2 id="access-heading">Training is not connected yet</h2>
        <p>Family access and your trainer’s assignments will appear here when setup is complete.</p>
        <p className="muted">Your practice will stay private. There are no assignments available in this build.</p>
      </section>
    </main>
    <nav className="primary-nav" aria-label="Main navigation">
      <a href={ROUTES.today} aria-current={route === 'today' ? 'page' : undefined}>Today</a>
      <a href={ROUTES.history} aria-current={route === 'history' ? 'page' : undefined}>History</a>
    </nav>
    <footer><a href={APP_CONFIG.sourceUrl}>Source and license</a><span>QuickTrack Training · {APP_CONFIG.build}</span></footer>
  </div>
}
