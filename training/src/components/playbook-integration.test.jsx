// @vitest-environment happy-dom
// Real React/hooks/storage integration in a virtual DOM. This is not a browser
// rendering, media-playback, hit-testing, animation, or screenshot test.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IDBFactory } from 'fake-indexeddb'
import TrainingExperience from './TrainingExperience.jsx'
import { useHashRoute } from '../lib/routes.js'
import { createTrainingRepository } from '../storage/index.js'
import { decodePractice } from '../domain/practice-builder.js'
import { validateCatalog } from '../domain/content.js'

const catalog = validateCatalog({ schemaVersion: 1, revision: 'integration-v1', currentAssignmentId: 'assigned', currentAssignmentRevision: 'v1', assignments: [{ id: 'assigned', revision: 'v1', title: 'Assigned close touches', status: 'current', drills: [{ id: 'touches', title: 'Close touches', instructions: 'Keep touches close.', mode: 'practice', sets: 1, side: 'both', restSec: null, media: { id: 'touches', status: 'unavailable' } }] }] })
let databaseName, repository, user, elapsed
const wall = 1793836800000
function App({ content = catalog }) { return <TrainingExperience route={useHashRoute()} catalog={content} databaseName={databaseName}/> }
const button = name => screen.getByRole('button', { name, exact: true })
const field = name => screen.getByRole('textbox', { name, exact: true })
const fill = async (element, value) => { await user.clear(element); await user.type(element, value) }
const load = async (content = catalog) => {
  const mounted = render(<App content={content}/>)
  await screen.findByRole('button', { name: 'Start practice', exact: true })
  return mounted
}
const state = () => repository.load()
const approvedCatalog = mode => {
  const content = structuredClone(catalog)
  const drill = content.assignments[0].drills[0]
  drill.media = { id: 'touches', status: 'approved', path: '/media/touches' }
  drill.mode = mode
  if (mode === 'time') { drill.durationSec = 10; drill.restSec = 0 }
  return validateCatalog(content)
}


