import { useState } from 'react'
import Icon from './Icon.jsx'
import Dialog from './Dialog.jsx'
import DrillDemonstration from './DrillDemonstration.jsx'
import DrillPreview from './DrillPreview.jsx'
import TodayView from '../views/TodayView.jsx'
import { Button, Notice } from './ui.jsx'
import '../styles/coach-review.css'

const targetsFor = (job) =>
  job.plan.drills.map(({ sets, reps, durationSec, restSec, side }) => ({ sets, reps, durationSec, restSec, side }))
export default function CoachReviewDesk({ job, canReview, paused, onReview, onClose }) {
  const [edition, setEdition] = useState(job)
  const [targets, setTargets] = useState(() => targetsFor(job))
  const [feedback, setFeedback] = useState('')
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [overlay, setOverlay] = useState(null)
  const stale = job.headSha !== edition.headSha || job.status !== 'submitted'
  const dirty = JSON.stringify(targets) !== JSON.stringify(targetsFor(edition))
  const disabled = !canReview || busy || stale || job.deskApproved
  const preview = edition.reviewPractice && {
    ...edition.reviewPractice,
    drills: edition.reviewPractice.drills.map((drill, index) => {
      const { reps, durationSec, ...rest } = targets[index]
      return { ...drill, ...rest, ...(drill.mode === 'time' ? { durationSec } : { reps }) }
    })
  }
  const act = async (action) => {
    setBusy(true)
    setError('')
    try {
      await onReview(edition, {
        action,
        ...(action === 'targets' ? { targets } : action === 'revise' ? { feedback } : {})
      })
      onClose()
    } catch (failure) {
      setError(failure.message)
    } finally {
      setBusy(false)
    }
  }
  const change = (index, field, value) => {
    setTargets((items) => items.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
    setChecked(false)
  }
  return (
    <>
      <Dialog title={edition.plan.title} className="pb-review-dialog" onClose={onClose} dismissDisabled={busy}>
        <div className="pb-review-desk">
          <header>
            <p>{edition.plan.goal}</p>
          </header>
          {edition.plan.overview && (
            <details>
              <summary>Notes</summary>
              <p>{edition.plan.overview}</p>
            </details>
          )}
          {!canReview && <Notice title="Preview only">The publishing coach approves and revises this practice.</Notice>}
          {stale && (
            <Notice title="A newer version is available">
              Your edits have not been applied. Reload to review the current version.
              <Button
                variant="secondary"
                disabled={busy || job.status !== 'submitted'}
                onClick={() => {
                  setEdition(job)
                  setTargets(targetsFor(job))
                  setChecked(false)
                  setError('')
                }}
              >
                Reload review and discard target edits
              </Button>
            </Notice>
          )}
          {job.deskApproved && <Notice title="Approved">Publishing checks are running.</Notice>}
          {error && (
            <Notice title="Review not saved" tone="error">
              {error}
            </Notice>
          )}
          {preview && (
            <Button variant="secondary" disabled={busy} onClick={() => setOverlay({ type: 'preview' })}>
              Preview as player
            </Button>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void act('targets')
            }}
          >
            <ol className="pb-review-drills">
              {edition.plan.drills.map((drill, index) => (
                <li key={index}>
                  <h3>
                    {index + 1}. {drill.title}
                  </h3>
                  <p>
                    <strong>Setup:</strong> {drill.setup}
                  </p>
                  <p>{drill.instructions}</p>
                  <p>
                    <strong>Focus:</strong> {drill.focus}
                  </p>
                  {preview && (
                    <Button
                      variant="secondary"
                      icon="video"
                      aria-label={`Review video: ${drill.title}`}
                      title="Review video"
                      onClick={() => setOverlay({ type: 'video', drill: preview.drills[index] })}
                    />
                  )}
                  <fieldset disabled={disabled} className="pb-review-targets">
                    <legend className="qt-visually-hidden">Targets for {drill.title}</legend>
                    <label className="qt-field">
                      Sets
                      <input
                        type="number"
                        min="1"
                        max="10"
                        step="1"
                        required
                        value={targets[index].sets}
                        onChange={(e) => change(index, 'sets', e.target.value === '' ? '' : Number(e.target.value))}
                      />
                    </label>
                    <label className="qt-field">
                      {drill.mode === 'time' ? 'Seconds per set' : 'Reps per set'}
                      <input
                        type="number"
                        min={drill.mode === 'time' ? 10 : 1}
                        max={drill.mode === 'time' ? 1200 : 100}
                        step="1"
                        required
                        value={targets[index][drill.mode === 'time' ? 'durationSec' : 'reps']}
                        onChange={(e) =>
                          change(
                            index,
                            drill.mode === 'time' ? 'durationSec' : 'reps',
                            e.target.value === '' ? '' : Number(e.target.value)
                          )
                        }
                      />
                    </label>
                    <label className="qt-field">
                      Rest seconds
                      <input
                        type="number"
                        min="0"
                        max="300"
                        step="1"
                        required
                        value={targets[index].restSec}
                        onChange={(e) => change(index, 'restSec', e.target.value === '' ? '' : Number(e.target.value))}
                      />
                    </label>
                    <label className="qt-field">
                      Sides
                      <select value={targets[index].side} onChange={(e) => change(index, 'side', e.target.value)}>
                        <option value="both">Both together</option>
                        <option value="each">Each side</option>
                      </select>
                    </label>
                  </fieldset>
                  <details>
                    <summary>Research sources</summary>
                    <ul>
                      {drill.sources.map((source) => (
                        <li key={source.url}>
                          <a href={source.url} target="_blank" rel="noreferrer">
                            {source.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
            </ol>
            {dirty && (
              <p role="status" className="pb-review-unsaved" title="Unsaved changes">
                <Icon name="pencil" size={18} />
                <span className="qt-visually-hidden">Unsaved changes</span>
              </p>
            )}
            <Button type="submit" disabled={disabled || !dirty}>
              Save target changes
            </Button>
            <p className="qt-fine-print">Target edits do not run research.</p>
          </form>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void act('revise')
            }}
          >
            <label className="qt-field">
              Revision feedback
              <textarea
                required
                maxLength={1000}
                rows={3}
                disabled={disabled}
                value={feedback}
                onChange={(e) => {
                  setFeedback(e.target.value)
                  setChecked(false)
                }}
                placeholder="Explain which drills, instructions or videos should change."
              />
            </label>
            <p className="qt-fine-print">Uses another research run. Feedback is sent to the research provider.</p>
            <Button variant="secondary" type="submit" disabled={disabled || dirty || !feedback.trim() || paused}>
              Request changes
            </Button>
            {paused && <p>Research is paused.</p>}
          </form>
          <section className="pb-review-approve" aria-label="Approve this version">
            <label>
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled || dirty || !!feedback.trim()}
                onChange={(e) => setChecked(e.target.checked)}
              />{' '}
              I reviewed the instructions, targets and demonstrations for this version.
            </label>
            {job.recipientCount > 0 && <p>Notifies {job.recipientCount} recipients after publication.</p>}
            <Button disabled={disabled || dirty || !!feedback.trim() || !checked} onClick={() => void act('approve')}>
              {busy ? 'Saving review…' : 'Approve for publishing'}
            </Button>
          </section>
        </div>
      </Dialog>
      {overlay?.type === 'preview' && (
        <Dialog title="Player preview" className="pb-review-dialog" onClose={() => setOverlay(null)}>
          <p>{dirty ? 'Preview includes unsaved edits.' : null}</p>
          <TodayView
            assignment={preview}
            preview
            onWatchDrill={(drill) => setOverlay({ type: 'video', drill })}
            onOpenDrill={(drill) => setOverlay({ type: 'drill', drill })}
          />
        </Dialog>
      )}
      {overlay?.type === 'drill' && (
        <Dialog title={overlay.drill.title} onClose={() => setOverlay({ type: 'preview' })}>
          <DrillPreview drill={overlay.drill} />
        </Dialog>
      )}
      {overlay?.type === 'video' && (
        <Dialog title={overlay.drill.title} className="qt-video-dialog" onClose={() => setOverlay(null)}>
          <DrillDemonstration media={overlay.drill.media} title={overlay.drill.title} autoPlay />
        </Dialog>
      )}
    </>
  )
}
