/** Versioned wire contract. Seconds (not milliseconds) fit Connect IQ Number. */
export const PROTOCOL = 1;
export const MAX_SETS = 60;
export const MAX_EVENTS = 60;
export const MAX_WARMUPS = 120;
export interface WatchPreferences {
  vibrate: boolean;
  restAlert: boolean;
  weightStep: number;
}
export const defaultWatchPreferences: WatchPreferences = {
  vibrate: true,
  restAlert: true,
  weightStep: 2.5,
};
// lift index, set index, exercise name, load, target reps, rest seconds, result
// result: -1 unrecorded, -2 skipped, -3 phone-recorded timed set, >=0 completed reps.
export type WatchSet = [number, number, string, number, number, number, number];
// Warm-up index, load, target reps, result. Results use the working-set sentinels.
export type WatchWarmup = [number, number, number, number];
// Requested load, achievable load, plate denomination/count on EACH side.
export type WatchLoad = [number, number, [number, number][]];
export interface WatchPreparation {
  bar: number;
  stations: {
    lift: number;
    equipment: 'barbell' | 'dumbbell' | 'machine' | 'bodyweight';
    label: string;
    phase: 'setup' | 'warmup' | 'work';
    warmups: WatchWarmup[];
    loads: WatchLoad[];
  }[];
}
export interface WatchWorkout {
  id: string;
  name: string;
  unit: 'lb' | 'kg';
  start: number;
  paused: number;
  pauseSeconds: number;
  rest: number;
  sets: WatchSet[];
  focus?: number;
  rests?: [number, number][];
  prep?: WatchPreparation;
}
export interface WatchSnapshot {
  v: 1;
  workout: WatchWorkout | null;
  preferences: WatchPreferences;
  issue: string;
  controls?: true;
  skipExercise?: true;
  preparation?: true;
}
export interface WatchEvent {
  id: string;
  session: string;
  lift: number;
  set: number;
  reps: number;
  weight: number;
  exercise: string;
  unit: 'lb' | 'kg';
  at: number;
  /** Pending load and rep target shown when recording; guards phone-side changes. */
  expected?: [number, number];
  scope?: 'work' | 'warmup';
}
export type WatchCommand = {
  id: string;
  session: string;
  at: number;
} & (
  | { kind: 'skip-rest'; lift: number; until: number }
  | { kind: 'skip-exercise'; lift: number; expected: WatchSet[] }
  | { kind: 'finish'; recorded: number; total: number; warmups?: number }
  | {
      kind: 'prepare';
      lift: number;
      from: 'setup' | 'warmup' | 'work';
      to: 'warmup' | 'work';
      expected: WatchSet[];
    }
  | { kind: 'station'; lift: number; from: number; expected: WatchSet[] }
  | { kind: 'undo'; event: WatchEvent }
);
export interface WatchReceipt {
  id: string;
  status: 'saved' | 'review';
}
export interface RelayReply {
  phase: 'waiting' | 'confirm' | 'paired';
  challenge?: string;
  revision?: number;
  snapshot?: WatchSnapshot;
  events?: WatchEvent[];
  commands?: WatchCommand[];
  receipts?: WatchReceipt[];
  watchSeen?: number;
  /** Last relay snapshot revision reported as applied by the watch. Phone replies only. */
  watchRevision?: number;
  phoneSeen?: number;
}
export const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const number = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const integer = (v: unknown, max: number) => number(v, 0, max) && Number.isInteger(v);
export function isWatchEvent(v: unknown): v is WatchEvent {
  return (
    object(v) &&
    [9, 10, 11].includes(Object.keys(v).length) &&
    Object.keys(v).every((k) =>
      [
        'id',
        'session',
        'lift',
        'set',
        'reps',
        'weight',
        'exercise',
        'unit',
        'at',
        'expected',
        'scope',
      ].includes(k),
    ) &&
    typeof v.exercise === 'string' &&
    v.exercise.length > 0 &&
    v.exercise.length <= 32 &&
    (v.unit === 'lb' || v.unit === 'kg') &&
    typeof v.session === 'string' &&
    /^[a-zA-Z0-9-]{1,80}$/.test(v.session) &&
    integer(v.lift, 999) &&
    integer(v.set, 999) &&
    typeof v.id === 'string' &&
    (v.scope === 'warmup'
      ? v.id.startsWith(`${v.session}:warmup:${v.lift}:${v.set}:`) &&
        /^\d{1,10}$/.test(v.id.slice(`${v.session}:warmup:${v.lift}:${v.set}:`.length)) &&
        integer(v.set, 11)
      : v.id === `${v.session}:${v.lift}:${v.set}` ||
        (v.id.startsWith(`${v.session}:${v.lift}:${v.set}:`) &&
          /^\d{1,10}$/.test(v.id.slice(`${v.session}:${v.lift}:${v.set}:`.length)))) &&
    (v.scope === undefined ||
      ((v.scope === 'work' || v.scope === 'warmup') && v.expected !== undefined)) &&
    integer(v.reps, 100) &&
    number(v.weight, 0, 2000) &&
    integer(v.at, 4102444800) &&
    (v.expected === undefined ||
      (Array.isArray(v.expected) &&
        v.expected.length === 2 &&
        number(v.expected[0], 0, 2000) &&
        integer(v.expected[1], 100)))
  );
}
export function isWatchCommand(v: unknown): v is WatchCommand {
  if (
    !object(v) ||
    typeof v.session !== 'string' ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(v.session) ||
    typeof v.id !== 'string' ||
    !v.id.startsWith(`${v.session}:cmd:`) ||
    !/^\d{1,10}$/.test(v.id.slice(`${v.session}:cmd:`.length)) ||
    !integer(v.at, 4102444800)
  )
    return false;
  const keys = Object.keys(v).sort().join(',');
  if (v.kind === 'skip-rest')
    return (
      keys === 'at,id,kind,lift,session,until' &&
      integer(v.lift, 999) &&
      integer(v.until, 4102444800)
    );
  if (v.kind === 'prepare' || v.kind === 'station')
    return (
      keys ===
        (v.kind === 'prepare'
          ? 'at,expected,from,id,kind,lift,session,to'
          : 'at,expected,from,id,kind,lift,session') &&
      (v.kind === 'prepare'
        ? ['setup', 'warmup', 'work'].includes(v.from as string) &&
          ['warmup', 'work'].includes(v.to as string)
        : integer(v.from, 999)) &&
      isWatchCommand({
        id: v.id,
        session: v.session,
        at: v.at,
        kind: 'skip-exercise',
        lift: v.lift,
        expected: v.expected,
      })
    );
  if (v.kind === 'skip-exercise')
    return (
      keys === 'at,expected,id,kind,lift,session' &&
      integer(v.lift, 999) &&
      Array.isArray(v.expected) &&
      v.expected.length > 0 &&
      v.expected.length <= MAX_SETS &&
      v.expected.every(
        (s) =>
          Array.isArray(s) &&
          s.length === 7 &&
          s[0] === v.lift &&
          integer(s[1], 999) &&
          typeof s[2] === 'string' &&
          s[2].length > 0 &&
          s[2].length <= 32 &&
          number(s[3], 0, 2000) &&
          integer(s[4], 100) &&
          integer(s[5], 600) &&
          s[6] === -1,
      ) &&
      new Set(v.expected.map((s) => s[1])).size === v.expected.length
    );
  if (v.kind === 'finish')
    return (
      (keys === 'at,id,kind,recorded,session,total' ||
        keys === 'at,id,kind,recorded,session,total,warmups') &&
      (v.warmups === undefined || integer(v.warmups, MAX_WARMUPS)) &&
      integer(v.recorded, MAX_SETS) &&
      integer(v.total, MAX_SETS) &&
      (v.total as number) > 0
    );
  return (
    v.kind === 'undo' &&
    keys === 'at,event,id,kind,session' &&
    isWatchEvent(v.event) &&
    v.event.session === v.session
  );
}
export function isWatchReceipt(v: unknown): v is WatchReceipt {
  return (
    object(v) &&
    Object.keys(v).length === 2 &&
    typeof v.id === 'string' &&
    /^[a-zA-Z0-9-]{1,80}:(?:(?:warmup:)?\d{1,3}:\d{1,3}(?::\d{1,10})?|cmd:\d{1,10})$/.test(v.id) &&
    (v.status === 'saved' || v.status === 'review')
  );
}
export function isWatchSnapshot(v: unknown): v is WatchSnapshot {
  if (
    !object(v) ||
    ![4, 5, 6, 7].includes(Object.keys(v).length) ||
    !Object.keys(v).every((k) =>
      ['v', 'workout', 'preferences', 'issue', 'controls', 'skipExercise', 'preparation'].includes(
        k,
      ),
    ) ||
    (v.controls !== undefined && v.controls !== true) ||
    (v.skipExercise !== undefined && v.skipExercise !== true) ||
    (v.preparation !== undefined && v.preparation !== true) ||
    v.v !== 1 ||
    typeof v.issue !== 'string' ||
    v.issue.length > 100 ||
    !object(v.preferences) ||
    Object.keys(v.preferences).length !== 3 ||
    typeof v.preferences.vibrate !== 'boolean' ||
    typeof v.preferences.restAlert !== 'boolean' ||
    !number(v.preferences.weightStep, 0.25, 20)
  )
    return false;
  if (v.workout === null) return true;
  const w = v.workout;
  return (
    object(w) &&
    [8, 9, 10, 11].includes(Object.keys(w).length) &&
    Object.keys(w).every((k) =>
      [
        'id',
        'name',
        'unit',
        'start',
        'paused',
        'pauseSeconds',
        'rest',
        'sets',
        'focus',
        'rests',
        'prep',
      ].includes(k),
    ) &&
    (w.prep === undefined || isWatchPreparation(w.prep)) &&
    (w.focus === undefined || integer(w.focus, 999)) &&
    (w.rests === undefined ||
      (Array.isArray(w.rests) &&
        w.rests.length <= MAX_SETS &&
        w.rests.every(
          (r) =>
            Array.isArray(r) && r.length === 2 && integer(r[0], 999) && integer(r[1], 4102444800),
        ))) &&
    typeof w.id === 'string' &&
    /^[a-zA-Z0-9-]{1,80}$/.test(w.id) &&
    typeof w.name === 'string' &&
    w.name.length <= 40 &&
    (w.unit === 'lb' || w.unit === 'kg') &&
    [w.start, w.paused, w.pauseSeconds, w.rest].every((n) => integer(n, 4102444800)) &&
    Array.isArray(w.sets) &&
    w.sets.length > 0 &&
    w.sets.length <= MAX_SETS &&
    w.sets.every(
      (s) =>
        Array.isArray(s) &&
        s.length === 7 &&
        integer(s[0], 999) &&
        integer(s[1], 999) &&
        typeof s[2] === 'string' &&
        s[2].length <= 32 &&
        number(s[3], 0, 2000) &&
        integer(s[4], 100) &&
        integer(s[5], 600) &&
        number(s[6], -3, 100) &&
        Number.isInteger(s[6]),
    )
  );
}

