import { describe, expect, it } from 'vitest'
import { clearHistory, exportHistory, HISTORY_LIMIT, readHistory, rawHistoryBackup, saveHistory } from './history.js'
import { createRound, summarizeRound, transitionRound } from './round.js'
const storage = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) } }
const record = id => summarizeRound(transitionRound(transitionRound(createRound({ id, drillId: 'bc-side-roll', durationSeconds: 30 }), 'start', 0), 'finish', 4500))
describe('isolated local ball-control history', () => {
  it('survives reload, deduplicates saves and keeps namespaces separate', () => {
    const local = storage(); local.setItem('assigned', 'original')
    saveHistory(local, 'ball', record('one')); saveHistory(local, 'ball', record('one'))
    expect(readHistory(local, 'ball')).toHaveLength(1); expect(readHistory(local, 'demo-ball')).toEqual([])
    clearHistory(local, 'ball'); expect(readHistory(local, 'ball')).toEqual([]); expect(local.getItem('assigned')).toBe('original')
  })
  it('bounds history and exports the same summaries without frames', () => {
    const local = storage()
    for (let i = 0; i < HISTORY_LIMIT + 2; i++) saveHistory(local, 'ball', record(String(i)))
    const records = readHistory(local, 'ball')
    expect(records).toHaveLength(HISTORY_LIMIT); expect(records[0].id).toBe('101'); expect(records.at(-1).id).toBe('2')
    expect(JSON.parse(exportHistory(records)).records).toEqual(records)
  })
  it('fails visibly without overwriting malformed or future data', () => {
    const local = storage()
    for (const raw of ['{bad', JSON.stringify({ schemaVersion: 2, records: [] }), JSON.stringify({ schemaVersion: 1, records: [{ id: 'untrusted' }] })]) {
      local.setItem('ball', raw); expect(() => readHistory(local, 'ball')).toThrow(); expect(() => saveHistory(local, 'ball', record('new'))).toThrow(); expect(local.getItem('ball')).toBe(raw)
    }
  })
  it('does not report success on storage failure', () => {
    const local = storage(); local.setItem = () => { throw new Error('Quota exceeded') }
    expect(() => saveHistory(local, 'ball', record('one'))).toThrow('Quota'); expect(readHistory(local, 'ball')).toEqual([])
  })
})

describe('untrusted history evidence', () => {
  it('rejects misleading completion, invented sources, unsafe counts and arbitrary extra fields', () => {
    const local = storage(), original = record('safe')
    const invalid = [
      { ...original, completedDuration: true },
      { ...original, metricSources: { ...original.metricSources, targetArrivals: 'verified-foot-contact' } },
      { ...original, arbitraryBlob: 'untrusted' },
      { ...original, manualRepetitions: Number.MAX_SAFE_INTEGER },
      { ...original, cameraUsed: true, targetArrivals: 999999, metricSources: { ...original.metricSources, targetArrivals: 'experimental-camera' } },
      { ...original, id: '' },
      { ...original, id: 'x'.repeat(129) },
      { ...original, metricSources: { ...original.metricSources, additionalSource: 'claimed' } },
    ]
    for (const row of invalid) {
      const raw = JSON.stringify({ schemaVersion: 1, records: [row] })
      local.setItem('ball', raw)
      expect(() => readHistory(local, 'ball')).toThrow()
      expect(() => exportHistory([row])).toThrow()
      expect(rawHistoryBackup(local, 'ball')).toBe(raw)
      expect(local.getItem('ball')).toBe(raw)
    }
  })
  it('rejects duplicate persisted identities instead of displaying duplicate evidence', () => {
    const local = storage(), row = record('same')
    local.setItem('ball', JSON.stringify({ schemaVersion: 1, records: [row, row] }))
    expect(() => readHistory(local, 'ball')).toThrow()
    expect(() => exportHistory([row, row])).toThrow()
  })
})

describe('summary serialization at the duration boundary', () => {
  it('saves a submillisecond partial round without claiming completion early', () => {
    const local = storage()
    const started = transitionRound(createRound({ id: 'boundary', drillId: 'bc-side-roll', durationSeconds: 30 }), 'start', 0)
    const summary = summarizeRound(transitionRound(started, 'finish', 29999.6))
    expect(summary.practiceSeconds).toBe(29.999)
    expect(summary.completedDuration).toBe(false)
    expect(() => saveHistory(local, 'ball', summary)).not.toThrow()
    expect(readHistory(local, 'ball')[0]).toEqual(summary)
    const complete = summarizeRound(transitionRound({ ...started, id: 'completed-boundary' }, 'finish', 30000))
    expect(complete.practiceSeconds).toBe(30)
    expect(complete.completedDuration).toBe(true)
    expect(() => saveHistory(local, 'ball', complete)).not.toThrow()
  })
})
