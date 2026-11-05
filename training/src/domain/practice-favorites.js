export const practiceKey = practice => `${practice.id}:${practice.revision}`
export function readFavorites(source) {
  if (source === null) return []
  if (typeof source !== 'string' || source.length > 100000) throw new Error('Starred practices could not be read.')
  const data = JSON.parse(source)
  if (data?.version !== 1 || !Array.isArray(data.keys) || data.keys.length > 300 || data.keys.some(key => typeof key !== 'string' || key.length > 260)) throw new Error('Starred practices use an unsupported format.')
  return [...new Set(data.keys)]
}
export function toggleFavorite(storage, key, expected, practice) {
  if (storage.getItem(key) !== expected) throw new Error('Your stars changed in another tab. Reload before changing them.')
  const identity = practiceKey(practice)
  const keys = readFavorites(expected)
  const next = keys.includes(identity) ? keys.filter(item => item !== identity) : [...keys, identity]
  if (next.length > 300) throw new Error('This device has reached its starred practice limit.')
  const source = JSON.stringify({ version: 1, keys: next })
  storage.setItem(key, source)
  return { keys: next, source }
}
