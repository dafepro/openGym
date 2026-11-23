import { expect, it } from 'vitest'
import { writeCoachNotes, readCoachNotes } from '../lib/coach.js'
import { build } from '../../../api/coach/core/payload.js'
import { withoutWatch } from '../lib/garmin.js'
import { exportBackupZip, readBackupFile } from '../lib/backup-media.js'
import { backupTo, readBackup } from '../lib/webdav.js'
import { cloudState } from '../lib/cloud-sync.js'

it('keeps pre-intake notes without skipping intake; notes, chat and workouts survive full backups', async () => {
  const s = { unit: 'kg', routines: [], workouts: [{ d: '2026-01-02', name: 'Fixture session', entries: [] }] }
  writeCoachNotes(s, 'draft')
  expect(s.coach.profile).toBeFalsy()
  expect(readCoachNotes(s)).toBe('draft')
  s.coach.profile = { notes: 'older intake' }
  writeCoachNotes(s, 'new fixture note')
  s.coach.chat = [{ role: 'user', kind: 'text', text: 'fixture conversation' }]
  const payload = build(s, { handle: 'test', kind: 'ask', note: 'follow up', includeConversation: true })
  expect(payload.coachProfile.notes).toBe('new fixture note')
  expect(payload.conversation[0].text).toBe('fixture conversation')
  expect(payload.window.workouts[0].name).toBe('Fixture session')
  const files = new Map()
  const dav = { put: async (k, v) => files.set(k, v), get: async (k) => files.get(k), index: async () => [] }
  const { name } = await backupTo(dav, s)
  const zipped = await exportBackupZip(s)
  for (const copy of [
    cloudState(s),
    JSON.parse(await readBackup(dav, name)),
    (await readBackupFile(new File([JSON.stringify(withoutWatch(s))], 'backup.json'))).state,
    (await readBackupFile(new File([zipped.blob], 'backup.zip'))).state
  ]) {
    expect(readCoachNotes(copy)).toBe('new fixture note')
    expect(copy.coach.chat).toEqual(s.coach.chat)
  }
  writeCoachNotes(s, '')
  expect(readCoachNotes(s)).toBe('')
})
