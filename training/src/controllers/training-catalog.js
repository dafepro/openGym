import { validateCatalog } from '../domain/index.js'

export async function fetchTrainingCatalog(fetcher = fetch, signal) {
  const response = await fetcher('/api/catalog', { credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/json' }, signal })
  if (!response.ok) throw new Error('The training library is temporarily unavailable. Please try again.')
  return validateCatalog(await response.json())
}
