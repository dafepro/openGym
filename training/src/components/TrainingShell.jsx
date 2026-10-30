import Icon from './Icon.jsx'
import { Notice } from './ui.jsx'

export default function TrainingShell({ children, page = 'today', onNavigate, sample = false, notice, sourceUrl, practice = false }) {
  const navigate = next => onNavigate?.(next)
  return <div className={`qt-shell${practice ? ' qt-shell--practice' : ''}`}>
    <a className="qt-skip-link" href="#training-main" onClick={event => { event.preventDefault(); document.getElementById('training-main')?.focus() }}>Skip to content</a>
    <header className="qt-brand"><span className="qt-brand-mark"><Icon name="ball" size={22} /></span><span>QuickTrack <span>Training</span></span><span className="qt-brand-rule" /></header>
    {sample && <Notice className="qt-sample-notice" title={practice ? 'Sample only · not trainer instructions' : 'Sample workspace'}>{!practice && 'Example drills and local practice only. Your trainer’s assignments have not been added.'}</Notice>}
    {notice && <Notice {...notice} />}
    <main id="training-main" tabIndex="-1">{children}</main>
    {!practice && <nav className="qt-navigation" aria-label="Main navigation"><div>{[{ id: 'today', icon: 'home', label: 'Today' }, { id: 'history', icon: 'history', label: 'History' }].map(item => <button type="button" key={item.id} onClick={() => navigate(item.id)} aria-current={page === item.id ? 'page' : undefined}><Icon name={item.icon} size={23} /><span>{item.label}</span><i /></button>)}</div></nav>}
    <footer className="qt-footer"><span>Progress stays on this device.</span>{sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer">Application source</a>}</footer>
  </div>
}
