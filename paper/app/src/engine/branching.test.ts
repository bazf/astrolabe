// Механіки рушія для акту 3, перевірені на мінімальній синтетичній справі.
import { describe, expect, it } from 'vitest';
import type { CaseBundle } from '../../../shared/case-types.ts';
import { availableDecisions, canAccuse, optionMessage, reduce, visibleTasks } from './reducer.ts';
import type { Action, GameState } from './state.ts';

const T0 = 1_800_000_000_000;
const min = (m: number) => T0 + m * 60_000;

const bundle = {
  id: 't',
  title: 't',
  hintPenaltyMin: 3,
  deadlineNotice: '@n',
  docs: [],
  codes: [],
  interviews: [],
  db: [],
  dbSalt: 's',
  strings: {},
  geometry: {} as CaseBundle['geometry'],
  gates: { A: { task: 'G', sealed: {} as never } },
  tasks: [
    { id: 'G', label: 'G', title: '@x', question: {} as never, gate: 'A', hints: {} as never, check: {} as never },
    { id: 'P', label: 'P', title: '@x', question: {} as never, hints: {} as never, check: {} as never, visibleWhen: { flag: 'poisoned' }, effects: [{ set: 'saved', value: true }] },
  ],
  decisions: [
    {
      id: 'D',
      label: 'D',
      prompt: '@p',
      options: [{ id: 'x', label: '@x', effects: [{ if: { flag: 'trust' }, then: [{ set: 'safe', value: true }], else: [{ schedule: 'POISON', afterMin: 8 }] }] }],
    },
  ],
  events: [
    { id: 'LATE', at: { minute: 40, afterGate: 'A' }, message: '@m' },
    { id: 'D-CALL', at: { afterGate: 'A' }, message: '@m', decision: 'D' },
    { id: 'POISON', at: { scheduled: true }, message: '@m', effects: [{ set: 'poisoned', value: true }, { schedule: 'DEAD', afterMin: 3 }] },
    { id: 'DEAD', at: { scheduled: true }, requires: { not: { flag: 'saved' } }, message: '@m', effects: [{ set: 'dead', value: true }] },
  ],
} as unknown as CaseBundle;

const run = (s: GameState | null, ...as: Action[]) => as.reduce<GameState>((acc, a) => reduce(bundle, acc, a)!, s as GameState);
const started = () => run(null, { type: 'start', level: 'trainee', mode: 'competition', team: 'x', now: T0 });
const gate = (s: GameState, at: number) => run(s, { type: 'solved', task: 'G', canon: '1', payload: { envelope: 'A', message: 'm', unlock: [] }, now: at });

describe('events with minute and gate', () => {
  it('waits for both the minute and the gate', () => {
    let s = gate(started(), min(10));
    s = run(s, { type: 'tick', now: min(39) });
    expect(s.firedEvents).not.toContain('LATE');
    s = run(s, { type: 'tick', now: min(40) });
    expect(s.firedEvents).toContain('LATE');
    const early = run(started(), { type: 'tick', now: min(45) });
    expect(early.firedEvents).not.toContain('LATE');
  });
});

describe('conditional effects and branch timers', () => {
  it('takes the safe branch when the flag is set', () => {
    let s = run(gate(started(), min(10)), { type: 'tick', now: min(10) });
    s = { ...s, flags: { ...s.flags, trust: true } };
    s = run(s, { type: 'decide', decision: 'D', option: 'x', now: min(11) });
    expect(s.flags.safe).toBe(true);
    expect(s.scheduled.map((x) => x.event)).not.toContain('POISON');
  });

  it('poisons, shows the branch task, and kills if the task is not solved in time', () => {
    let s = run(gate(started(), min(10)), { type: 'tick', now: min(10) }, { type: 'decide', decision: 'D', option: 'x', now: min(11) });
    expect(visibleTasks(bundle, s).map((t) => t.id)).toEqual(['G']);
    s = run(s, { type: 'tick', now: min(19) });
    expect(s.flags.poisoned).toBe(true);
    expect(visibleTasks(bundle, s).map((t) => t.id)).toEqual(['G', 'P']);
    s = run(s, { type: 'tick', now: min(22) });
    expect(s.flags.dead).toBe(true);
  });

  it('solving the branch task in time applies its effects and cancels the death', () => {
    let s = run(gate(started(), min(10)), { type: 'tick', now: min(10) }, { type: 'decide', decision: 'D', option: 'x', now: min(11) }, { type: 'tick', now: min(19) });
    s = run(s, { type: 'solved', task: 'P', canon: '1', now: min(20) }, { type: 'tick', now: min(23) });
    expect(s.flags.saved).toBe(true);
    expect(s.flags.dead).toBeUndefined();
  });
});

