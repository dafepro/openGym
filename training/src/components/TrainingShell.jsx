import Icon from './Icon.jsx'
import { Notice } from './ui.jsx'

export default function TrainingShell({ children, page = 'today', onNavigate, sample = false, localPreview = false, notice, sourceUrl, practice = false, builder = false }) {
  const navigate = next => onNavigate?.(next)
  return <div className={`qt-shell${practice ? ' qt-shell--practice' : ''}${page === 'today' || page === 'shared' ? ' qt-shell--today' : ''}`}>
    <a className="qt-skip-link" href="#training-main" onClick={event => { event.preventDefault(); document.getElementById('training-main')?.focus() }}>Skip to content</a>
    {!practice && <header className="qt-brand"><span className="qt-brand-mark"><Icon name="ball" size={22} /></span><span>QuickTrack <span>Training</span></span><span className="qt-brand-rule" /></header>}
    {sample && <Notice className="qt-sample-notice" title={practice ? 'Sample only · not trainer instructions' : 'Sample workspace'}>{!practice && 'Example drills and local practice only. Your trainer’s assignments have not been added.'}</Notice>}
    {localPreview && <Notice className="qt-sample-notice" title={practice ? 'Local preview · private files' : 'Private local preview'}>{!practice && 'Videos stay on this computer. This is a local review, separate from the hosted family site.'}</Notice>}
    {notice && <Notice {...notice} />}
    <main id="training-main" tabIndex="-1">{children}</main>
    {!practice && <nav className={`qt-navigation${builder ? ' qt-navigation--builder' : ''}`} aria-label="Main navigation"><div>{[{ id: 'today', icon: 'home', label: 'Today' }, ...(builder ? [{ id: 'build', icon: 'plus', label: 'Build' }] : []), { id: 'history', icon: 'history', label: 'History' }].map(item => <button type="button" key={item.id} onClick={() => navigate(item.id)} aria-current={page === item.id ? 'page' : undefined}><Icon name={item.icon} size={23} /><span>{item.label}</span><i /></button>)}</div></nav>}
    <footer className="qt-footer"><span>Progress stays on this device.</span>{sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer">Application source</a>}</footer>
  </div>
}
