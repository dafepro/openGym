import { DatabaseSync } from 'node:sqlite'
import { notificationChannels } from '../notifications.js'
import { CoachRequests } from '../worker.js'

export class QuotaError extends Error {
  constructor(message) {
    super(message)
    this.status = 429
  }
}

// One database and one scheduler per service. No process-local job state is relied
// upon for recovery. BEGIN IMMEDIATE makes admission and its quota check atomic.
export class CoachStore {
  constructor(filename, env, { now = Date.now } = {}) {
    this.db = new DatabaseSync(filename)
    this.env = env
    this.now = now
    this.queues = new Map()
    this.running = false
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
      PRAGMA busy_timeout=5000; PRAGMA secure_delete=ON;
      CREATE TABLE IF NOT EXISTS records(owner TEXT NOT NULL, key TEXT NOT NULL,
        value TEXT NOT NULL, PRIMARY KEY(owner,key));
      CREATE TABLE IF NOT EXISTS alarms(owner TEXT PRIMARY KEY, due INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS deliveries(id TEXT PRIMARY KEY, created INTEGER NOT NULL,
        email INTEGER NOT NULL, sms INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS runtime_lock(id INTEGER PRIMARY KEY CHECK(id=1),
        token TEXT NOT NULL, expires INTEGER NOT NULL);`)
    this.token = crypto.randomUUID()
    try {
      this.lease(true)
    } catch (error) {
      this.db.close()
      throw error
    }
  }
  lease(acquire = false) {
    const now = this.now()
    const row = this.db
      .prepare(
        `INSERT INTO runtime_lock VALUES(1,?,?)
      ON CONFLICT(id) DO UPDATE SET token=excluded.token, expires=excluded.expires
      WHERE runtime_lock.token=excluded.token OR (? AND runtime_lock.expires < ?) RETURNING token`,
      )
      .get(this.token, now + 30000, acquire ? 1 : 0, now)
    if (!row) throw new Error('Another coach service owns this database')
  }
  limit(name, fallback) {
    const value = Number(this.env[name] ?? fallback)
    if (!Number.isSafeInteger(value) || value < 1 || value > 10000)
      throw new Error(`Invalid ${name}`)
    return value
  }
  write(owner, key, value) {
    const existing = this.db
      .prepare('SELECT value FROM records WHERE owner=? AND key=?')
      .get(owner, key)
    if (key.startsWith('job:') && !existing) {
      const rows = this.db
        .prepare("SELECT value FROM records WHERE key LIKE 'job:%'")
        .all()
        .map((r) => JSON.parse(r.value))
      const now = this.now()
      if (
        rows.length >= this.limit('COACH_MAX_RETAINED', 500) ||
        rows.filter((r) => r.createdAt > now - 86400000).length >=
          this.limit('COACH_DAILY_REQUESTS', 10) ||
        rows.filter((r) => r.createdAt > now - 30 * 86400000).length >=
          this.limit('COACH_MONTHLY_REQUESTS', 100) ||
        rows.filter((r) =>
          [
            'queued',
            'processing',
            'retrying_revision',
            'creating_pr',
            'submitted',
            'revising',
            'publishing',
          ].includes(r.status),
        ).length >= this.limit('COACH_MAX_PENDING', 5)
      )
        throw new QuotaError('The coaching allowance is full. Try again later.')
    }
    if (
      value.status === 'notifying' &&
      (!existing || JSON.parse(existing.value).status !== 'notifying')
    ) {
      const id = `${owner}.${value.id}`
      if (!this.db.prepare('SELECT id FROM deliveries WHERE id=?').get(id)) {
        const used = this.db
          .prepare(
            'SELECT COALESCE(SUM(email),0) AS email, COALESCE(SUM(sms),0) AS sms FROM deliveries WHERE created>?',
          )
          .get(this.now() - 86400000)
        const email = value.recipients.filter(
          (r) => r.channel === 'email' && notificationChannels(this.env).email,
        ).length
        const sms = value.recipients.filter(
          (r) => r.channel === 'sms' && notificationChannels(this.env).sms,
        ).length
        if (
          used.email + email > this.limit('COACH_DAILY_EMAILS', 20) ||
          used.sms + sms > this.limit('COACH_DAILY_SMS', 10)
        )
          throw new QuotaError(
            'Notification allowance reached. Review before sending.',
          )
        this.db
          .prepare('INSERT INTO deliveries VALUES(?,?,?,?)')
          .run(id, this.now(), email, sms)
      }
    }
    this.db
      .prepare(
        'INSERT INTO records VALUES(?,?,?) ON CONFLICT(owner,key) DO UPDATE SET value=excluded.value',
      )
      .run(owner, key, JSON.stringify(value))
  }
  commit(operations) {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      for (const operation of operations) operation()
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }
  storage(owner) {
    const make = (pending) => ({
      get: async (key) => {
        const row = this.db
          .prepare('SELECT value FROM records WHERE owner=? AND key=?')
          .get(owner, key)
        return row ? JSON.parse(row.value) : undefined
      },
      list: async ({ prefix }) =>
        new Map(
          this.db
            .prepare('SELECT key,value FROM records WHERE owner=?')
            .all(owner)
            .filter((r) => r.key.startsWith(prefix))
            .map((r) => [r.key, JSON.parse(r.value)]),
        ),
      put: async (key, value) => {
        const copy = structuredClone(value),
          op = () => this.write(owner, key, copy)
        pending ? pending.push(op) : this.commit([op])
      },
      delete: async (key) =>
        this.db
          .prepare('DELETE FROM records WHERE owner=? AND key=?')
          .run(owner, key),
      setAlarm: async (due) => {
        const op = () =>
          this.db
            .prepare(
              'INSERT INTO alarms VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET due=excluded.due',
            )
            .run(owner, due)
        pending ? pending.push(op) : op()
      },
      transaction: async (fn) => {
        const ops = []
        const result = await fn(make(ops))
        this.commit(ops)
        return result
      },
    })
    return make(null)
  }
  idFromName(owner) {
    return owner
  }
  get(owner) {
    if (!/^[a-f0-9]{64}$/.test(owner)) throw new Error('Invalid queue owner')
    if (!this.queues.has(owner)) {
      let tail = Promise.resolve()
      const ctx = {
        storage: this.storage(owner),
        blockConcurrencyWhile: (fn) => {
          const next = tail.then(fn)
          tail = next.catch(() => {})
          return next
        },
      }
      const queue = new CoachRequests(ctx, this.env)
      this.queues.set(owner, queue)
    }
    const queue = this.queues.get(owner)
    return {
      fetch: (request) =>
        queue.fetch(
          typeof request === 'string' ? new Request(request) : request,
        ),
    }
  }
  async tick() {
    if (this.running) return
    this.running = true
    try {
      this.lease()
      const next = this.db
        .prepare(
          'SELECT owner FROM alarms WHERE due<=? ORDER BY due,owner LIMIT 1',
        )
        .get(this.now())
      if (!next) return
      this.get(next.owner)
      try {
        await this.queues.get(next.owner).alarm()
      } catch (error) {
        // A notification quota is not a reason to automatically retry sending.
        if (!(error instanceof QuotaError)) throw error
        const storage = this.storage(next.owner)
        for (const [key, job] of await storage.list({ prefix: 'job:' })) {
          if (job.status === 'ready')
            await storage.put(key, {
              ...job,
              status: 'notification_attention',
              recipients: [],
              reason: error.message,
            })
        }
      }
      this.db
        .prepare(
          'DELETE FROM alarms WHERE owner NOT IN (SELECT DISTINCT owner FROM records)',
        )
        .run()
      this.db
        .prepare('DELETE FROM deliveries WHERE created<?')
        .run(this.now() - 31 * 86400000)
      // Avoid retaining a queue object for every historical identity forever.
      // Keep the same per-owner mutex while HTTP requests may still be active.
    } finally {
      this.running = false
    }
  }
  close() {
    this.db.prepare('DELETE FROM runtime_lock WHERE token=?').run(this.token)
    this.db.close()
  }
}
