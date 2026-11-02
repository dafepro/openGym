export const HISTORY_LIMIT = 100
const RECORD_FIELDS = ['schemaVersion', 'id', 'drillId', 'date', 'plannedSeconds', 'practiceSeconds', 'completedDuration', 'manualRepetitions', 'cameraUsed', 'targetArrivals', 'metricSources']
const SOURCE_FIELDS = ['practiceSeconds', 'manualRepetitions', 'targetArrivals']
const exactKeys = (value, fields) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === fields.length && fields.every(key => Object.hasOwn(value, key))
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(value)
const validCount = value => Number.isSafeInteger(value) && value >= 0 && value <= 99999
function validRecord(row) {
  if (!exactKeys(row, RECORD_FIELDS) || row.schemaVersion !== 1 || !validId(row.id) || !validId(row.drillId)) return false
  if (typeof row.date !== 'string' || !Number.isFinite(Date.parse(row.date)) || new Date(row.date).toISOString() !== row.date) return false
  if (!Number.isInteger(row.plannedSeconds) || row.plannedSeconds < 10 || row.plannedSeconds > 600 || !Number.isFinite(row.practiceSeconds) || row.practiceSeconds < 0 || row.practiceSeconds > row.plannedSeconds) return false
  if (typeof row.completedDuration !== 'boolean' || row.completedDuration !== (row.practiceSeconds >= row.plannedSeconds)) return false
  if (row.manualRepetitions !== null && !validCount(row.manualRepetitions)) return false
  if (typeof row.cameraUsed !== 'boolean' || !(row.cameraUsed ? validCount(row.targetArrivals) : row.targetArrivals === null)) return false
  return exactKeys(row.metricSources, SOURCE_FIELDS) && row.metricSources.practiceSeconds === 'observed-timer' && row.metricSources.manualRepetitions === 'manual' && row.metricSources.targetArrivals === (row.cameraUsed ? 'experimental-camera' : null)
}
function canonicalRecord(row) {
  if (!validRecord(row)) throw new Error('This round format is invalid. Existing local data has been kept.')
  return Object.fromEntries(RECORD_FIELDS.map(key => [key, key === 'metricSources' ? Object.fromEntries(SOURCE_FIELDS.map(field => [field, row.metricSources[field]])) : row[key]]))
}
export function readHistory(storage, key) {
  const raw = storage.getItem(key)
  if (raw === null) return []
  let data
  try { data = JSON.parse(raw) } catch { throw new Error('Local history could not be read. Existing data has been kept; export a raw backup before clearing it.') }
  if (!exactKeys(data, ['schemaVersion', 'records']) || data.schemaVersion !== 1 || !Array.isArray(data.records) || data.records.length > HISTORY_LIMIT || !data.records.every(validRecord) || new Set(data.records.map(row => row.id)).size !== data.records.length) throw new Error('This local history format is unsupported or invalid. Existing data has been kept; export a raw backup before clearing it.')
  return data.records.map(canonicalRecord)
}
export function saveHistory(storage, key, record) {
  const canonical = canonicalRecord(record)
  const current = readHistory(storage, key)
  if (current.some(row => row.id === canonical.id)) return current
  const records = [canonical, ...current].slice(0, HISTORY_LIMIT)
  storage.setItem(key, JSON.stringify({ schemaVersion: 1, records }))
  return records
}
export function clearHistory(storage, key) { storage.removeItem(key) }
export function exportHistory(records) {
  if (!Array.isArray(records) || records.length > HISTORY_LIMIT || new Set(records.map(row => row.id)).size !== records.length) throw new Error('This local history could not be exported.')
  return JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), records: records.map(canonicalRecord) }, null, 2)
}
export function rawHistoryBackup(storage, key) {
  const raw = storage.getItem(key)
  if (raw === null) throw new Error('There is no local history data to back up.')
  return raw
}
