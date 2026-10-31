import { useState } from 'react'
import Icon from './Icon.jsx'
import '../styles/navigation.css'

// Keep one navigation landmark mounted across every route. Only the workout
// boundary changes its visibility; ordinary navigation moves the highlight.
export default function TrainingNavigation({ page, visible = true, builder = false, onNavigate }) {
  const [selected, setSelected] = useState(page === 'practice' ? 'today' : page)
  // Retain the departure tab while the bar slides out, including rapid reversals.
  // Updating derived state here avoids an intermediate committed selection.
  if (visible && page !== selected) setSelected(page)
  const items = [{ id: 'today', icon: 'home', label: 'Today' }, ...(builder ? [{ id: 'build', icon: 'ball', label: 'Practice' }] : []), { id: 'me', icon: 'user', label: 'Me' }]
  const active = items.findIndex(item => item.id === (selected === 'shared' ? 'today' : selected))
  return <nav className={`qt-navigation${builder ? ' qt-navigation--builder' : ''}`} data-visible={visible} aria-label="Main navigation" aria-hidden={!visible || undefined} inert={!visible || undefined}>
    <div style={{ '--qt-nav-count': items.length, '--qt-nav-index': Math.max(0, active) }}>
      <span className="qt-navigation-highlight" aria-hidden="true" data-active={active >= 0}><i /></span>
      {items.map(item => <button type="button" key={item.id} onClick={() => { if (visible) onNavigate?.(item.id) }} aria-current={item.id === items[active]?.id ? 'page' : undefined}><Icon name={item.icon} size={23} /><span>{item.label}</span></button>)}
    </div>
  </nav>
}
