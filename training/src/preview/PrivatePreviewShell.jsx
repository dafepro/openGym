import { useEffect, useState } from 'react'
import { validateCatalog } from '../domain/index.js'
import TrainingExperience from '../components/TrainingExperience.jsx'
import TrainingShell from '../components/TrainingShell.jsx'
import { LoadingState, Notice } from '../components/ui.jsx'

export const PRIVATE_PREVIEW_SENTINEL = 'LOCAL_PRIVATE_TRAINING_PREVIEW_ONLY'

export default function PrivatePreviewShell({ route }) {
  const [catalog, setCatalog] = useState(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const abort = new AbortController()
    setError(false)
    fetch('/__training-preview/catalog', { cache: 'no-store', credentials: 'omit', signal: abort.signal })
      .then(response => { if (!response.ok) throw new Error('Unavailable preview'); return response.json() })
      .then(content => { if (!abort.signal.aborted) setCatalog(validateCatalog(content)) })
      .catch(() => { if (!abort.signal.aborted) setError(true) })
    return () => abort.abort()
  }, [attempt])
  return <div data-preview={PRIVATE_PREVIEW_SENTINEL}>{catalog ? <TrainingExperience route={route} catalog={catalog} databaseName="quicktrack-training-private-preview" localPreview /> : <TrainingShell page={route} localPreview>{error ? <Notice title="Local preview unavailable" tone="error" action="Try again" onAction={() => setAttempt(value => value + 1)}>Check the private bundle and restart its local preview server. No hosted family access has been configured by this preview.</Notice> : <LoadingState label="Opening private local videos" />}</TrainingShell>}</div>
}
