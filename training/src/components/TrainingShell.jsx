import Icon from './Icon.jsx'
import PlaybookMark from './PlaybookMark.jsx'
import { Notice } from './ui.jsx'

export default function TrainingShell({ children, page = 'today', onNavigate, onOrganize, sample = false, localPreview = false, notice, sourceUrl, practice = false, builder = false }) {
  const navigate = next => onNavigate?.(next)
  return <div className={`qt-shell${practice ? ' qt-shell--practice' : ''}${page === 'today' || page === 'shared' ? ' qt-shell--today' : ''}`}>
    <a className="qt-skip-link" href="#training-main" onClick={event => { event.preventDefault(); document.getElementById('training-main')?.focus() }}>Skip to content</a>
    <nav className="qt-brand qt-brand--playbook pb-header-nav" aria-label="Main navigation" data-visible={!practice} aria-hidden={practice || undefined} inert={practice || undefined}><button type="button" className="qt-brand-name pb-home-link" aria-label="Practice" onClick={() => navigate('today')}><PlaybookMark/>QuickTrack</button><div className="pb-header-actions">{onOrganize && <button className="qt-organizer-link" type="button" onClick={onOrganize}>Organizer</button>}<button className="pb-profile-link" type="button" aria-label="Me" aria-current={page === 'me' || page === 'history' ? 'page' : undefined} onClick={() => navigate('me')}><Icon name="user" size={21}/></button></div></nav>
    {sample && <Notice className="qt-sample-notice" title={practice ? 'Sample only · not trainer instructions' : 'Sample workspace'}>{!practice && 'Example drills and local practice only. Your trainer’s assignments have not been added.'}</Notice>}
    {localPreview && <Notice className="qt-sample-notice" title="Local preview · not published" />}
    {notice && <Notice {...notice} />}
    <main id="training-main" tabIndex="-1">{children}</main>

    {!practice && <footer className="qt-footer"><span>Progress stays on this device.</span><a href="#/coach">Coach’s desk</a>{sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer">Application source</a>}</footer>}
  </div>
}
