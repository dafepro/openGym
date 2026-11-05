import TrainingNavigation from './TrainingNavigation.jsx'
import PlaybookMark from './PlaybookMark.jsx'
import { Notice } from './ui.jsx'

export default function TrainingShell({ children, page = 'today', onNavigate, onOrganize, sample = false, localPreview = false, notice, sourceUrl, practice = false, builder = false }) {
  const navigate = next => onNavigate?.(next)
  return <div className={`qt-shell${practice ? ' qt-shell--practice' : ''}${page === 'today' || page === 'shared' ? ' qt-shell--today' : ''}`}>
    <a className="qt-skip-link" href="#training-main" onClick={event => { event.preventDefault(); document.getElementById('training-main')?.focus() }}>Skip to content</a>
    {!practice && <header className="qt-brand qt-brand--playbook"><span className="qt-brand-name"><PlaybookMark/>QuickTrack</span>{onOrganize && <button className="qt-organizer-link" type="button" onClick={onOrganize}>Organizer</button>}</header>}
    {sample && <Notice className="qt-sample-notice" title={practice ? 'Sample only · not trainer instructions' : 'Sample workspace'}>{!practice && 'Example drills and local practice only. Your trainer’s assignments have not been added.'}</Notice>}
    {localPreview && <Notice className="qt-sample-notice" title="Local preview · not published" />}
    {notice && <Notice {...notice} />}
    <main id="training-main" tabIndex="-1">{children}</main>
    <TrainingNavigation page={page} visible={!practice} builder={builder} onNavigate={navigate} />
    {!practice && <footer className="qt-footer"><span>Progress stays on this device.</span>{sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer">Application source</a>}</footer>}
  </div>
}
