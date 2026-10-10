import { expect, it, vi } from 'vitest';
import { GarminRelay } from './garmin';
import { defaultWatchPreferences, type WatchCommand } from '../shared/garmin';
import { watchSnapshot, bindWatchLayout } from '../frontend/src/lib/garmin.js';

async function relay() {
  const records = new Map<string, unknown>();
  const storage = {
    get: async (key: string) => structuredClone(records.get(key)),
    put: async (key: string, value: unknown) => {
      records.set(key, structuredClone(value));
    },
    deleteAll: async () => {
      records.clear();
    },
    setAlarm: vi.fn(),
  };
  const ctx = { storage, blockConcurrencyWhile: (fn: () => Promise<unknown>) => fn() };
  const mailbox = new GarminRelay(ctx as unknown as DurableObjectState);
  const watchToken = 'a'.repeat(64);
  const phoneToken = 'b'.repeat(64);
  const digest = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(watchToken))),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
  async function request(path: string, data: unknown, token = watchToken) {
    const response = await mailbox.fetch(
      new Request(`https://relay.test/${path}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      }),
    );
    return { status: response.status, body: (await response.json()) as Record<string, any> };
  }
  await request('init', { watchHash: digest });
  const claim = await request('claim', { token: phoneToken });
  await request('watch', { approve: claim.body.challenge, known: -1, events: [] });
  const state = { unit: 'kg', restSec: 90, active: { id: 'synthetic-watch', name: 'Test', start: Date.now(), cur: 0, entries: [0, 1, 2].map(i => ({ id: ['0043', '0025', '0085'][i], target: { reps: 5 }, sets: Array.from({ length: 5 }, () => ({ w: 40, r: 5, done: false })) })) } };
  bindWatchLayout(state);
  const snapshot = watchSnapshot(state, defaultWatchPreferences);
  const event = {
    id: `${state.active.id}:0:0:1`,
    session: state.active.id,
    lift: 0,
    set: 0,
    reps: 8,
    weight: 45,
    exercise: 'Bench Press',
    unit: 'lb',
    at: Math.floor(Date.now() / 1000),
    expected: [45, 8],
  };
  const command = {
    id: `${state.active.id}:cmd:2`,
    session: state.active.id,
    at: event.at,
    kind: 'finish',
    recorded: 1,
    total: snapshot.workout!.sets.length,
  };
  const phone = (receipts: unknown[] = []) =>
    request('phone', { revision: 1, snapshot, receipts }, phoneToken);
  const skip: WatchCommand = {
    id: `${state.active.id}:cmd:3`,
    session: state.active.id,
    at: event.at,
    kind: 'skip-exercise',
    lift: snapshot.workout!.focus!,
    expected: snapshot.workout!.sets.filter((s) => s[0] === snapshot.workout!.focus && s[6] === -1),
  };
  return { request, phone, event, command, skip, snapshot, mailbox, records };
}

it('preserves preparation metadata and distinct warm-up receipts through command barriers and lost replies', async () => {
  const { request, phone, event, skip, snapshot } = await relay();
  await phone();
  const prepare = { ...skip, kind: 'prepare', from: 'setup', to: 'warmup' };
  await request('watch', { known: -1, events: [], commands: [prepare] });
  expect((await phone()).body.commands).toEqual([prepare]);
  await phone([{ id: prepare.id, status: 'saved' }]);
  const warmup = { ...event, scope: 'warmup', id: `${event.session}:warmup:0:0:4` };
  for (let i = 0; i < 2; i++)
    expect((await request('watch', { known: -1, events: [warmup], commands: [] })).status).toBe(
      200,
    );
  expect((await phone()).body.events).toEqual([warmup]);
  await phone([{ id: warmup.id, status: 'saved' }]);
  const reply = await request('watch', { known: -1, events: [warmup], commands: [] });
  expect(reply.body.snapshot.workout.prep).toEqual(snapshot.workout!.prep);
  expect(reply.body.receipts).toContainEqual({ id: warmup.id, status: 'saved' });
  expect((await phone()).body.events).toEqual([]);
  const station = { ...skip, id: `${event.session}:cmd:5`, kind: 'station', from: 1 };
  expect((await request('watch', { events: [], commands: [station] })).status).toBe(200);
  expect((await phone()).body.commands).toEqual([station]);
});

it('relays a set then a finish, deduplicates retries, and retains phone receipts after a lost watch reply', async () => {
  const { request, phone, event, command } = await relay();
  await phone();
  for (let i = 0; i < 2; i++)
    expect((await request('watch', { known: -1, events: [event], commands: [] })).status).toBe(200);
  expect((await phone()).body.events).toEqual([event]);
  await phone([{ id: event.id, status: 'saved' }]);
  const acknowledged = await request('watch', { known: -1, events: [event], commands: [] });
  expect(acknowledged.body.receipts).toEqual([{ id: event.id, status: 'saved' }]);
  await request('watch', { known: -1, events: [], commands: [command] });
  expect((await phone()).body).toMatchObject({ events: [], commands: [command] });
  await phone([{ id: command.id, status: 'saved' }]);
  for (let i = 0; i < 2; i++) {
    expect(
      (await request('watch', { known: -1, events: [], commands: [command] })).body.receipts,
    ).toEqual([{ id: command.id, status: 'saved' }]);
  }
  expect((await phone()).body.commands).toEqual([]);
});

it('rejects mixed or malformed commands without changing queued workout data', async () => {
  const { request, phone, event, command } = await relay();
  await phone();
  expect((await request('watch', { events: [event], commands: [command] })).status).toBe(400);
  expect(
    (await request('watch', { events: [], commands: [{ ...command, notes: 'private' }] })).status,
  ).toBe(400);
  expect((await phone()).body).toMatchObject({ events: [], commands: [] });
});

it('relays guarded exercise skips and retains their receipt through retries', async () => {
  const { request, phone, skip } = await relay();
  await phone();
  for (let i = 0; i < 2; i++)
    expect((await request('watch', { known: -1, events: [], commands: [skip] })).status).toBe(200);
  expect((await phone()).body.commands).toEqual([skip]);
  await phone([{ id: skip.id, status: 'saved' }]);
  expect(
    (await request('watch', { known: -1, events: [], commands: [skip] })).body.receipts,
  ).toEqual([{ id: skip.id, status: 'saved' }]);
  expect((await phone()).body.commands).toEqual([]);
  expect(
    (await request('watch', { events: [], commands: [{ ...skip, expected: [] }] })).status,
  ).toBe(400);
});

it('deduplicates four-set batches and retains each durable receipt across partial acknowledgment and retries', async () => {
  const { request, phone, event } = await relay();
  const events = Array.from({ length: 4 }, (_, set) => ({
    ...event,
    set,
    id: `${event.session}:0:${set}:1`,
  }));
  for (let i = 0; i < 2; i++)
    expect((await request('watch', { known: -1, events, commands: [] })).status).toBe(200);
  expect((await phone()).body.events).toEqual(events);
  const receipts = events.map((e) => ({ id: e.id, status: 'saved' }));
  await phone(receipts.slice(0, 2));
  expect((await request('watch', { known: -1, events, commands: [] })).body.receipts).toEqual(
    receipts.slice(0, 2),
  );
  expect((await phone()).body.events).toEqual(events.slice(2));
  await phone(receipts);
  for (let i = 0; i < 2; i++)
    expect((await request('watch', { known: -1, events, commands: [] })).body.receipts).toEqual(
      receipts,
    );
  expect((await phone()).body.events).toEqual([]);
});

it('reports watch-applied revisions only after a subsequent watch request and invalidates readiness when the phone changes its snapshot', async () => {
  const { request, phone, snapshot } = await relay();
  const sent = await phone();
  expect(sent.body.watchRevision).not.toBe(sent.body.revision);
  const downloaded = await request('watch', { known: -1, events: [] });
  expect((await phone()).body.watchRevision).toBeUndefined();
  await request('watch', { known: downloaded.body.revision, events: [] });
  const ready = (await phone()).body;
  expect(ready.watchRevision).toBe(ready.revision);
  const changed = await request(
    'phone',
    { revision: 2, snapshot: { ...snapshot, issue: 'Changed workout' }, receipts: [] },
    'b'.repeat(64),
  );
  expect(changed.body.watchRevision).not.toBe(changed.body.revision);
  await request('watch', { known: changed.body.revision + 100, events: [] });
  expect(
    (await request('phone', { revision: 2, snapshot, receipts: [] }, 'b'.repeat(64))).body
      .watchRevision,
  ).toBeUndefined();
});

it('retries a lost phone claim idempotently after watch approval without exposing or replacing credentials', async () => {
  const { request } = await relay();
  expect((await request('claim', { token: 'b'.repeat(64) })).body.phase).toBe('paired');
  expect((await request('claim', { token: 'c'.repeat(64) })).status).toBe(409);
});