describe('act 4 conditions and locks', () => {
  const b2 = {
    ...bundle,
    tasks: [
      ...bundle.tasks,
      { id: 'SAFE', label: 'S', title: '@x', question: {} as never, hints: {} as never, check: {} as never, lock: { after: 3, minutes: 5 } },
    ],
    decisions: [
      ...bundle.decisions,
      { id: 'OP', label: 'OP', prompt: '@p', available: { any: [{ solved: 'G' }, { fired: 'LATE' }] }, options: [{ id: 'x', label: '@x', effects: [] }] },
      { id: 'OP2', label: 'OP2', prompt: '@p', available: { all: [{ decided: 'OP', option: 'x' }, { hintsAtMost: 1 }] }, options: [{ id: 'x', label: '@x', effects: [] }] },
      { id: 'LV', label: 'LV', prompt: '@p', options: [{ id: 'x', label: '@x', effects: [{ if: { level: 'detective' }, then: [{ set: 'det', value: true }], else: [{ set: 'tr', value: true }] }] }] },
    ],
  } as unknown as CaseBundle;
  const r2 = (s: GameState, ...as: Action[]) => as.reduce<GameState>((acc, a) => reduce(b2, acc, a)!, s);

  it('a safe-style task locks for its own minutes after three misses', () => {
    const s = r2(started(), { type: 'wrong', task: 'SAFE', now: min(1) }, { type: 'wrong', task: 'SAFE', now: min(1) }, { type: 'wrong', task: 'SAFE', now: min(1) });
    expect(s.wrong.SAFE.lockedUntil).toBe(min(1) + 5 * 60_000);
  });

  it('conditions on solved tasks, fired events, hints and level', () => {
    let s = started();
    expect(availableDecisions(b2, s)).not.toContain('OP');
    s = gate(s, min(5));
    expect(availableDecisions(b2, s)).toContain('OP');
    s = r2(s, { type: 'hint', task: 'G', now: min(6) }, { type: 'decide', decision: 'OP', option: 'x', now: min(7) });
    expect(availableDecisions(b2, s)).toContain('OP2');
    s = r2(s, { type: 'hint', task: 'G', now: min(8) });
    expect(availableDecisions(b2, s)).not.toContain('OP2');
  });

  it('records an accusation once', () => {
    let s = r2(started(), { type: 'accuse', answers: { killer: 'a' }, correct: { killer: true }, now: min(80) });
    s = r2(s, { type: 'accuse', answers: { killer: 'b' }, correct: { killer: false }, now: min(81) });
    expect(s.accusation).toMatchObject({ answers: { killer: 'a' }, correct: { killer: true } });
  });
});

