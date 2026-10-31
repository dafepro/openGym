import { useMemo, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { Button, LoadingState, Notice, formatClock } from '../components/ui.jsx'
import HistoryView, { HistoryStorage } from './HistoryView.jsx'
import { localDay, playerHistory, sessionTimestamp } from '../domain/player-history.js'
import { loadPlayerProfile, savePlayerProfile, PLAYER_FEET, PLAYER_ROLES } from '../domain/player-profile.js'
import Reveal from '../components/Reveal.jsx'
import '../styles/me.css'
import '../styles/starter-practices.css'

function PlayerProfile({ databaseName }) {
  const [saved, setSaved] = useState(() => loadPlayerProfile(databaseName))
  const [draft, setDraft] = useState(saved.profile)
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(saved.error)
  const profile = saved.profile
  const editButton = useRef(null)
  const closeEditor = () => { editButton.current?.focus({ preventScroll: true }); setEditing(false) }
  const change = field => event => setDraft(previous => ({ ...previous, [field]: event.target.value }))
  const save = event => {
    event.preventDefault()
    try {
      const next = savePlayerProfile(databaseName, draft)
      setSaved({ profile: next, error: '' }); setDraft(next); closeEditor(); setError(''); setMessage('Player details saved on this device.')
    } catch (failure) { setError(failure.message) }
  }
  return <section className="qt-player-card" aria-label="Player profile">
    <div className="qt-player-overview"><span className="qt-player-avatar" aria-hidden="true">{profile.nickname ? Array.from(profile.nickname)[0].toLocaleUpperCase() : <Icon name="ball" size={28} />}</span><div><h1>{profile.nickname || 'Me'}</h1><p className="qt-player-position">{[profile.role, profile.preferredFoot && (profile.preferredFoot === 'Both' ? 'Both feet' : `${profile.preferredFoot} foot`)].filter(Boolean).join(' · ') || 'Your player profile'}</p></div><Button ref={editButton} variant="text" onClick={() => { setDraft(profile); setEditing(value => !value); setMessage('') }} aria-expanded={editing} aria-controls="player-profile-form">{editing ? 'Close' : 'Edit'}</Button></div>
    {profile.goals && <Reveal open={!editing}><div className="qt-player-goal"><span>Working toward</span><p>{profile.goals}</p></div></Reveal>}
    <Reveal open={editing} id="player-profile-form"><form className="qt-player-form" onSubmit={save}>
      <label className="qt-field">Nickname <input value={draft.nickname} onChange={change('nickname')} maxLength={40} autoComplete="nickname" placeholder="What should we call you?" /></label>
      <div className="qt-field-grid"><label className="qt-field">Preferred foot<select value={draft.preferredFoot} onChange={change('preferredFoot')}><option value="">Not set</option>{PLAYER_FEET.map(foot => <option key={foot}>{foot}</option>)}</select></label><label className="qt-field">Playing role<select value={draft.role} onChange={change('role')}><option value="">Not set</option>{PLAYER_ROLES.map(role => <option key={role}>{role}</option>)}</select></label></div>
      <label className="qt-field">What are you working toward? <span className="qt-player-optional">Optional · {draft.goals.length}/280</span><textarea rows={3} value={draft.goals} onChange={change('goals')} maxLength={280} placeholder="Your own practice goals" /></label>
      <p className="qt-me-caption">All fields are optional. Details stay in this browser.</p>
      <div className="qt-player-form-actions"><Button type="submit">Save details</Button><Button variant="secondary" onClick={() => { closeEditor(); setDraft(profile); setError(saved.error) }}>Cancel</Button></div>
    </form></Reveal>
    {error && <Notice title="Player details" tone="error">{error}</Notice>}
    {message && <p className="qt-player-saved" role="status">{message}</p>}
  </section>
}

function ActivityCalendar({ stats, selectedDay, onSelectDay }) {
  const padding = (stats.days[0].date.getDay() + 6) % 7
  return <section className="qt-me-panel" aria-labelledby="activity-heading">
    <div className="qt-me-section-heading"><div><p className="qt-eyebrow">Last 28 days</p><h2 id="activity-heading">Showing up</h2></div><div className="qt-me-stat"><strong>{stats.activeDays}<small>/28</small></strong><span>active days</span></div></div>
    <div className="qt-activity-calendar" role="group" aria-label="Saved sessions by day. Select a day to filter history.">
      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <span className="qt-calendar-weekday" aria-hidden="true" key={`weekday-${index}`}>{day}</span>)}
      {Array.from({ length: padding }, (_, index) => <span className="qt-calendar-spacer" key={`spacer-${index}`} />)}
      {stats.days.map(day => <button type="button" key={day.day} className="qt-calendar-day" data-level={Math.min(day.sessions, 3)} aria-pressed={selectedDay === day.day} aria-label={`${day.date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}: ${day.sessions} saved ${day.sessions === 1 ? 'session' : 'sessions'}${day.day === stats.days.at(-1).day ? ', today' : ''}`} title={`${day.sessions} saved ${day.sessions === 1 ? 'session' : 'sessions'}`} data-today={day.day === stats.days.at(-1).day} onClick={() => onSelectDay(selectedDay === day.day ? null : day.day)}><span>{day.date.getDate()}</span>{day.sessions > 0 && <i aria-hidden="true" />}</button>)}
    </div><div className="qt-calendar-footer"><p>{stats.periodSessions} saved {stats.periodSessions === 1 ? 'session' : 'sessions'} · includes video reviews</p><span aria-hidden="true">Less<i data-level="0" /><i data-level="1" /><i data-level="3" />More</span></div>
    {selectedDay ? <Button variant="text" className="qt-calendar-jump" onClick={() => document.getElementById('player-history')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })}>View sessions for {new Date(`${selectedDay}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} →</Button> : <p className="qt-me-caption">{stats.periodSessions ? 'Select a day to see its sessions below.' : 'Your next saved session will light up a day here.'}</p>}
  </section>
}

function PracticeTime({ days, onCalendar, calendarOpen, selectedDay, onSelectDay }) {
  const total = days.reduce((sum, day) => sum + day.seconds, 0)
  const measured = days.reduce((sum, day) => sum + day.measuredRows, 0)
  const unmeasured = days.reduce((sum, day) => sum + day.unmeasuredRows, 0)
  const maximum = Math.max(...days.map(day => day.seconds), 1)
  return <section className="qt-me-panel qt-time-panel" aria-labelledby="practice-time-heading"><div className="qt-me-section-heading"><div><h2 id="practice-time-heading">This week</h2><button type="button" className="qt-calendar-toggle" onClick={onCalendar} aria-expanded={calendarOpen} aria-controls="full-calendar">28-day calendar <Icon name="arrow" size={12}/></button></div><div className="qt-me-stat"><strong>{measured ? formatClock(Math.floor(total)) : '—'}</strong><span>min:sec recorded</span></div></div>
    <div className="qt-time-chart" role="group" aria-label={measured ? `${formatClock(Math.floor(total))} recorded practice time in the last 7 days. Daily values follow.` : 'No timed practice recorded in the last 7 days.'}>{days.map(day => <button type="button" className="qt-time-column" key={day.day} onClick={() => onSelectDay(selectedDay === day.day ? null : day.day)} aria-pressed={selectedDay === day.day} aria-label={`${day.date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}: ${formatClock(Math.floor(day.seconds))} recorded time, ${day.sessions} ${day.sessions === 1 ? 'session' : 'sessions'}. View history.`}><span className="qt-time-value">{day.seconds > 0 ? formatClock(Math.floor(day.seconds)) : day.unmeasuredRows ? '—' : ''}</span><span className="qt-time-track"><i style={{ height: `${day.seconds / maximum * 100}%` }} /></span><span className="qt-time-day">{day.date.toLocaleDateString(undefined, { weekday: 'narrow' })}</span></button>)}</div>
    <ul className="qt-visually-hidden">{days.map(day => <li key={day.day}>{day.date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}: {day.measuredRows ? formatClock(Math.floor(day.seconds)) : 'no timed practice'}{day.unmeasuredRows ? ', some practice without recorded time' : ''}</li>)}</ul>
    <p className="qt-me-caption">{!measured && !unmeasured ? 'Save a practice to start your chart.' : 'Work time only · tap a day for history.'}{unmeasured > 0 && ' Untimed work excluded.'}</p>
  </section>
}

function SkillExposure({ stats }) {
  const [expanded, setExpanded] = useState(false)
  const total = stats.skills.reduce((sum, skill) => sum + skill.count, 0)
  const colors = ['#d0f878', '#a9ebca', '#8fbfc8', '#9fa8ad']
  const remainder = stats.skills.slice(3).reduce((sum, skill) => sum + skill.count, 0)
  return <section className="qt-me-panel qt-mix-panel" aria-labelledby="skill-exposure-heading">
    <div className="qt-me-section-heading"><h2 id="skill-exposure-heading">Skill mix <small>28 days</small></h2>{stats.skills.length > 0 && <button type="button" className="qt-mix-toggle" aria-expanded={expanded} aria-controls="skill-detail" onClick={() => setExpanded(value => !value)}>{expanded ? 'Less' : 'Details'} <Icon name="arrow" size={12}/></button>}</div>
    {total > 0 ? <><div className="qt-skill-mix" aria-hidden="true">{stats.skills.slice(0, 3).map((skill, index) => <i key={skill.tag} style={{flex: skill.count, background:colors[index]}}/>)}{remainder > 0 && <i style={{flex:remainder,background:colors[3]}}/>}</div><ul className="qt-mix-legend">{stats.skills.slice(0, 3).map((skill,index) => <li key={skill.tag}><i style={{background:colors[index]}}/><span>{skill.label}</span><strong>{skill.count}</strong></li>)}{stats.skills.length > 3 && <li className="qt-mix-other"><i style={{background:colors[3]}}/>Other labels <strong>{remainder}</strong></li>}</ul><Reveal open={expanded} id="skill-detail"><ul className="qt-skill-bars">{stats.skills.map((skill,index) => <li key={skill.tag}><div><span>{skill.label}</span><strong>{skill.count}</strong></div><span className="qt-skill-track" aria-hidden="true"><i style={{width:`${skill.count / (stats.skills[0]?.count || 1) * 100}%`,background:colors[index % colors.length]}}/></span></li>)}</ul><p className="qt-me-caption">Completed drills per label, counted once per session. A drill may have several labels. This shows exposure, not a skill rating.{stats.unlabelledDrills > 0 && ` ${stats.unlabelledDrills} drills have no label.`}</p></Reveal><p className="qt-mix-footnote">Drills practiced · not a skill rating</p></> : <p className="qt-me-caption">Your completed drills will build your skill mix.</p>}
  </section>
}

export default function MeView({ sessions = [], assignments = [], onOpenSession, onResume, onExport, onRestore, loading = false, databaseName = 'quicktrack-training', now = Date.now() }) {
  const [selectedDay, setSelectedDay] = useState(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const chooseDay = day => { setSelectedDay(day); requestAnimationFrame(() => document.getElementById('player-history')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })) }
  const today = localDay(now)
  const stats = useMemo(() => playerHistory(sessions, now), [sessions, today])
  const visible = selectedDay ? sessions.filter(session => session.status !== 'active' && localDay(sessionTimestamp(session)) === selectedDay) : sessions
  return <div className="qt-view qt-me"><PlayerProfile key={databaseName} databaseName={databaseName} />
    {loading ? <LoadingState label="Loading your practice history" /> : <><PracticeTime days={stats.recentDays} onCalendar={() => setCalendarOpen(value => !value)} calendarOpen={calendarOpen} selectedDay={selectedDay} onSelectDay={chooseDay}/><Reveal open={calendarOpen} id="full-calendar"><ActivityCalendar stats={stats} selectedDay={selectedDay} onSelectDay={chooseDay} /></Reveal><SkillExposure stats={stats} /></>}
    <HistoryView embedded assignments={assignments} sessions={visible} loading={loading} onOpenSession={onOpenSession} onResume={onResume} selectedDay={selectedDay} onClearDay={() => setSelectedDay(null)} />
    <HistoryStorage onExport={onExport} onRestore={onRestore} />
  </div>
}
