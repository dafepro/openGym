import { expect, it } from 'vitest';
import { bindWatchLayout, watchSnapshot, applyWatchOperations } from '../frontend/src/lib/garmin.js';
import { defaultWatchPreferences } from '../shared/garmin';

const origin = process.env.GARMIN_TEST_ORIGIN;
// Explicit opt-in: isolated synthetic mailbox, revoked in finally; never a user's pairing.
it.skipIf(!origin)('live Garmin pairing, warm-up/work handoff, receipts, retries, finish and revocation', async () => {
  expect(origin).toMatch(/^(https:\/\/uplift\.quicktrack\.cc|http:\/\/localhost:8788)$/);
  const request = async (path: string, data?: unknown, credential?: string, headers = {}) => {
    const reply = await fetch(origin + '/api/garmin/' + path, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', ...(credential ? { Authorization: 'Bearer ' + credential } : {}) },
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: AbortSignal.timeout(15000),
    });
    expect(reply.headers.get('cache-control')).toBe('no-store');
    return { status: reply.status, body: await reply.json() };
  };
  expect((await request('config')).body).toMatchObject({ v: 1, available: true });
  expect((await request('pair', {}, undefined, { Origin: 'https://invalid.test' })).status).toBe(403);
  const pair = await request('pair', {});
  expect(pair.status).toBe(200);
  const { id, token } = pair.body;
  const phoneToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
  const phone = (body: unknown) => request(id + '/phone', body, phoneToken);
  const watch = (body: unknown) => request(id + '/watch', body, token);
  let revision = 1;
  let state: any = { unit: 'kg', restSec: 90, workouts: [], routines: [], exWeights: {}, active: {
    id: 'release-check-' + crypto.randomUUID(), name: 'Synthetic release check', d: new Date().toISOString().slice(0, 10),
    start: Date.now() - 60000, cur: 0, entries: [{ id: '0043', target: { reps: 5 }, sets: [
      { w: 20, r: 5, phase: 'warmup', done: false }, { w: 40, r: 5, done: false }, { w: 40, r: 5, done: false },
    ] }],
  } };
  bindWatchLayout(state);
  const snapshot = () => watchSnapshot(state, defaultWatchPreferences);
  const upload = () => phone({ revision: revision++, snapshot: snapshot(), receipts: state._watch?.receipts || [] });
  let sequence = 0;
  const command = (kind: string, extra = {}) => ({ id: `${state.active.id}:cmd:${++sequence}`, session: state.active.id,
    at: Math.floor(Date.now() / 1000), kind, ...extra });
  const expected = () => snapshot().workout!.sets.filter((s: any) => s[0] === 0 && s[6] === -1);
  async function apply(events: any[] = [], commands: any[] = []) {
    expect((await watch({ known: -1, events, commands })).status).toBe(200);
    const inbound = await upload();
    expect(inbound.status).toBe(200);
    state = applyWatchOperations(state, inbound.body.events || [], inbound.body.commands || [], {}, Date.now()).state;
    for (const op of [...events, ...commands]) expect(state._watch.receipts.find((r: any) => r.id === op.id)?.status).toBe('saved');
    expect((await upload()).status).toBe(200);
    const retry = await watch({ known: -1, events, commands });
    for (const op of [...events, ...commands]) expect(retry.body.receipts).toContainEqual({ id: op.id, status: 'saved' });
    expect((await upload()).body.events).toEqual([]);
  }
  try {
    const claim = await request(id + '/claim', { token: phoneToken });
    expect(claim.body.phase).toBe('confirm');
    expect((await phone({ revision: 1, snapshot: snapshot(), receipts: [] })).body.phase).toBe('confirm');
    expect((await watch({ approve: claim.body.challenge, known: -1, events: [] })).body.phase).toBe('paired');
    expect((await request(id + '/watch', { known: -1, events: [] }, '0'.repeat(64))).status).toBe(401);
    await upload();
    const handoff = await watch({ known: -1, events: [] });
    expect(handoff.body.snapshot).toMatchObject({ v: 1, preparation: true, workout: { id: state.active.id } });
    await apply([], [command('prepare', { lift: 0, from: 'setup', to: 'warmup', expected: expected() })]);
    const warmup = snapshot().workout!.prep!.stations[0].warmups[0];
    const warm = { id: `${state.active.id}:warmup:0:0:${++sequence}`, session: state.active.id, lift: 0, set: 0, scope: 'warmup',
      expected: [warmup[1], warmup[2]], exercise: snapshot().workout!.sets[0][2], reps: 5, weight: 20, unit: 'kg', at: Math.floor(Date.now() / 1000) };
    await apply([warm]);
    expect(state.active.entries[0].sets[0].done).toBe(true);
    expect(snapshot().workout!.prep!.stations[0].phase).toBe('work');
    const row = snapshot().workout!.sets[0];
    const work = { ...warm, id: `${state.active.id}:0:0:${++sequence}`, scope: 'work', expected: [row[3], row[4]], weight: 40 };
    await apply([work]);
    expect(state.active.entries[0].sets[1]).toMatchObject({ done: true, r: 5, w: 40 });
    expect(state.active.entries[0].sets[2].done).toBe(false);
    // A stale phone cannot overwrite the newer snapshot.
    expect((await phone({ revision: 0, snapshot: snapshot(), receipts: [] })).status).toBe(409);
    const finish = command('finish', { recorded: 1, warmups: 1, total: snapshot().workout!.sets.length });
    await apply([], [finish]);
    expect(state.active).toBeNull();
    expect(state.workouts).toHaveLength(1);
    expect(state.workouts[0].entries[0].sets.filter((s: any) => s.done)).toHaveLength(2);
  } finally {
    const revoked = await request(id + '/revoke', {}, token);
    expect(revoked.status).toBe(200);
    expect((await watch({ known: -1, events: [] })).status).toBe(410);
  }
}, 60000);
