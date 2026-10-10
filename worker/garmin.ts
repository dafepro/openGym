import {
  isWatchEvent,
  isWatchCommand,
  isWatchReceipt,
  isWatchSnapshot,
  MAX_EVENTS,
  object,
  type WatchEvent,
  type WatchCommand,
  type WatchReceipt,
  type WatchSnapshot,
} from '../shared/garmin';

interface Env {
  GARMIN: DurableObjectNamespace;
  PAIR_LIMIT: RateLimit;
  REQUEST_LIMIT: RateLimit;
  ASSETS: Fetcher;
  GARMIN_ENABLED: string;
  GARMIN_STORE_URL: string;
}
const DAY = 86400000;
const tokenPattern = /^[a-f0-9]{64}$/;
const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
function fail(status: number, message: string): never {
  throw json({ error: message }, status);
}
const random = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
const hash = async (text: string) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
async function body(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    fail(415, 'JSON required.');
  const reader = request.body?.getReader();
  if (!reader) fail(400, 'Missing request.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 24576) {
      await reader.cancel();
      fail(413, 'Request too large.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    fail(400, 'Invalid JSON.');
  }
  if (!object(value)) fail(400, 'Invalid request.');
  return value;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      if (request.headers.has('origin') && request.headers.get('origin') !== url.origin)
        fail(403, 'Origin rejected.');
      if (url.pathname === '/api/garmin/config' && request.method === 'GET') {
        const storeUrl =
          /^https:\/\/apps\.garmin\.com\/(?:[a-z]{2}-[a-z]{2}\/)?apps\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/?$/i.test(
            env.GARMIN_STORE_URL ?? '',
          )
            ? env.GARMIN_STORE_URL
            : null;
        return json({ v: 1, available: env.GARMIN_ENABLED === 'true', storeUrl });
      }
      if (env.GARMIN_ENABLED !== 'true') fail(503, 'Watch connection is not enabled yet.');
      if (request.method !== 'POST') fail(405, 'POST required.');
      const isPair = url.pathname === '/api/garmin/pair' || url.pathname.endsWith('/claim');
      const key = isPair
        ? (request.headers.get('cf-connecting-ip') ?? 'local')
        : await hash(
            request.headers.get('authorization') ??
              request.headers.get('cf-connecting-ip') ??
              'local',
          );
      if (
        !(await (isPair ? env.PAIR_LIMIT : env.REQUEST_LIMIT).limit({ key: `uplift:${key}` }))
          .success
      )
        fail(429, 'Wait a minute, then try again.');
      const data = await body(request);
      if (url.pathname === '/api/garmin/pair') {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const code = Array.from(
          crypto.getRandomValues(new Uint8Array(8)),
          (b) => alphabet[b % 32],
        ).join('');
        const token = random();
        const stub = env.GARMIN.get(env.GARMIN.idFromName(code));
        const initialized = await stub.fetch('https://relay/init', {
          method: 'POST',
          body: JSON.stringify({ watchHash: await hash(token) }),
        });
        if (!initialized.ok) fail(409, 'Try pairing again.');
        return json({ v: 1, id: code, token, expires: 600 });
      }
      const match = /^\/api\/garmin\/([A-HJ-NP-Z2-9]{8})\/(claim|phone|watch|revoke)$/.exec(
        url.pathname,
      );
      if (!match) fail(404, 'Unknown watch endpoint.');
      return env.GARMIN.get(env.GARMIN.idFromName(match[1])).fetch(`https://relay/${match[2]}`, {
        method: 'POST',
        headers: { Authorization: request.headers.get('authorization') ?? '' },
        body: JSON.stringify(data),
      });
    } catch (error) {
      return error instanceof Response
        ? error
        : json({ error: 'Watch relay unavailable. Try again.' }, 503);
    }
  },
};

