import { useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { Button, LoadingState, Notice, formatClock } from '../components/ui.jsx'
import HistoryView, { HistoryStorage } from './HistoryView.jsx'
import { localDay, playerHistory, sessionTimestamp } from '../domain/player-history.js'
import { loadPlayerProfile, savePlayerProfile, PLAYER_FEET, PLAYER_ROLES } from '../domain/player-profile.js'
import '../styles/me.css'

function PlayerProfile({ databaseName }) {
  const [saved, setSaved] = useState(() => loadPlayerProfile(databaseName))
  const [draft, setDraft] = useState(saved.profile)
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(saved.error)
  const profile = saved.profile
  const change = field => event => setDraft(previous => ({ ...previous, [field]: event.target.value }))
  const save = event => {
    event.preventDefault()
    try {
      const next = savePlayerProfile(databaseName, draft)
      setSaved({ profile: next, error: '' }); setDraft(next); setEditing(false); setError(''); setMessage('Player details saved on this device.')
    } catch (failure) { setError(failure.message) }
  }
  return <section className="qt-player-card" aria-label="Player profile">
    <div className="qt-player-overview"><span className="qt-player-avatar" aria-hidden="true">{profile.nickname ? Array.from(profile.nickname)[0].toLocaleUpperCase() : <Icon name="ball" size={28} />}</span><div><p className="qt-eyebrow">Your player space</p><h1>{profile.nickname || 'Me'}</h1><p className="qt-player-position">{[profile.role, profile.preferredFoot && (profile.preferredFoot === 'Both' ? 'Both feet' : `${profile.preferredFoot} foot`)].filter(Boolean).join(' · ') || 'Make this space your own.'}</p></div><Button variant="text" onClick={() => { setDraft(profile); setEditing(value => !value); setMessage('') }} aria-expanded={editing} aria-controls="player-profile-form">{editing ? 'Close' : 'Edit'}</Button></div>
    {!editing && profile.goals && <div className="qt-player-goal"><span>Working toward</span><p>{profile.goals}</p></div>}
    {!editing && !profile.nickname && !profile.role && !profile.preferredFoot && !profile.goals && <p className="qt-player-hint">Add a nickname, your playing role, or something you want to work on.</p>}
    {editing && <form className="qt-player-form" id="player-profile-form" onSubmit={save}>
      <label className="qt-field">Nickname <input autoFocus value={draft.nickname} onChange={change('nickname')} maxLength={40} autoComplete="nickname" placeholder="What should we call you?" /></label>
      <div className="qt-field-grid"><label className="qt-field">Preferred foot<select value={draft.preferredFoot} onChange={change('preferredFoot')}><option value="">Not set</option>{PLAYER_FEET.map(foot => <option key={foot}>{foot}</option>)}</select></label><label className="qt-field">Playing role<select value={draft.role} onChange={change('role')}><option value="">Not set</option>{PLAYER_ROLES.map(role => <option key={role}>{role}</option>)}</select></label></div>
      <label className="qt-field">What are you working toward? <span className="qt-player-optional">Optional · {draft.goals.length}/280</span><textarea rows={3} value={draft.goals} onChange={change('goals')} maxLength={280} placeholder="Your own practice goals" /></label>
      <p className="qt-me-caption">All fields are optional. Details stay in this browser.</p>
      <div className="qt-player-form-actions"><Button type="submit">Save details</Button><Button variant="secondary" onClick={() => { setEditing(false); setDraft(profile); setError(saved.error) }}>Cancel</Button></div>
    </form>}
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

function PracticeTime({ days }) {
  const total = days.reduce((sum, day) => sum + day.seconds, 0)
  const measured = days.reduce((sum, day) => sum + day.measuredRows, 0)
  const unmeasured = days.reduce((sum, day) => sum + day.unmeasuredRows, 0)
  const maximum = Math.max(...days.map(day => day.seconds), 1)
  return <section className="qt-me-panel qt-time-panel" aria-labelledby="practice-time-heading"><div className="qt-me-section-heading"><div><p className="qt-eyebrow">Last 7 days</p><h2 id="practice-time-heading">Practice time</h2></div><div className="qt-me-stat"><strong>{measured ? formatClock(Math.floor(total)) : '—'}</strong><span>min:sec recorded</span></div></div>
    <div className="qt-time-chart" role="img" aria-label={measured ? `${formatClock(Math.floor(total))} recorded practice time in the last 7 days. Daily values follow.` : 'No timed practice recorded in the last 7 days.'}>{days.map(day => <div className="qt-time-column" key={day.day}><span className="qt-time-value">{day.seconds > 0 ? formatClock(Math.floor(day.seconds)) : day.unmeasuredRows ? '—' : ''}</span><div className="qt-time-track"><i style={{ height: `${day.seconds / maximum * 100}%` }} /></div><span className="qt-time-day">{day.date.toLocaleDateString(undefined, { weekday: 'narrow' })}</span></div>)}</div>
    <ul className="qt-visually-hidden">{days.map(day => <li key={day.day}>{day.date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}: {day.measuredRows ? formatClock(Math.floor(day.seconds)) : 'no timed practice'}{day.unmeasuredRows ? ', some practice without recorded time' : ''}</li>)}</ul>
    <p className="qt-me-caption">{!measured && !unmeasured ? 'Recorded drill time will appear here after you save a session.' : 'Recorded drill time only. Rest and video reviews are excluded.'}{unmeasured > 0 && ' Some practice has no recorded duration and is left out.'}</p>
  </section>
}

function SkillExposure({ stats }) {
  const [expanded, setExpanded] = useState(false)
  const skills = expanded ? stats.skills : stats.skills.slice(0, 5)
  const max = stats.skills[0]?.count || 1
  return <section className="qt-me-panel" aria-labelledby="skill-exposure-heading"><div className="qt-me-section-heading"><div><p className="qt-eyebrow">Last 28 days</p><h2 id="skill-exposure-heading">Skill exposure</h2></div><Icon name="ball" size={24} /></div>
    {skills.length ? <ul className="qt-skill-bars">{skills.map(skill => <li key={skill.tag}><div><span>{skill.label}</span><strong>{skill.count}<span className="qt-visually-hidden"> completed {skill.count === 1 ? 'drill' : 'drills'}</span></strong></div><span className="qt-skill-track" aria-hidden="true"><i style={{ width: `${skill.count / max * 100}%` }} /></span></li>)}</ul> : <div className="qt-skills-empty"><span aria-hidden="true"><i /><i /><i /></span><p>{stats.completedDrills ? 'Your completed drills do not have skill labels yet.' : 'Complete a drill with a skill label to start your mix.'}</p></div>}
    {stats.skills.length > 5 && <Button variant="text" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>{expanded ? 'Show fewer skills' : `Show all ${stats.skills.length} skills`}</Button>}
    <p className="qt-me-caption">Completed drills with each label. Each drill counts once per session and can have several labels. This shows exposure, not a skill rating.{stats.unlabelledDrills > 0 && ` ${stats.unlabelledDrills} completed ${stats.unlabelledDrills === 1 ? 'drill has' : 'drills have'} no skill label.`}</p>
  </section>
}

export default function MeView({ sessions = [], assignments = [], onOpenSession, onResume, onExport, onRestore, loading = false, databaseName = 'quicktrack-training', now = Date.now() }) {
  const [selectedDay, setSelectedDay] = useState(null)
  const today = localDay(now)
  const stats = useMemo(() => playerHistory(sessions, now), [sessions, today])
  const visible = selectedDay ? sessions.filter(session => session.status !== 'active' && localDay(sessionTimestamp(session)) === selectedDay) : sessions
  return <div className="qt-view qt-me"><PlayerProfile key={databaseName} databaseName={databaseName} />
    {loading ? <LoadingState label="Loading your practice history" /> : <><ActivityCalendar stats={stats} selectedDay={selectedDay} onSelectDay={setSelectedDay} /><PracticeTime days={stats.recentDays} /><SkillExposure stats={stats} /></>}
    <HistoryView embedded assignments={assignments} sessions={visible} loading={loading} onOpenSession={onOpenSession} onResume={onResume} selectedDay={selectedDay} onClearDay={() => setSelectedDay(null)} />
    <HistoryStorage onExport={onExport} onRestore={onRestore} />
  </div>
}