export function isWatchPreparation(v: unknown): v is WatchPreparation {
  return (
    object(v) &&
    Object.keys(v).sort().join(',') === 'bar,stations' &&
    number(v.bar, 0.1, 200) &&
    Array.isArray(v.stations) &&
    v.stations.length > 0 &&
    v.stations.length <= MAX_SETS &&
    new Set(v.stations.map((s) => (object(s) ? s.lift : null))).size === v.stations.length &&
    v.stations.every(
      (s) =>
        object(s) &&
        Object.keys(s).sort().join(',') === 'equipment,label,lift,loads,phase,warmups' &&
        integer(s.lift, 999) &&
        ['barbell', 'dumbbell', 'machine', 'bodyweight'].includes(s.equipment as string) &&
        typeof s.label === 'string' &&
        s.label.length > 0 &&
        s.label.length <= 20 &&
        ['setup', 'warmup', 'work'].includes(s.phase as string) &&
        Array.isArray(s.warmups) &&
        s.warmups.length <= 12 &&
        s.warmups.every(
          (w, i) =>
            Array.isArray(w) &&
            w.length === 4 &&
            w[0] === i &&
            number(w[1], 0, 2000) &&
            integer(w[2], 100) &&
            number(w[3], -3, 100) &&
            Number.isInteger(w[3]),
        ) &&
        Array.isArray(s.loads) &&
        s.loads.length > 0 &&
        s.loads.length <= MAX_SETS + 12 &&
        s.loads.every(
          (l) =>
            Array.isArray(l) &&
            l.length === 3 &&
            number(l[0], 0, 2000) &&
            number(l[1], 0, 2000) &&
            Array.isArray(l[2]) &&
            l[2].length <= 30 &&
            l[2].every(
              (p) =>
                Array.isArray(p) &&
                p.length === 2 &&
                number(p[0], 0.25, 100) &&
                integer(p[1], 4000) &&
                p[1] > 0,
            ),
        ),
    ) &&
    v.stations.reduce((count, s) => count + s.warmups.length, 0) <= MAX_WARMUPS
  );
}