interface Connection {
  watchHash: string;
  phoneHash?: string;
  challenge?: string;
  paired: boolean;
  expires: number;
  dataExpires: number;
  watchSeen: number;
  watchRevision?: number;
  phoneSeen: number;
  revision: number;
  phoneRevision: number;
  snapshot?: WatchSnapshot;
  events: WatchEvent[];
  commands?: WatchCommand[];
  receipts: WatchReceipt[];
}

/** One isolated mailbox per pair. Tokens are hashed; no account, notes, history or body weight. */
export class GarminRelay {
  constructor(private ctx: DurableObjectState) {}
  async fetch(request: Request): Promise<Response> {
    return this.ctx.blockConcurrencyWhile(async () => {
      try {
        const path = new URL(request.url).pathname;
        const data = (await request.json()) as Record<string, unknown>;
        const now = Date.now();
        let state = await this.ctx.storage.get<Connection>('connection');
        if (state && state.expires <= now) {
          await this.ctx.storage.deleteAll();
          state = undefined;
        }
        if (path === '/init') {
          if (state) fail(409, 'Pair already exists.');
          if (typeof data.watchHash !== 'string' || !tokenPattern.test(data.watchHash))
            fail(400, 'Invalid token.');
          state = {
            watchHash: data.watchHash,
            paired: false,
            expires: now + 600000,
            dataExpires: now + 600000,
            watchSeen: 0,
            phoneSeen: 0,
            revision: 0,
            phoneRevision: -1,
            events: [],
            receipts: [],
          };
          await this.save(state);
          return json({ ok: true });
        }
        if (!state) fail(410, 'Pairing expired. Open Uplift on the watch to pair again.');
        if (path === '/claim') {
          if (typeof data.token !== 'string' || !tokenPattern.test(data.token))
            fail(400, 'Invalid token.');
          const phoneHash = await hash(data.token);
          if (state.phoneHash && state.phoneHash !== phoneHash)
            fail(409, 'Code already claimed. Generate a new code on the watch.');
          if (state.paired) return json({ phase: 'paired' });
          state.phoneHash = phoneHash;
          state.challenge ??= String(
            crypto.getRandomValues(new Uint32Array(1))[0] % 10000,
          ).padStart(4, '0');
          await this.save(state);
          return json({ phase: 'confirm', challenge: state.challenge });
        }
        const token = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
        if (!tokenPattern.test(token)) fail(401, 'Pair again in Settings.');
        const tokenHash = await hash(token);
        const watch = tokenHash === state.watchHash;
        const phone = tokenHash === state.phoneHash;
        if (
          (path === '/watch' && !watch) ||
          (path === '/phone' && !phone) ||
          (path === '/revoke' && !watch && !phone)
        )
          fail(401, 'Pair again in Settings.');
        if (path === '/revoke') {
          await this.ctx.storage.deleteAll();
          return json({ ok: true });
        }
        if (!state.paired) {
          if (watch && state.challenge && data.approve === state.challenge) {
            state.paired = true;
            state.challenge = undefined;
            state.expires = now + 30 * DAY;
          } else {
            return json({
              phase: state.phoneHash ? 'confirm' : 'waiting',
              challenge: state.challenge,
            });
          }
        }
        if (state.dataExpires <= now) {
          state.snapshot = undefined;
          state.events = [];
          state.commands = [];
          state.receipts = [];
          state.revision++;
        }
        state.expires = now + 30 * DAY;
        if (phone) {
          if (
            !Number.isSafeInteger(data.revision) ||
            (data.revision as number) < 0 ||
            !isWatchSnapshot(data.snapshot) ||
            !Array.isArray(data.receipts) ||
            data.receipts.length > MAX_EVENTS ||
            !data.receipts.every(isWatchReceipt)
          )
            fail(400, 'Invalid phone snapshot.');
          if ((data.revision as number) < state.phoneRevision)
            fail(409, 'Another tab has newer workout data. Reload this tab.');
          state.phoneRevision = data.revision as number;
          if (JSON.stringify(state.snapshot) !== JSON.stringify(data.snapshot)) {
            state.snapshot = data.snapshot;
            state.revision++;
          }
          for (const receipt of data.receipts) {
            if (
              [...state.events, ...(state.commands ?? [])].some((e) => e.id === receipt.id) &&
              !state.receipts.some((r) => r.id === receipt.id)
            )
              state.receipts.push(receipt);
          }
          state.events = state.events.filter((e) => !state.receipts.some((r) => r.id === e.id));
          state.commands = (state.commands ?? []).filter(
            (e) => !state.receipts.some((r) => r.id === e.id),
          );
          state.receipts = state.receipts.slice(-600);
          state.phoneSeen = Math.floor(now / 1000);
          state.dataExpires = now + DAY;
        } else {
          if (
            !Array.isArray(data.events) ||
            data.events.length > MAX_EVENTS ||
            !data.events.every(isWatchEvent)
          )
            fail(400, 'Invalid watch entries.');
          const commands = data.commands ?? [];
          if (!Array.isArray(commands) || commands.length > 1 || !commands.every(isWatchCommand))
            fail(400, 'Invalid watch action.');
          // New watch operations are strictly ordered: do not mix a command with set entries.
          if (commands.length && data.events.length) fail(400, 'Send earlier sets before actions.');
          state.commands ??= [];
          for (const command of commands) {
            if (
              state.commands.some((c) => c.id === command.id) ||
              state.receipts.some((r) => r.id === command.id)
            )
              continue;
            if (state.commands.length + state.events.length >= MAX_EVENTS)
              fail(409, 'Open Uplift on phone.');
            state.commands.push(command);
          }
          for (const event of data.events) {
            if (
              state.events.some((e) => e.id === event.id) ||
              state.receipts.some((r) => r.id === event.id)
            )
              continue;
            if (state.events.length + state.commands.length >= MAX_EVENTS)
              fail(409, 'Open Uplift on the phone to transfer entries.');
            state.events.push(event);
          }
          if (data.events.length || commands.length) state.dataExpires = now + DAY;
          state.watchSeen = Math.floor(now / 1000);
          state.watchRevision =
            Number.isSafeInteger(data.known) &&
            (data.known as number) >= 0 &&
            (data.known as number) <= state.revision
              ? (data.known as number)
              : undefined;
        }
        await this.save(state);
        return json({
          phase: 'paired',
          revision: state.revision,
          watchSeen: state.watchSeen,
          phoneSeen: state.phoneSeen,
          ...(phone
            ? {
                events: state.events,
                commands: state.commands ?? [],
                watchRevision: state.watchRevision,
              }
            : {
                ...(data.known !== state.revision
                  ? {
                      snapshot: state.snapshot ?? {
                        v: 1,
                        workout: null,
                        preferences: { vibrate: true, restAlert: true, weightStep: 2.5 },
                        issue: 'Open Uplift on phone',
                      },
                    }
                  : {}),
                receipts: state.receipts.filter((r) =>
                  [
                    ...(data.events as WatchEvent[]),
                    ...((data.commands ?? []) as WatchCommand[]),
                  ].some((e) => e.id === r.id),
                ),
              }),
        });
      } catch (error) {
        return error instanceof Response
          ? error
          : json({ error: 'Watch relay unavailable. Try again.' }, 503);
      }
    });
  }
  private async save(state: Connection) {
    await this.ctx.storage.put('connection', state);
    await this.ctx.storage.setAlarm(Math.min(state.expires, state.dataExpires));
  }
  async alarm() {
    await this.ctx.blockConcurrencyWhile(async () => {
      const state = await this.ctx.storage.get<Connection>('connection');
      if (!state || state.expires <= Date.now()) {
        await this.ctx.storage.deleteAll();
        return;
      }
      if (state.dataExpires > Date.now()) {
        await this.save(state);
        return;
      }
      state.snapshot = undefined;
      state.events = [];
      state.commands = [];
      state.receipts = [];
      state.revision++;
      state.dataExpires = state.expires;
      await this.save(state);
    });
  }
}
