import { useState } from 'react'
import Icon from './Icon.jsx'
import '../styles/navigation.css'

const destination = page => page === 'me' || page === 'history' ? 'me' : 'today'

// The same two destinations remain mounted through all routes. Practice owns
// both the whole-session outline and its organizer; drills are never a tab.
export default function TrainingNavigation({ page, visible = true, onNavigate }) {
  const [selected, setSelected] = useState(destination(page))
  const next = destination(page)
  if (visible && next !== selected) setSelected(next)
  const items = [{ id: 'today', icon: 'clipboard', label: 'Practice' }, { id: 'me', icon: 'user', label: 'Me' }]
  const active = items.findIndex(item => item.id === selected)
  return <nav className="qt-navigation qt-navigation--playbook" data-visible={visible} aria-label="Main navigation" aria-hidden={!visible || undefined} inert={!visible || undefined}>
    <div style={{ '--qt-nav-count': items.length, '--qt-nav-index': Math.max(0, active) }}>
      <span className="qt-navigation-highlight" aria-hidden="true" data-active={active >= 0}><i /></span>
      {items.map(item => <button type="button" key={item.id} onClick={() => { if (visible) onNavigate?.(item.id) }} aria-current={item.id === selected ? 'page' : undefined}><Icon name={item.icon} size={22} /><span>{item.label}</span></button>)}
    </div>
  </nav>
}
