import Icon from './Icon.jsx'
import PlaybookMark from './PlaybookMark.jsx'
import { Notice } from './ui.jsx'
import OfflineStatus from './OfflineStatus.jsx'
import '../styles/practice-home.css'

export default function TrainingShell({
  children,
  page = 'today',
  onNavigate,
  onOrganize,
  sample = false,
  localPreview = false,
  notice,
  sourceUrl,
  practice = false,
  builder = false
}) {
  const navigate = (next) => onNavigate?.(next)
  return (
    <div
      className={`qt-shell${practice ? ' qt-shell--practice' : ''}${page === 'today' || page === 'assignments' || page === 'shared' ? ' qt-shell--today' : ''}`}
    >
      <a
        className="qt-skip-link"
        href="#training-main"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('training-main')?.focus()
        }}
      >
        Skip to content
      </a>
      <nav
        className="qt-brand qt-brand--playbook pb-header-nav"
        aria-label="Main navigation"
        data-visible={!practice}
        aria-hidden={practice || undefined}
        inert={practice || undefined}
      >
        <button
          type="button"
          className="qt-brand-name pb-home-link"
          aria-label="Practice"
          onClick={() => navigate('today')}
        >
          <PlaybookMark />
          QuickTrack
        </button>
        <div className="pb-primary-links">
          <a
            href="#/today"
            aria-current={['today', 'assignments', 'build', 'shared'].includes(page) ? 'page' : undefined}
          >
            <Icon name="play" size={18} />
            Practice
          </a>
          <a href="#/history" aria-current={page === 'history' ? 'page' : undefined}>
            <Icon name="history" size={18} />
            History
          </a>
          <a
            href="#/coach"
            aria-label="Coach’s desk"
            aria-current={['coach', 'assignments-coach'].includes(page) ? 'page' : undefined}
          >
            <Icon name="clipboard" size={18} />
            Coach
          </a>
        </div>
        <div className="pb-header-actions">
          {onOrganize && (
            <button className="qt-organizer-link" type="button" onClick={onOrganize}>
              <Icon name="pencil" size={18} />
              <span className="qt-visually-hidden">Organizer</span>
            </button>
          )}
          <button
            className="pb-profile-link"
            type="button"
            aria-label="Me"
            aria-current={page === 'me' || page === 'history' ? 'page' : undefined}
            onClick={() => navigate('me')}
          >
            <Icon name="user" size={21} />
          </button>
        </div>
      </nav>
      {sample && page !== 'coach' && (
        <Notice
          className="qt-sample-notice"
          title={practice ? 'Sample only · not trainer instructions' : 'Sample workspace'}
        >
          {!practice && 'Example drills and local practice only. Your trainer’s assignments have not been added.'}
        </Notice>
      )}
      {localPreview && <Notice className="qt-sample-notice" title="Local preview · not published" />}
      {notice && <Notice {...notice} />}
      <OfflineStatus />
      <main id="training-main" tabIndex="-1">
        {children}
      </main>

      {!practice && (
        <footer className="qt-footer">
          {sourceUrl && (
            <a href={sourceUrl} target="_blank" rel="noreferrer">
              Application source
            </a>
          )}
        </footer>
      )}
    </div>
  )
}
