import { expect, it, vi } from 'vitest'
import { fetchTrainingCatalog } from './training-catalog.js'

it('loads the catalog anonymously and rejects invalid content', async () => {
  const fetcher = vi.fn(async () => Response.json({ assignments: [] }))
  await expect(fetchTrainingCatalog(fetcher)).rejects.toThrow()
  expect(fetcher).toHaveBeenCalledWith('/api/catalog', expect.objectContaining({ credentials: 'omit', cache: 'no-store' }))
})
it('reports temporary server failure without asking for a password', async () => {
  await expect(fetchTrainingCatalog(async () => new Response(null, { status: 503 }))).rejects.toThrow('temporarily unavailable')
})
