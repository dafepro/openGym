import { ROUTES } from '../lib/routes.js'

export const DEMO_SENTINEL = 'SYNTHETIC_TRAINING_DEMO_ONLY'

export default function DemoShell({ route }) {
  return <div className="training-shell" data-preview={DEMO_SENTINEL}>
    <header className="site-header"><a className="wordmark" href={ROUTES.today}>QUICKTRACK <span>TRAINING</span></a></header>
    <main id="main"><p className="sample-banner" role="status">Sample preview · Not a trainer assignment</p>
      <p className="eyebrow">{route === 'history' ? 'History' : route === 'practice' ? 'Practice' : 'Today'}</p>
      <h1>Your next practice.</h1>
      <section className="status-card"><h2>Sample assignment</h2><p>This preview establishes the training interface. No real prescription, video or completed work is included.</p></section>
    </main>
    <nav className="primary-nav" aria-label="Main navigation"><a href={ROUTES.today} aria-current={route === 'today' ? 'page' : undefined}>Today</a><a href={ROUTES.history} aria-current={route === 'history' ? 'page' : undefined}>History</a></nav>
  </div>
}