beforeEach(() => {
  elapsed = 0
  vi.spyOn(Date, 'now').mockImplementation(() => wall + elapsed)
  vi.spyOn(performance, 'now').mockImplementation(() => elapsed)
  vi.stubGlobal('indexedDB', new IDBFactory())
  vi.stubGlobal('matchMedia', vi.fn(query => ({ matches: query.includes('prefers-reduced-motion'), media: query, addEventListener() {}, removeEventListener() {} })))
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: vi.fn((_name, _options, callback) => callback({ name: 'integration-lock' })) } })
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function () { this.setAttribute('open', '') })
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function () { this.removeAttribute('open') })
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  window.localStorage.clear()
  window.history.replaceState(null, '', '/#/today')
  databaseName = `playbook-integration-${crypto.randomUUID()}`
  repository = createTrainingRepository({ name: databaseName })
  user = userEvent.setup()
})
afterEach(async () => { cleanup(); await repository.close(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('Playbook connected React flows with durable local storage', () => {
  it('starts work in one tap, pauses on Back, and resumes in one explicit action', async () => {
    await load()
    await user.click(button('Start practice'))
    await waitFor(async () => expect((await state()).activeSession?.phase).toBe('working'))
    expect(screen.getByRole('region', { name: 'Practice controls' }).dataset.phase).toBe('working')
    elapsed += 1000
    await user.click(button('Back to practice, keeping your progress'))
    await screen.findByRole('button', { name: 'Resume practice', exact: true })
    await waitFor(async () => expect((await state()).activeSession?.practiceTimer?.paused).toBe(true))
    const originalId = (await state()).activeSession.id
    await user.click(button('Resume practice'))
    await waitFor(async () => expect((await state()).activeSession?.practiceTimer?.paused).toBe(false))
    expect((await state()).activeSession.id).toBe(originalId)
    elapsed += 1000
    await user.click(button('Finish practice'))
    await screen.findByRole('heading', { name: 'Practice complete', exact: true })
    const saved = await state()
    expect(saved.activeSession).toBeNull()
    expect(saved.sessions).toHaveLength(1)
    expect(saved.sessions[0].rows[0].practiceSeconds).toBe(2)
    expect(screen.getByRole('navigation', { name: 'Main navigation' }).getAttribute('aria-hidden')).toBeNull()
  })

  it.each(['practice', 'time'])('opening help pauses %s work, and closing it requires an explicit resume', async mode => {
    await load(approvedCatalog(mode))
    await user.click(button('Start practice'))
    await waitFor(async () => expect((await state()).activeSession?.phase).toBe('working'))
    elapsed += 1000
    await user.click(button('Watch demonstration'))
    const help = screen.getByRole('dialog', { name: 'Close touches', exact: true })
    // Media calls are stubbed: this proves dialog/work state, not playback.
    expect(help.querySelector('video')).toBeTruthy()
    await waitFor(async () => {
      const active = (await state()).activeSession
      if (mode === 'practice') expect(active.practiceTimer.paused).toBe(true)
      else { expect(active.phase).toBe('ready'); expect(active.rows[0].actual).toBe(1) }
    })
    elapsed += 1000
    await user.click(within(help).getByRole('button', { name: 'Close dialog', exact: true }))
    const resume = button(mode === 'practice' ? 'Resume practice timer' : 'Resume set')
    expect(resume.disabled).toBe(false)
    const paused = (await state()).activeSession
    if (mode === 'practice') expect(paused.practiceTimer.elapsedBefore).toBe(1)
    else { expect(paused.timer).toBeNull(); expect(paused.rows[0].actual).toBe(1) }
    await user.click(resume)
    await waitFor(async () => {
      const active = (await state()).activeSession
      expect(active.phase).toBe('working')
      if (mode === 'practice') expect(active.practiceTimer.paused).toBe(false)
      else expect(active.timer.elapsedBefore).toBe(1)
    })
    elapsed += 1000
    await user.click(button('Finish practice'))
    await screen.findByRole('heading', { name: mode === 'practice' ? 'Practice complete' : 'Session saved', exact: true })
    const recorded = (await state()).sessions[0].rows[0]
    expect(mode === 'practice' ? recorded.practiceSeconds : recorded.actual).toBe(2)
  })

  it('finishes a paused timed drill at its observed checkpoint rather than its target', async () => {
    await load(approvedCatalog('time'))
    await user.click(button('Start practice'))
    await waitFor(async () => expect((await state()).activeSession?.phase).toBe('working'))
    elapsed += 1000
    await user.click(button('Pause set'))
    await waitFor(async () => expect((await state()).activeSession?.phase).toBe('ready'))
    elapsed += 2000
    await user.click(button('Finish practice'))
    await screen.findByRole('heading', { name: 'Session saved', exact: true })
    const saved = await state()
    expect(saved.activeSession).toBeNull()
    expect(saved.sessions).toHaveLength(1)
    expect(saved.sessions[0].status).toBe('partial')
    expect(saved.sessions[0].rows[0]).toMatchObject({ actual: 1, target: 10, status: 'done', prescriptionMet: false })
  })

  it('deduplicates repeated final-forward taps while the durable save is pending', async () => {
    await load()
    await user.click(button('Start practice'))
    await waitFor(async () => expect((await state()).activeSession?.phase).toBe('working'))
    const sessionId = (await state()).activeSession.id
    elapsed += 1000
    const finish = button('Finish practice')
    act(() => { fireEvent.click(finish); fireEvent.click(finish); fireEvent.click(finish) })
    await screen.findByRole('heading', { name: 'Practice complete', exact: true })
    const saved = await state()
    expect(saved.activeSession).toBeNull()
    expect(saved.sessions).toHaveLength(1)
    expect(saved.sessions[0].id).toBe(sessionId)
    expect(saved.sessions[0].rows[0].practiceSeconds).toBe(1)
  })

  it.each(['practice', 'time'])('closing the exit sheet leaves %s work paused, while Resume explicitly restarts it', async mode => {
    await load(approvedCatalog(mode))
    await user.click(button('Start practice'))
    await waitFor(async () => expect((await state()).activeSession?.phase).toBe('working'))
    elapsed += 1000
    await user.click(button('Quit practice'))
    let exit = await screen.findByRole('dialog', { name: 'Leave practice?', exact: true })
    await user.click(within(exit).getByRole('button', { name: 'Close dialog', exact: true }))
    const active = (await state()).activeSession
    if (mode === 'practice') expect(active.practiceTimer.paused).toBe(true)
    else { expect(active.phase).toBe('ready'); expect(active.rows[0].actual).toBe(1) }
    elapsed += 1000
    await user.click(button('Quit practice'))
    exit = await screen.findByRole('dialog', { name: 'Leave practice?', exact: true })
    await user.click(within(exit).getByRole('button', { name: 'Resume practice', exact: true }))
    await waitFor(async () => {
      const resumed = (await state()).activeSession
      expect(resumed.phase).toBe('working')
      if (mode === 'practice') expect(resumed.practiceTimer.paused).toBe(false)
      else expect(resumed.timer.elapsedBefore).toBe(1)
    })
    elapsed += 1000
    await user.click(button('Finish practice'))
    await screen.findByRole('heading', { name: mode === 'practice' ? 'Practice complete' : 'Session saved', exact: true })
    const recorded = (await state()).sessions[0].rows[0]
    expect(mode === 'practice' ? recorded.practiceSeconds : recorded.actual).toBe(2)
  })

  it('creates, reloads, edits and performs a personal drill without rewriting its history', async () => {
    const mounted = await load()
    await user.click(screen.getByRole('button', { name: /My own drill/ }))
    await fill(field('Drill name'), 'Backyard touches')
    await fill(screen.getByRole('textbox', { name: /Setup/ }), 'A ball and a clear space')
    await fill(field('How to do it'), 'Count each close touch.')
    await user.click(button('Reps & sets'))
    await user.click(button('Fine-tune targets'))
    await fill(screen.getByRole('spinbutton', { name: 'Reps per set', exact: true }), '5')
    await fill(screen.getByRole('spinbutton', { name: 'Rest (seconds)', exact: true }), '0')
    await user.click(button('Save for later'))
    await screen.findByRole('heading', { name: 'Assigned close touches', exact: true })
    const customKey = `${databaseName}:custom-drills-v1`
    const original = JSON.parse(localStorage.getItem(customKey)).drills[0]
    mounted.unmount()
    await load()
    await user.click(screen.getByRole('button', { name: /My own drill/ }))
    await user.click(screen.getByRole('button', { name: /My saved drills/ }))
    await user.click(button('Edit Backyard touches'))
    expect(field('How to do it').value).toBe('Count each close touch.')
    expect(screen.getByRole('textbox', { name: /Setup/ }).value).toBe('A ball and a clear space')
    await fill(field('Drill name'), 'My close touches')
    await user.click(button('Save changes'))
    await waitFor(() => expect(JSON.parse(localStorage.getItem(customKey)).drills[0].title).toBe('My close touches'))
    expect(JSON.parse(localStorage.getItem(customKey)).drills[0].id).toBe(original.id)
    const row = screen.getByText('My close touches', { exact: true }).closest('article')
    await user.click(within(row).getByRole('button', { name: 'Start', exact: true }))
    await waitFor(async () => expect((await state()).activeSession?.phase).toBe('working'))
    await fill(screen.getByRole('spinbutton', { name: 'Repetitions completed', exact: true }), '4')
    elapsed += 1000
    await user.click(button('Finish practice'))
    await screen.findByRole('heading', { name: 'Session saved', exact: true })
    const recorded = (await state()).sessions[0]
    expect(recorded.rows[0].actual).toBe(4)
    expect(recorded.rows[0].target).toBe(5)
    expect(recorded.status).toBe('partial')
    await user.click(button('View history'))
    await user.click(screen.getByRole('button', { name: /My close touches/ }))
    const history = screen.getByRole('dialog', { name: 'My close touches', exact: true })
    await user.click(within(history).getByRole('button', { name: /My close touches/ }))
    expect(within(history).getByText('Planned: 5 reps · Actual: 4 reps', { exact: true })).toBeTruthy()
    await user.click(within(history).getByRole('button', { name: 'Close dialog', exact: true }))
    await user.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name: 'Practice', exact: true }))
    await user.click(screen.getByRole('button', { name: /My own drill/ }))
    await user.click(screen.getByRole('button', { name: /My saved drills/ }))
    await user.click(button('Edit My close touches'))
    await fill(field('How to do it'), 'Changed only in my reusable drill.')
    await user.click(button('Save changes'))
    await user.click(button('Edit My close touches'))
    await user.click(button('Delete drill'))
    const confirm = screen.getByRole('dialog', { name: 'Delete this drill?', exact: true })
    await user.click(within(confirm).getByRole('button', { name: 'Delete drill', exact: true }))
    expect(JSON.parse(localStorage.getItem(customKey)).drills).toEqual([])
    expect((await state()).sessions[0]).toEqual(recorded)
  })

  it('reports hidden invalid targets, retains the form, and cancels an edit without changing saved data', async () => {
    await load()
    await user.click(screen.getByRole('button', { name: /My own drill/ }))
    await fill(field('Drill name'), 'Timed touches')
    await fill(field('How to do it'), 'Count controlled touches.')
    await user.click(button('Timed sets'))
    await user.click(button('Fine-tune targets'))
    await fill(screen.getByRole('spinbutton', { name: 'Seconds per set', exact: true }), '0')
    await user.click(button('Fine-tune targets'))
    await user.click(button('Save for later'))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(field('Drill name').value).toBe('Timed touches')
    expect(localStorage.getItem(`${databaseName}:custom-drills-v1`)).toBeNull()
    await user.click(button('45s'))
    await user.click(button('Save for later'))
    await screen.findByRole('heading', { name: 'Assigned close touches', exact: true })
    const original = localStorage.getItem(`${databaseName}:custom-drills-v1`)
    await user.click(screen.getByRole('button', { name: /My own drill/ }))
    await user.click(screen.getByRole('button', { name: /My saved drills/ }))
    await user.click(button('Edit Timed touches'))
    await fill(field('Drill name'), 'Unsaved rename')
    await user.click(button('Cancel edit'))
    expect(field('Drill name').value).toBe('')
    expect(button('Start my drill')).toBeTruthy()
    expect(localStorage.getItem(`${databaseName}:custom-drills-v1`)).toBe(original)
  })

  it('keeps the drill catalog contextual while nested filters and add actions update only the draft', async () => {
    await load()
    await user.click(button('Organizer'))
    await user.click(button('Add drill'))
    let picker = screen.getByRole('dialog', { name: 'Add drills to your practice', exact: true })
    await user.click(within(picker).getByRole('button', { name: 'Filters', exact: true }))
    const filters = screen.getByRole('dialog', { name: 'Find your drills', exact: true })
    await user.click(within(filters).getByRole('checkbox', { name: 'Only drills with video', exact: true }))
    await user.click(within(filters).getByRole('button', { name: 'Show 0 drills', exact: true }))
    expect(screen.queryByRole('dialog', { name: 'Find your drills', exact: true })).toBeNull()
    picker = screen.getByRole('dialog', { name: 'Add drills to your practice', exact: true })
    await user.click(within(picker).getByRole('button', { name: 'All drills', exact: true }))
    await fill(within(picker).getByRole('searchbox', { name: 'Search drills', exact: true }), 'Easy movement')
    await user.click(within(picker).getByRole('button', { name: 'Add Easy movement warm-up', exact: true }))
    await user.click(within(picker).getByRole('button', { name: 'Done · 2 drills in practice', exact: true }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.querySelectorAll('.qt-review-list > li')).toHaveLength(2)
    expect(catalog.assignments[0].drills).toHaveLength(1)
    expect((await state()).activeSession).toBeNull()
    await user.click(button('Save practice'))
    const saved = JSON.parse(localStorage.getItem(`${databaseName}:saved-practices-v1`)).practices[0]
    expect(saved.drills).toHaveLength(2)
    await user.click(button('Edit Easy movement warm-up'))
    await user.click(button('Remove Easy movement warm-up'))
    expect(document.querySelectorAll('.qt-review-list > li')).toHaveLength(1)
    expect(JSON.parse(localStorage.getItem(`${databaseName}:saved-practices-v1`)).practices[0]).toEqual(saved)
  })

  it('recovers from a random no-match setup and starts exactly the displayed whole proposal', async () => {
    await load()
    await user.click(screen.getByRole('button', { name: /Surprise me/ }))
    await user.click(screen.getByRole('button', { name: /Your setup/ }))
    await user.click(screen.getByRole('checkbox', { name: 'Only drills with a demonstration', exact: true }))
    expect(button('Start this practice').disabled).toBe(true)
    expect(screen.getByText('Try another setup', { exact: true })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Your setup/ }))
    await user.click(button('Change setup'))
    expect(screen.getByRole('button', { name: /Your setup/ }).getAttribute('aria-expanded')).toBe('true')
    await user.click(screen.getByRole('checkbox', { name: 'Only drills with a demonstration', exact: true }))
    const proposal = screen.getByRole('region', { name: 'Random practice proposal' })
    const shownTitles = [...proposal.querySelectorAll('.pb-drill-name strong')].map(item => item.textContent)
    expect(shownTitles).toHaveLength(3)
    await user.click(button('Start this practice'))
    await waitFor(async () => expect((await state()).activeSession?.phase).toBe('working'))
    expect((await state()).activeSession.assignment.drills.map(drill => drill.title)).toEqual(shownTitles)
    await user.click(button('Quit practice'))
    await user.click(button('Discard without saving'))
    await screen.findByRole('heading', { name: 'Assigned close touches', exact: true })
    expect((await state()).activeSession).toBeNull()
    expect((await state()).sessions).toEqual([])
  })

  it('previews the parent note without recording and shares that exact snapshot', async () => {
    await load()
    await user.click(button('Organizer'))
    await fill(field('Practice name'), 'Tuesday touches')
    await fill(screen.getByRole('textbox', { name: /Note for the player/ }), 'Use your left foot first.')
    await user.click(button('Preview as player'))
    await screen.findByRole('heading', { name: 'Tuesday touches', exact: true })
    expect(button('Start practice').disabled).toBe(true)
    expect(screen.getByText('Use your left foot first.', { exact: true })).toBeTruthy()
    expect((await state()).activeSession).toBeNull()
    await user.click(button('Create practice link'))
    const share = screen.getByRole('dialog', { name: 'Share this practice', exact: true })
    const link = within(share).getByRole('textbox', { name: 'Practice link', exact: true }).value
    const shared = decodePractice(new URL(link).hash.slice('#/shared/'.length), catalog)
    expect(shared.title).toBe('Tuesday touches')
    expect(shared.note).toBe('Use your left foot first.')
    expect(shared.drills).toEqual(catalog.assignments[0].drills)
    expect((await state()).sessions).toEqual([])
  })
})
