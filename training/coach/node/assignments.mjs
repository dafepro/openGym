import { coachProfile } from '../auth.js'
import { json, readLimited } from '../../worker/http.js'
import { createAssignment, changeAssignment } from '../../src/assignments/model.js'
export async function assignmentAPI(request, env, store) {
  const path = new URL(request.url).pathname
  const role = path.startsWith('/api/player/') ? 'player' : 'coach'
  if (role === 'player' && !env.PLAYER_ACCESS_AUD) return json({ error: 'Player sign-in setup is pending.' }, 503)
  const profile = await coachProfile(
    request,
    role === 'player' ? { ...env, COACH_ACCESS_AUD: env.PLAYER_ACCESS_AUD, COACH_ALLOWED_EMAILS: undefined } : env,
    env.TEST_FETCH || fetch
  )
  if (!profile?.email) return json({ error: 'Sign in to open assignments.' }, 401)
  if (path.endsWith('/login') || path.endsWith('/assignment-login'))
    return Response.redirect(`${env.APP_ORIGIN}/#/${role === 'coach' ? 'assignments-coach' : 'assignments'}`, 303)
  store.lease()
  const db = store.db
  db.exec(
    'CREATE TABLE IF NOT EXISTS player_assignments(id TEXT PRIMARY KEY, owner TEXT NOT NULL, email TEXT NOT NULL, value TEXT NOT NULL)'
  )
  const column = role === 'coach' ? 'owner' : 'email',
    identity = role === 'coach' ? profile.identity : profile.email
  if (request.method === 'GET') {
    const records = db
      .prepare(`SELECT value FROM player_assignments WHERE ${column}=? ORDER BY rowid DESC LIMIT 500`)
      .all(identity)
      .map((row) => JSON.parse(row.value))
      .filter((record) => role === 'coach' || !record.playerIdentity || record.playerIdentity === profile.identity)
    return json({ records: records.map(({ owner, playerIdentity, ...record }) => record) })
  }
  if (
    request.headers.get('Origin') !== env.APP_ORIGIN ||
    request.headers.get('Content-Type')?.split(';')[0] !== 'application/json' ||
    request.headers.get('Sec-Fetch-Site') === 'cross-site'
  )
    return json({ error: 'Invalid request origin' }, 403)
  let input
  try {
    input = JSON.parse(new TextDecoder().decode(await readLimited(request.body, 262144)))
  } catch {
    return json({ error: 'Invalid assignment request' }, 400)
  }
  db.exec('BEGIN IMMEDIATE')
  try {
    let record
    if (input.action === 'create' && role === 'coach') {
      if (db.prepare('SELECT count(*) AS count FROM player_assignments WHERE owner=?').get(identity).count >= 500)
        throw new Error('Assignment limit reached')
      record = createAssignment(input, identity)
      record.coachEmail = profile.email
      db.prepare('INSERT INTO player_assignments VALUES(?,?,?,?)').run(
        record.id,
        identity,
        record.email,
        JSON.stringify(record)
      )
    } else {
      const row = db
        .prepare(`SELECT value FROM player_assignments WHERE id=? AND ${column}=?`)
        .get(input.id || '', identity)
      if (!row) throw new Error('Assignment unavailable')
      const previous = JSON.parse(row.value)
      if (role === 'player' && previous.playerIdentity && previous.playerIdentity !== profile.identity)
        throw new Error('Assignment unavailable')
      record = changeAssignment(previous, input, role)
      if (role === 'player' && input.action === 'accept') record.playerIdentity = profile.identity
      db.prepare('UPDATE player_assignments SET value=? WHERE id=?').run(JSON.stringify(record), record.id)
    }
    db.exec('COMMIT')
    return json({ ok: true })
  } catch (error) {
    db.exec('ROLLBACK')
    return json({ error: error.message }, 400)
  }
}
