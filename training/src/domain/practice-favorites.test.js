import { expect, it } from 'vitest'
import { practiceKey, readFavorites, toggleFavorite } from './practice-favorites.js'

it('persists stars by exact practice edition and refuses stale-tab writes', () => {
  let source = null
  const storage = { getItem: () => source, setItem: (_, value) => { source = value } }
  const practice = { id: 'shared-123', revision: 'qt2' }
  expect(readFavorites(null)).toEqual([])
  const first = toggleFavorite(storage, 'stars', null, practice)
  expect(readFavorites(source)).toEqual([practiceKey(practice)])
  expect(() => toggleFavorite(storage, 'stars', null, practice)).toThrow('another tab')
  const second = toggleFavorite(storage, 'stars', first.source, { ...practice, revision: 'qt3' })
  expect(second.keys).toHaveLength(2)
  expect(toggleFavorite(storage, 'stars', second.source, practice).keys).toEqual(['shared-123:qt3'])
})
it('refuses unsupported, malformed and excessive star records', () => {
  for (const value of ['{', '{}', JSON.stringify({ version: 2, keys: [] }), JSON.stringify({ version: 1, keys: [1] }), JSON.stringify({ version: 1, keys: Array(301).fill('a') })]) expect(() => readFavorites(value)).toThrow()
})