describe('the accusation gate and the frozen ending', () => {
  const b3 = { ...bundle, accusationOpen: { flag: 'ready' } } as unknown as CaseBundle;
  const r3 = (s: GameState, ...as: Action[]) => as.reduce<GameState>((acc, a) => reduce(b3, acc, a)!, s);
  const accuse: Action = { type: 'accuse', answers: { killer: 'a' }, correct: { killer: true }, now: min(80) };

  it('opens the accusation only when the case condition holds', () => {
    const s = started();
    expect(canAccuse(b3, s)).toBe(false);
    expect(r3(s, accuse).accusation).toBeUndefined();
    const ready = { ...s, flags: { ready: true } };
    expect(canAccuse(b3, ready)).toBe(true);
    const done = r3(ready, accuse);
    expect(done.accusation).toBeDefined();
    expect(canAccuse(b3, done)).toBe(false);
  });

  it('freezes everything after the accusation except reading messages', () => {
    const before = { ...started(), flags: { ready: true, trust: false }, pendingDecisions: ['D'], scheduled: [{ event: 'POISON', dueAt: min(81) }] };
    const s = r3({ ...before, inbox: [{ id: 'i1', at: min(1), read: false, text: 'm' }] }, accuse);
    const later: Action[] = [
      { type: 'decide', decision: 'D', option: 'x', now: min(82) },
      { type: 'solved', task: 'G', canon: '1', payload: { envelope: 'A', message: 'm', unlock: [] }, now: min(82) },
      { type: 'hint', task: 'G', now: min(82) },
      { type: 'wrong', task: 'G', now: min(82) },
      { type: 'tick', now: min(90) },
      { type: 'code', code: 1, now: min(82) },
    ];
    for (const a of later) expect(reduce(b3, s, a), a.type).toBe(s);
    expect(reduce(b3, s, { type: 'read', inboxId: 'i1' })!.inbox[0].read).toBe(true);
  });
});

describe('decision side effects in act 4', () => {
  const b4 = {
    ...bundle,
    tasks: [...bundle.tasks, { id: 'SAFE', label: 'S', title: '@x', question: {} as never, hints: {} as never, check: {} as never, lock: { after: 3, minutes: 5 } }],
    decisions: [
      {
        id: 'W',
        label: 'W',
        prompt: '@p',
        available: { all: [] },
        options: [{ id: 'x', label: '@x', effects: [{ penaltyMin: 10 }, { clearLock: 'SAFE' }, { if: { level: 'detective' }, then: [{ message: '@det' }], else: [{ message: '@tr' }] }] }],
      },
    ],
  } as unknown as CaseBundle;
  const r4 = (s: GameState, ...as: Action[]) => as.reduce<GameState>((acc, a) => reduce(b4, acc, a)!, s);
  const miss: Action = { type: 'wrong', task: 'SAFE', now: min(1) };

  it('a warrant-style effect lifts the lock but keeps the miss count', () => {
    let s = r4(started(), miss, miss, miss);
    expect(s.wrong.SAFE.lockedUntil).toBeGreaterThan(min(2));
    s = r4(s, { type: 'decide', decision: 'W', option: 'x', now: min(2) });
    expect(s.wrong.SAFE).toEqual({ count: 3, lockedUntil: 0 });
  });

  it('finds the message of an option even inside a conditional effect', () => {
    const s = started();
    expect(optionMessage(b4, s, 'W', 'x')).toBe('@tr');
    expect(optionMessage(b4, { ...s, level: 'detective' }, 'W', 'x')).toBe('@det');
    expect(optionMessage(bundle, s, 'D', 'x')).toBeUndefined();
  });
});

describe('timers fire on their own clock', () => {
  it('a phone that slept through the poisoning sees the same times as one that ticked every minute', () => {
    const poisoned = run(gate(started(), min(5)), { type: 'decide', decision: 'D', option: 'x', now: min(45) });
    let live = poisoned;
    for (let m = 46; m <= 60; m++) live = run(live, { type: 'tick', now: min(m) });
    const slept = run(poisoned, { type: 'tick', now: min(59.5) });
    for (const s of [live, slept]) {
      expect(s.flags.dead).toBe(true);
      expect(s.inbox.filter((m) => m.messageId === '@m').map((m) => m.at)).toEqual(expect.arrayContaining([min(53), min(56)]));
    }
  });

  it('events that came due before an action happen before it', () => {
    // гравець робить дію на 60-й хвилині, не дочекавшись тіку: отруєння й смерть уже відбулися
    const poisoned = run(gate(started(), min(5)), { type: 'decide', decision: 'D', option: 'x', now: min(45) });
    const s = run(poisoned, { type: 'solved', task: 'P', canon: 'x', now: min(60) });
    expect(s.flags.dead).toBe(true);
    expect(s.firedEvents).toEqual(expect.arrayContaining(['POISON', 'DEAD']));
  });
});
